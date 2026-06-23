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
import { isNil, omit } from 'es-toolkit'
import type { Express } from 'express'

import { type AppError, TestPaths } from '~/shared/constants'
import { contract } from '~/shared/contract'
import { DEFAULT_FIELD_CONFIG, type Task, TaskStatus } from '~/shared/schema'
import { ERRORS, IS_PROD } from './constants'
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
        return { status: 204, body: undefined }
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
