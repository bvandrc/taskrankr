/**
 * @fileoverview API route handlers using ts-rest contract-based routing.
 *
 * Defines all task and settings CRUD endpoints with authentication middleware.
 * Mutation handlers delegate to `TaskMutationService` for rule validation and
 * side-effect resolution, then persist the computed mutations via `storage`.
 * Integrates with Replit Auth for user session management.
 */

import type { Server } from 'node:http'
import { createExpressEndpoints, initServer } from '@ts-rest/express'
import { hoursToSeconds } from 'date-fns'
import { isNil, noop, omit } from 'es-toolkit'
import type { Express } from 'express'

import { type AppError, TestPaths } from '~/shared/constants'
import { contract } from '~/shared/contract'
import { MAX_TOTAL_STORAGE_BYTES } from '~/shared/fileAttachments'
import { DEFAULT_FIELD_CONFIG, type Task, TaskStatus } from '~/shared/schema'
import { ERRORS, IS_PROD } from './constants'
import {
  deleteR2Object,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
} from './r2'
import {
  authStorage,
  isAuthenticated,
  registerAuthRoutes,
  setupAuth,
} from './replit_integrations/auth'
import type { UserSession } from './replit_integrations/auth/replitAuth'
import { storage } from './storage'
import { makeTaskService } from './task-service-adapter'

const s = initServer()

const getUserId = (req: { user?: UserSession }): string => {
  const userId = req.user?.claims?.sub
  if (!userId) {
    throw new Error('User ID not found in session')
  }
  return userId
}

/** Transforms a service `AppError` to the ts-rest response shape. */
const toErrorResponse = <Status extends number>({
  status,
  message,
}: AppError<Status>) => ({ status, body: { message } })

