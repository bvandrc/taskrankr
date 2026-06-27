/**
 * @fileoverview API route handlers using ts-rest contract-based routing.
 *
 * Defines all task and settings CRUD endpoints with authentication middleware.
 * Mutation handlers delegate to `TaskMutationService` for rule validation and
 * side-effect resolution, then persist the computed mutations via `storage`.
 */

import type { Server } from 'node:http'
import { createExpressEndpoints, initServer } from '@ts-rest/express'
import { isNil, omit } from 'es-toolkit'
import type { Express } from 'express'
import { getAuth } from 'firebase-admin/auth'

import { type AppError, TestPaths } from '~/shared/constants'
import { contract } from '~/shared/contract'
import { DEFAULT_FIELD_CONFIG, type Task, TaskStatus } from '~/shared/schema'
import { getSessionUserId as getUserId, isAuthenticated } from './auth'
import { ERRORS, IS_PROD } from './constants'
import { storage } from './storage'
import { makeTaskService } from './task-service-adapter'

const s = initServer()

/** Transforms a service `AppError` to the ts-rest response shape. */
const toErrorResponse = <Status extends number>({
  status,
  message,
}: AppError<Status>) => ({ status, body: { message } })

// NOTE: order *matters* here. Must provide static endpoints before dynamic ones
const router = s.router(contract, {
  tasks: {
    list: {
      middleware: [isAuthenticated],
      handler: async ({ res }) => {
        const userId = getUserId(res)
        const tasks = await storage.getTasks(userId)
        return { status: 200, body: tasks }
      },
    },
    export: {
      middleware: [isAuthenticated],
      handler: async ({ res }) => {
        const userId = getUserId(res)
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
      handler: async ({ body, res }) => {
        const userId = getUserId(res)
        const { tasks } = body
        const idMap = new Map<number, number>()

        const getFingerprint = (name: string, createdAt: Date) =>
          `${name}::${createdAt.toISOString()}`

        const existingTasks = await storage.getTasks(userId)
        const existingFingerprints = new Set(
          existingTasks.map((t) => getFingerprint(t.name, t.createdAt)),
        )

        for (const taskData of tasks) {
          const oldId = taskData.id
          const { id, ...rest } = taskData

          const createdAt = rest.createdAt
            ? new Date(rest.createdAt)
            : new Date()
          if (existingFingerprints.has(getFingerprint(rest.name, createdAt)))
            continue

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
            createdAt,
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
      handler: async ({ params, res }) => {
        const userId = getUserId(res)
        const task = await storage.getTask(params.id, userId)
        if (!task) {
          return ERRORS.TASK_NOT_FOUND
        }
        return { status: 200, body: task }
      },
    },
    create: {
      middleware: [isAuthenticated],
      handler: async ({ body, res }) => {
        const userId = getUserId(res)
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
      handler: async ({ params, body, res }) => {
        const userId = getUserId(res)
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
      handler: async ({ params, res }) => {
        const userId = getUserId(res)
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
  },
  settings: {
    get: {
      middleware: [isAuthenticated],
      handler: async ({ res }) => {
        const userId = getUserId(res)
        const settings = await storage.getSettings(userId)
        return { status: 200, body: settings }
      },
    },
    update: {
      middleware: [isAuthenticated],
      handler: async ({ body, res }) => {
        const userId = getUserId(res)
        const settings = await storage.updateSettings(userId, body)
        return { status: 200, body: settings }
      },
    },
  },
  account: {
    delete: {
      middleware: [isAuthenticated],
      handler: async ({ res }) => {
        const userId = getUserId(res)
        await getAuth().deleteUser(userId)
        await storage.deleteUserItems(userId)
        return { status: 204, body: undefined }
      },
    },
  },
})

export function registerRoutes(httpServer: Server, app: Express): Server {
  if (!IS_PROD) {
    registerTestRoutes(app)
  }

  createExpressEndpoints(contract, router, app)

  return httpServer
}

const TEST_USER_ID = process.env.CYPRESS_TEST_USER_ID ?? 'cypress-test-user'

/**
 * E2E-only routes, never registered in production.
 *
 *  GET    /api/test/tasks    – Returns the test user's tasks without auth.
 *  DELETE /api/test/tasks    – Clears all test-user tasks between runs.
 *  DELETE /api/test/settings – Resets test user settings to defaults.
 */
function registerTestRoutes(app: Express): void {
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
