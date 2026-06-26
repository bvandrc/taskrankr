/**
 * @fileoverview Constants shared between client and server.
 */
import { MAX_TOTAL_STORAGE_BYTES } from './fileAttachments'
import { formatFileSize } from './fileSize'

/**
 * E2E-only backdoors, only registered when NODE_ENV !== 'production'.
 * See server/routes.ts → registerTestRoutes.
 */
export const TestPaths = {
  /** GET/DELETE the test user's tasks without a session. */
  TEST_TASKS: '/api/test/tasks',
  /** DELETE – resets the test user's settings to defaults without a session. */
  TEST_RESET_SETTINGS: '/api/test/settings',
} as const

export type AppError<StatusCode extends number = number> = {
  status: StatusCode
  message: string
}

export const ERRORS = {
  TASK_NOT_FOUND: {
    status: 404,
    message: 'Task not found',
  },
  PARENT_NOT_FOUND: {
    status: 404,
    message: 'Parent task not found',
  },
  INCOMPLETE_SUBTASKS: {
    status: 400,
    message: 'All subtasks must be completed first',
  },
  ATTACHMENT_NOT_FOUND: {
    status: 404,
    message: 'Attachment not found',
  },
  ATTACHMENT_METADATA_FAILED: {
    status: 400,
    message: 'Failed to save attachment metadata',
  },
  STORAGE_LIMIT_EXCEEDED: {
    status: 400,
    message: `Storage limit of ${formatFileSize(MAX_TOTAL_STORAGE_BYTES)} reached. Delete some attachments to free up space.`,
  },
} as const satisfies Record<string, AppError>
