/**
 * @fileoverview ts-rest API contract defining all endpoint schemas.
 * Used by both server route handlers and client API calls.
 */

import { initContract } from '@ts-rest/core'
import { z } from 'zod'

import {
  insertTaskSchema,
  insertUserSettingsSchema,
  taskSchema,
  userSettingsSchema,
} from './schema'

const c = initContract()

const ApiPaths = {
  TASKS: '/api/tasks',
  SETTINGS: '/api/settings',
} as const

const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
}

const zId = z.coerce.number()

const tasksContract = c.router({
  list: {
    method: 'GET',
    path: ApiPaths.TASKS,
    responses: {
      200: z.array(taskSchema),
    },
    summary: 'List all tasks for the authenticated user',
  },
  export: {
    method: 'GET',
    path: `${ApiPaths.TASKS}/export`,
    responses: {
      200: z.object({
        version: z.number(),
        exportedAt: z.string(),
        tasks: z.array(taskSchema.omit({ userId: true })),
      }),
    },
    summary: 'Export all tasks as JSON',
  },
  import: {
    method: 'POST',
    path: `${ApiPaths.TASKS}/import`,
    body: z.object({
      tasks: z.array(
        insertTaskSchema.omit({ userId: true }).extend({
          id: z.number().nullish(),
          status: insertTaskSchema.shape.status.nullish(),
          parentId: z.number().nullish(),
          createdAt: z.string().nullish(),
          completedAt: z.string().nullish(),
        }),
      ),
    }),
    responses: {
      200: z.object({ message: z.string(), imported: z.number() }),
      400: errorSchemas.validation,
    },
    summary: 'Import tasks from JSON',
  },
  get: {
    method: 'GET',
    path: `${ApiPaths.TASKS}/:id`,
    pathParams: z.object({ id: zId }),
    responses: {
      200: taskSchema,
      404: errorSchemas.notFound,
    },
    summary: 'Get a single task by ID',
  },
  create: {
    method: 'POST',
    path: ApiPaths.TASKS,
    body: insertTaskSchema.omit({ userId: true }),
    responses: {
      201: taskSchema,
      400: errorSchemas.validation,
    },
    summary: 'Create a new task',
  },
  update: {
    method: 'PATCH',
    path: `${ApiPaths.TASKS}/:id`,
    pathParams: z.object({ id: zId }),
    body: insertTaskSchema.omit({ userId: true }).partial(),
    responses: {
      200: taskSchema,
      400: errorSchemas.validation,
      404: errorSchemas.notFound,
    },
    summary: 'Update a task',
  },
  delete: {
    method: 'DELETE',
    path: `${ApiPaths.TASKS}/:id`,
    pathParams: z.object({ id: zId }),
    body: c.noBody(),
    responses: {
      204: c.noBody(),
      404: errorSchemas.notFound,
    },
    summary: 'Delete a task',
  },
})

const settingsContract = c.router({
  get: {
    method: 'GET',
    path: ApiPaths.SETTINGS,
    responses: {
      200: userSettingsSchema,
    },
    summary: 'Get user settings',
  },
  update: {
    method: 'PATCH',
    path: ApiPaths.SETTINGS,
    body: insertUserSettingsSchema.omit({ userId: true }).partial(),
    responses: {
      200: userSettingsSchema,
    },
    summary: 'Update user settings',
  },
})

export const contract = c.router(
  {
    tasks: tasksContract,
    settings: settingsContract,
  },
  {
    pathPrefix: '',
    strictStatusCodes: true,
  },
)
