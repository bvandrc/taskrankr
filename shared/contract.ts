/**
 * @fileoverview ts-rest API contract defining all endpoint schemas.
 * Used by both server route handlers and client API calls.
 */

import { initContract } from '@ts-rest/core'
import { z } from 'zod'

import {
  attachmentSchema,
  insertTaskSchema,
  insertUserSettingsSchema,
  taskSchema,
  userSettingsSchema,
} from './schema'

const c = initContract()

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

const tasksContract = c.router({
  list: {
    method: 'GET',
    path: '/api/tasks',
    responses: {
      200: z.array(taskSchema),
    },
    summary: 'List all tasks for the authenticated user',
  },
  get: {
    method: 'GET',
    path: '/api/tasks/:id',
    pathParams: z.object({
      id: z.coerce.number(),
    }),
    responses: {
      200: taskSchema,
      404: errorSchemas.notFound,
    },
    summary: 'Get a single task by ID',
  },
  create: {
    method: 'POST',
    path: '/api/tasks',
    body: insertTaskSchema.omit({ userId: true }),
    responses: {
      201: taskSchema,
      400: errorSchemas.validation,
    },
    summary: 'Create a new task',
  },
  update: {
    method: 'PUT',
    path: '/api/tasks/:id',
    pathParams: z.object({
      id: z.coerce.number(),
    }),
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
    path: '/api/tasks/:id',
    pathParams: z.object({
      id: z.coerce.number(),
    }),
    body: c.noBody(),
    responses: {
      204: c.noBody(),
      404: errorSchemas.notFound,
    },
    summary: 'Delete a task',
  },
  export: {
    method: 'GET',
    path: '/api/tasks/export',
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
    path: '/api/tasks/import',
    body: z.object({
      tasks: z.array(
        insertTaskSchema.omit({ userId: true }).extend({
          id: z.number().nullish(),
          status: insertTaskSchema.shape.status.nullish(),
          parentId: z.number().nullish(),
          timeSpent: z.number().nullish(),
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
  reorderSubtasks: {
    method: 'PUT',
    path: '/api/tasks/:id/reorder',
    pathParams: z.object({
      id: z.coerce.number(),
    }),
    body: z.object({
      orderedIds: z.array(z.number()),
    }),
    responses: {
      200: z.object({ message: z.string() }),
      400: errorSchemas.validation,
      404: errorSchemas.notFound,
    },
    summary: 'Reorder subtasks of a task',
  },
})

const settingsContract = c.router({
  get: {
    method: 'GET',
    path: '/api/settings',
    responses: {
      200: userSettingsSchema,
    },
    summary: 'Get user settings',
  },
  update: {
    method: 'PUT',
    path: '/api/settings',
    body: insertUserSettingsSchema.omit({ userId: true }).partial(),
    responses: {
      200: userSettingsSchema,
    },
    summary: 'Update user settings',
  },
})

const attachmentsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/attachments',
    query: z.object({
      taskId: z.coerce.number(),
    }),
    responses: {
      200: z.array(attachmentSchema),
    },
    summary: 'List attachments for a task',
  },
  getUploadUrl: {
    method: 'POST',
    path: '/api/attachments/upload-url',
    body: z.object({
      taskId: z.number(),
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
    }),
    responses: {
      200: z.object({ uploadUrl: z.string(), key: z.string() }),
      400: errorSchemas.validation,
      404: errorSchemas.notFound,
    },
    summary: 'Get a presigned URL for uploading a file to R2',
  },
  create: {
    method: 'POST',
    path: '/api/attachments',
    body: z.object({
      taskId: z.number(),
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
      key: z.string(),
    }),
    responses: {
      201: attachmentSchema,
      400: errorSchemas.validation,
      404: errorSchemas.notFound,
    },
    summary: 'Save attachment metadata after a successful upload',
  },
  getDownloadUrl: {
    method: 'GET',
    path: '/api/attachments/:id/download-url',
    pathParams: z.object({
      id: z.coerce.number(),
    }),
    responses: {
      200: z.object({ downloadUrl: z.string() }),
      404: errorSchemas.notFound,
    },
    summary: 'Get a presigned download URL for an attachment',
  },
  delete: {
    method: 'DELETE',
    path: '/api/attachments/:id',
    pathParams: z.object({
      id: z.coerce.number(),
    }),
    body: c.noBody(),
    responses: {
      204: c.noBody(),
      404: errorSchemas.notFound,
    },
    summary: 'Delete an attachment from R2 and the database',
  },
})

export const contract = c.router(
  {
    tasks: tasksContract,
    settings: settingsContract,
    attachments: attachmentsContract,
  },
  {
    pathPrefix: '',
    strictStatusCodes: true,
  },
)
