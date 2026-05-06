/**
 * @fileoverview API route handlers using ts-rest contract-based routing.
 *
 * Defines all task and settings CRUD endpoints with authentication middleware.
 * Handles task status transitions, import/export functionality, and user settings.
 * Integrates with Replit Auth for user session management.
 */

import type { Server } from 'node:http'
import { createExpressEndpoints, initServer } from '@ts-rest/express'
import { isNil, omit } from 'es-toolkit'
import type { Express } from 'express'

import { TestPaths } from '~/shared/constants'
import { contract } from '~/shared/contract'
import { DEFAULT_FIELD_CONFIG, TaskStatus } from '~/shared/schema'
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

const ERRORS = {
  TASK_NOT_FOUND: {
    status: 404 as const,
    body: { message: 'Task not found' },
  },
  PARENT_NOT_FOUND: {
    status: 404 as const,
    body: { message: 'Parent task not found' },
  },
  ATTACHMENT_NOT_FOUND: {
    status: 404 as const,
    body: { message: 'Attachment not found' },
  },
  TIME_SPENT_REQUIRED: {
    status: 400 as const,
    body: { message: 'Time spent must be recorded to complete this task' },
  },
} as const

const s = initServer()

/** Returns a 400 response if timeSpent is required and effectiveTimeMs ≤ 0, otherwise null. */
const checkTimeSpentRequired = async (
  userId: string,
  effectiveTimeMs: number,
): Promise<{ status: 400; body: { message: string } } | null> => {
  const userSettings = await storage.getSettings(userId)
  if (!userSettings.fieldConfig.timeSpent.required) return null
  if (effectiveTimeMs <= 0) {
    return ERRORS.TIME_SPENT_REQUIRED
  }
  return null
}

// biome-ignore lint/suspicious/noExplicitAny: is always present
const getUserId = (req: Record<string, any>): string =>
  // biome-ignore lint/style/noNonNullAssertion: is always present
  (req.user as UserSession).claims!.sub

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
        const task = await storage.createTask({ ...body, userId })
        return { status: 201, body: task }
      },
    },
    update: {
      middleware: [isAuthenticated],
      handler: async ({ params, body, req }) => {
        const userId = getUserId(req)
        const existing = await storage.getTask(params.id, userId)
        if (!existing) {
          return ERRORS.TASK_NOT_FOUND
        }
        if (body.status === TaskStatus.COMPLETED) {
          const accumulatedTime =
            (body.timeSpent ?? existing.timeSpent ?? 0) +
            (existing.inProgressStartedAt
              ? Date.now() - existing.inProgressStartedAt.getTime()
              : 0)
          const err = await checkTimeSpentRequired(userId, accumulatedTime)
          if (err) return err
        }
        const task = await storage.updateTask(params.id, userId, body)
        return { status: 200, body: task }
      },
    },
    delete: {
      middleware: [isAuthenticated],
      handler: async ({ params, req }) => {
        const userId = getUserId(req)
        const existing = await storage.getTask(params.id, userId)
        if (!existing) {
          return ERRORS.TASK_NOT_FOUND
        }
        await storage.deleteTask(params.id, userId)
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
      // biome-ignore lint/suspicious/noExplicitAny: isAuthenticated's ParsedQs generic conflicts with ts-rest's typed query
      middleware: [isAuthenticated as any],
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
    getUploadUrl: {
      middleware: [isAuthenticated],
      handler: async ({ body, req }) => {
        const userId = getUserId(req)
        const task = await storage.getTask(body.taskId, userId)
        if (!task) {
          return ERRORS.TASK_NOT_FOUND
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
        const attachment = await storage.createAttachment({
          taskId: body.taskId,
          userId,
          fileName: body.fileName,
          fileSize: body.fileSize,
          mimeType: body.mimeType,
          r2Key: body.key,
        })
        return { status: 201, body: attachment }
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
        await deleteR2Object(attachment.r2Key)
        await storage.deleteAttachment(params.id, userId)
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

  if (process.env.NODE_ENV !== 'production') {
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

      const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
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