const router = s.router(contract, {
  tasks: {
    list: {
      middleware: [isAuthenticated],
      handler: async ({ req }) => {
        const userId = getUserId(req)
        const tasks = await storage.getTasks(userId)
        return { status: 200, body: tasks }
      },
    },
    get: {
      middleware: [isAuthenticated],
      handler: async ({ params, req }) => {
        const userId = getUserId(req)
        const task = await storage.getTask(params.id, userId)
        if (!task) {
          return ERRORS.TASK_NOT_FOUND
        }
        return { status: 200, body: task }
      },
    },
    create: {
      middleware: [isAuthenticated],
      handler: async ({ body, req }) => {
        const userId = getUserId(req)
        const service = makeTaskService(userId)
        const result = await service.resolveCreate(body)
        if (!result.ok) return toErrorResponse(result.error)

        const task = await storage.createTask({ ...body, userId })
        for (const m of result.mutations) {
          await storage.updateTask(m.id, userId, m.patch)
        }
        return { status: 201, body: task }
      },
    },
    update: {
      middleware: [isAuthenticated],
      handler: async ({ params, body, req }) => {
        const userId = getUserId(req)
        const service = makeTaskService(userId)
        const result = await service.resolveUpdate(params.id, body)
        if (!result.ok) return toErrorResponse(result.error)

        let primary: Task | undefined
        for (const m of result.mutations) {
          const updated = await storage.updateTask(m.id, userId, m.patch)
          if (m.id === params.id) primary = updated
        }
        if (!primary)
          throw new Error(`resolveUpdate missing mutation for id ${params.id}`)
        return { status: 200, body: primary }
      },
    },
    delete: {
      middleware: [isAuthenticated],
      handler: async ({ params, req }) => {
        const userId = getUserId(req)
        const service = makeTaskService(userId)
        const result = await service.resolveDelete(params.id)
        if (!result.ok) return toErrorResponse(result.error)

        for (const id of result.deletedIds) {
          await storage.deleteTask(id, userId)
        }
        for (const m of result.mutations) {
          await storage.updateTask(m.id, userId, m.patch)
        }
        const r2Keys = await storage.getAttachmentKeysForTaskTree(
          params.id,
          userId,
        )
        await storage.deleteTask(params.id, userId)
        await Promise.allSettled(r2Keys.map((key) => deleteR2Object(key)))
        return { status: 204, body: undefined }
      },
    },
    export: {
      middleware: [isAuthenticated],
      handler: async ({ req }) => {
        const userId = getUserId(req)
        const tasks = await storage.getTasks(userId)
        return {
          status: 200,
          body: {
            version: 1,
            exportedAt: new Date().toISOString(),
            tasks: tasks.map((t) => omit(t, ['userId'])),
          },
        }
      },
    },
    import: {
      middleware: [isAuthenticated],
      handler: async ({ body, req }) => {
        const userId = getUserId(req)
        const { tasks } = body
        const idMap = new Map<number, number>()

        for (const taskData of tasks) {
          const oldId = taskData.id
          const { id, ...rest } = taskData

          const newTask = await storage.createTask({
            name: rest.name,
            description: rest.description ?? null,
            priority: rest.priority ?? null,
            ease: rest.ease ?? null,
            enjoyment: rest.enjoyment ?? null,
            time: rest.time ?? null,
            userId,
            parentId: null,
            status: rest.status ?? TaskStatus.OPEN,
            timeSpent: rest.timeSpent ?? 0,
            inProgressStartedAt: null,
            createdAt: rest.createdAt ? new Date(rest.createdAt) : new Date(),
            completedAt: rest.completedAt ? new Date(rest.completedAt) : null,
          })

          if (oldId && newTask) {
            idMap.set(oldId, newTask.id)
          }
        }

        for (const taskData of tasks) {
          if (isNil(taskData.parentId) || isNil(taskData.id)) continue
          const newId = idMap.get(taskData.id)
          const newParentId = idMap.get(taskData.parentId)
          if (newId !== undefined && newParentId !== undefined) {
            await storage.updateTask(newId, userId, { parentId: newParentId })
          }
        }

        return {
          status: 200,
          body: {
            message: `Successfully imported ${idMap.size} tasks`,
            imported: idMap.size,
          },
        }
      },
    },
    reorderSubtasks: {
      middleware: [isAuthenticated],
      handler: async ({ params, body, req }) => {
        const userId = getUserId(req)
        const parentTask = await storage.getTask(params.id, userId)
        if (!parentTask) {
          return ERRORS.PARENT_NOT_FOUND
        }

        await storage.reorderSubtasks(params.id, userId, body.orderedIds)
        return { status: 200, body: { message: 'Subtasks reordered' } }
      },
    },
  },
  settings: {
    get: {
      middleware: [isAuthenticated],
      handler: async ({ req }) => {
        const userId = getUserId(req)
        const settings = await storage.getSettings(userId)
        return { status: 200, body: settings }
      },
    },
    update: {
      middleware: [isAuthenticated],
      handler: async ({ body, req }) => {
        const userId = getUserId(req)
        const settings = await storage.updateSettings(userId, body)
        return { status: 200, body: settings }
      },
    },
  },
  attachments: {
    list: {
      middleware: [isAuthenticated],
      handler: async ({ query, req }) => {
        const userId = getUserId(req)
        const task = await storage.getTask(query.taskId, userId)
        if (!task) {
          return { status: 200, body: [] }
        }
        const result = await storage.getAttachments(query.taskId, userId)
        return { status: 200, body: result }
      },
    },
    listAll: {
      middleware: [isAuthenticated],
      handler: async ({ req }) => {
        const userId = getUserId(req)
        const result = await storage.getAllAttachments(userId)
        return { status: 200, body: result }
      },
    },
    getUploadUrl: {
      middleware: [isAuthenticated],
      handler: async ({ body, req }) => {
        const userId = getUserId(req)
        const task = await storage.getTask(body.taskId, userId)
        if (!task) {
          return ERRORS.TASK_NOT_FOUND
        }
        const totalUsed = await storage.getTotalStorageUsed(userId)
        if (totalUsed + body.fileSize > MAX_TOTAL_STORAGE_BYTES) {
          return ERRORS.STORAGE_LIMIT_EXCEEDED
        }
        const key = `${userId}/${body.taskId}/${Date.now()}-${body.fileName}`
        const uploadUrl = await getPresignedUploadUrl(key, body.mimeType)
        return { status: 200, body: { uploadUrl, key } }
      },
    },
    create: {
      middleware: [isAuthenticated],
      handler: async ({ body, req }) => {
        const userId = getUserId(req)
        const task = await storage.getTask(body.taskId, userId)
        if (!task) {
          return ERRORS.TASK_NOT_FOUND
        }
        try {
          const attachment = await storage.createAttachment({
            ...body,
            userId,
          })
          return { status: 201, body: attachment }
        } catch {
          await deleteR2Object(body.r2Key).catch(noop)
          return ERRORS.ATTACHMENT_METADATA_FAILED
        }
      },
    },
    getDownloadUrl: {
      middleware: [isAuthenticated],
      handler: async ({ params, req }) => {
        const userId = getUserId(req)
        const attachment = await storage.getAttachment(params.id, userId)
        if (!attachment) {
          return ERRORS.ATTACHMENT_NOT_FOUND
        }
        const downloadUrl = await getPresignedDownloadUrl(
          attachment.r2Key,
          attachment.fileName,
        )
        return { status: 200, body: { downloadUrl } }
      },
    },
    delete: {
      middleware: [isAuthenticated],
      handler: async ({ params, req }) => {
        const userId = getUserId(req)
        const attachment = await storage.getAttachment(params.id, userId)
        if (!attachment) {
          return ERRORS.ATTACHMENT_NOT_FOUND
        }
        await storage.deleteAttachment(params.id, userId)
        await deleteR2Object(attachment.r2Key)
        return { status: 204, body: undefined }
      },
    },
  },
})

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await setupAuth(app)
  registerAuthRoutes(app)

  if (!IS_PROD) {
    registerTestRoutes(app)
  }

  createExpressEndpoints(contract, router, app)

  return httpServer
}

