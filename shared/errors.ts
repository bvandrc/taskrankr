/**
 * Cross-cutting error definitions shared by server and client. The server
 * translates these into HTTP responses (`status` + `message`); the client
 * shows them as toasts (`message` only). `code` is a stable identifier for
 * tests and logging.
 */

import type { ValueOf } from 'type-fest'

export const ERRORS = {
  TASK_NOT_FOUND: {
    name: 'TASK_NOT_FOUND',
    status: 404,
    message: 'Task not found',
  },
  PARENT_NOT_FOUND: {
    name: 'PARENT_NOT_FOUND',
    status: 404,
    message: 'Parent task not found',
  },
  INCOMPLETE_SUBTASKS: {
    name: 'INCOMPLETE_SUBTASKS',
    status: 400,
    message: 'All subtasks must be completed first',
  },
  TIME_SPENT_REQUIRED: {
    name: 'TIME_SPENT_REQUIRED',
    status: 400,
    message: 'Time spent must be recorded to complete this task',
  },
} as const satisfies {
  [K in string]: {
    status: number
    name: K
    message: string
  }
}

export type AppError = ValueOf<typeof ERRORS>
