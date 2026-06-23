/**
 * @fileoverview Constants shared between client and server.
 */

export const AuthPaths = {
  LOGIN: '/api/login',
  LOGOUT: '/api/logout',
  CALLBACK: '/api/callback',
  USER: '/api/auth/user',
} as const

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
} as const satisfies Record<string, AppError>
