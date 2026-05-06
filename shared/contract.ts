/**
 * @fileoverview ts-rest API contract defining all endpoint schemas.
 * Used by both server route handlers and client API calls.
 */

import { initContract } from '@ts-rest/core'
import { z } from 'zod'

import {
  attachmentSchema,
  attachmentWithTaskSchema,
  createAttachmentBodySchema,
  insertTaskSchema,
  insertUserSettingsSchema,
  taskSchema,
  uploadUrlBodySchema,
  userSettingsSchema,
} from './schema'

const c = initContract()

const ApiPaths = {
  TASKS: '/api/tasks',
  SETTINGS: '/api/settings',
  ATTACHMENTS: '/api/attachments',
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
    method: 'PUT',
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
    path: `${ApiPaths.TASKS}/:id/reorder`,
    pathParams: z.object({ id: zId }),
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
    path: ApiPaths.SETTINGS,
    responses: {
      200: userSettingsSchema,
    },
    summary: 'Get user settings',
  },
  update: {
    method: 'PUT',
    path: ApiPaths.SETTINGS,
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
    path: ApiPaths.ATTACHMENTS,
    query: z.object({ taskId: zId }),
    responses: {
      200: z.array(attachmentSchema),
    },
    summary: 'List attachments for a task',
  },
  listAll: {
    method: 'GET',
    path: `${ApiPaths.ATTACHMENTS}/all`,
    responses: {
      200: z.array(attachmentWithTaskSchema),
    },
    summary: 'List all attachments for the authenticated user with task info',
  },
  getUploadUrl: {
    method: 'POST',
    path: `${ApiPaths.ATTACHMENTS}/upload-url`,
    body: uploadUrlBodySchema,
    responses: {
      200: z.object({ uploadUrl: z.string(), key: z.string() }),
      400: errorSchemas.validation,
      404: errorSchemas.notFound,
    },
    summary: 'Get a presigned URL for uploading a file to R2',
  },
  create: {
    method: 'POST',
    path: ApiPaths.ATTACHMENTS,
    body: createAttachmentBodySchema,
    responses: {
      201: attachmentSchema,
      400: errorSchemas.validation,
      404: errorSchemas.notFound,
    },
    summary: 'Save attachment metadata after a successful upload',
  },
  getDownloadUrl: {
    method: 'GET',
    path: `${ApiPaths.ATTACHMENTS}/:id/download-url`,
    pathParams: z.object({ id: zId }),
    responses: {
      200: z.object({ downloadUrl: z.string() }),
      404: errorSchemas.notFound,
    },
    summary: 'Get a presigned download URL for an attachment',
  },
  delete: {
    method: 'DELETE',
    path: `${ApiPaths.ATTACHMENTS}/:id`,
    pathParams: z.object({ id: zId }),
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