/** Hardcoded user identity used by every Cypress test run. */
const TEST_USER_ID = 'cypress-test-user'

/**
 * E2E-only routes, never registered in production.
 *
 * Replit OAuth requires a live OIDC provider and browser redirects — neither
 * is available in CI. These endpoints give Cypress a controlled alternative:
 *
 *  POST /api/test/login   – Upserts the test user and calls req.login(),
 *    writing a real session cookie via the same Passport middleware as prod.
 *  GET  /api/test/tasks   – Returns the test user's tasks without a session,
 *    so guest-mode tests can assert nothing was persisted to the server.
 *  DELETE /api/test/tasks – Clears all test-user tasks between runs.
 */
function registerTestRoutes(app: Express): void {
  app.post(TestPaths.TEST_LOGIN, async (req, res) => {
    try {
      await authStorage.upsertUser({
        id: TEST_USER_ID,
        email: 'cypress@test.local',
        firstName: 'Cypress',
        lastName: 'Test',
        profileImageUrl: null,
      })

      const expiresAt = Math.floor(Date.now() / 1000) + hoursToSeconds(24 * 7)
      const user: UserSession = {
        claims: {
          sub: TEST_USER_ID,
          iss: 'test',
          aud: 'test',
          exp: expiresAt,
          iat: Math.floor(Date.now() / 1000),
        } as UserSession['claims'],
        expires_at: expiresAt,
        access_token: 'test-token',
      }

      req.login(user, (err) => {
        if (err) {
          return res
            .status(500)
            .json({ message: 'Login failed', error: String(err) })
        }
        res.json({ ok: true, userId: TEST_USER_ID })
      })
    } catch (err) {
      res.status(500).json({ message: 'Setup failed', error: String(err) })
    }
  })

  app.get(TestPaths.TEST_TASKS, async (_req, res) => {
    try {
      const tasks = await storage.getTasks(TEST_USER_ID)
      res.json(tasks)
    } catch (err) {
      res.status(500).json({ message: 'Fetch failed', error: String(err) })
    }
  })

  app.delete(TestPaths.TEST_TASKS, async (_req, res) => {
    try {
      const tasks = await storage.getTasks(TEST_USER_ID)
      for (const task of tasks) {
        await storage.deleteTask(task.id, TEST_USER_ID)
      }
      res.json({ ok: true, deleted: tasks.length })
    } catch (err) {
      res.status(500).json({ message: 'Cleanup failed', error: String(err) })
    }
  })

  app.delete(TestPaths.TEST_RESET_SETTINGS, async (_req, res) => {
    try {
      await storage.updateSettings(TEST_USER_ID, {
        fieldConfig: DEFAULT_FIELD_CONFIG,
      })
      res.json({ ok: true })
    } catch (err) {
      res
        .status(500)
        .json({ message: 'Reset settings failed', error: String(err) })
    }
  })
}
