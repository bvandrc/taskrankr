/**
 * Cross-cutting error definitions shared by server and client. The server
 * translates these into HTTP responses (`status` + `message`); the client
 * shows them as toasts (`message` only). `code` is a stable identifier for
 * tests and logging.
 */

export interface AppError {
  status: number
  code: string
  message: string
}

export const ERRORS = {
  TASK_NOT_FOUND: {
    status: 404,
    code: 'TASK_NOT_FOUND',
    message: 'Task not found',
  },
  PARENT_NOT_FOUND: {
    status: 404,
    code: 'PARENT_NOT_FOUND',
    message: 'Parent task not found',
  },
  INCOMPLETE_SUBTASKS: {
    status: 400,
    code: 'INCOMPLETE_SUBTASKS',
    message: 'All subtasks must be completed first',
  },
  TIME_SPENT_REQUIRED: {
    status: 400,
    code: 'TIME_SPENT_REQUIRED',
    message: 'Time spent must be recorded to complete this task',
  },
} as const satisfies Record<string, AppError>

export type AppErrorKey = keyof typeof ERRORS
