/**
 * @fileoverview Constants shared between client and server.
 */

import type { ValueOf } from 'type-fest'

export const AuthPaths = {
  LOGIN: '/api/login',
  LOGOUT: '/api/logout',
  CALLBACK: '/api/callback',
  USER: '/api/auth/user',
  CONFIG: '/api/auth/config',
} as const

export type AuthConfig = {
  /** Replit OIDC is available — the /api/login flow works. */
  replitAuthEnabled: boolean
  /** Dev-only test login endpoint is registered (NODE_ENV !== 'production'). */
  testLoginEnabled: boolean
}

/**
 * E2E-only backdoors, only registered when NODE_ENV !== 'production'.
 * See server/routes.ts → registerTestRoutes.
 */
export const TestPaths = {
  /** Creates a real server session without going through Replit OAuth. */
  TEST_LOGIN: '/api/test/login',
  /** GET/DELETE the test user's tasks without a session. */
  TEST_TASKS: '/api/test/tasks',
  /** DELETE – resets the test user's settings to defaults without a session. */
  TEST_RESET_SETTINGS: '/api/test/settings',
} as const

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
