import { mapValues } from 'es-toolkit'

import { type AppError, ERRORS as BASE_ERRORS } from '~/shared/constants'

/**
 * True in dev and when running the compiled bundle locally via `local:start`.
 * Guards test-only routes and features that must not appear in production.
 *
 * NOTE: esbuild statically replaces `process.env.NODE_ENV` with `"production"`
 * at build time, so the NODE_ENV branch is dead in the bundle. The
 * `SERVE_STATIC` branch remains runtime-evaluated and carries the flag for
 * `local:start`. See the replit.md Gotchas section for details.
 */
export const IS_TEST_ENV =
  process.env.NODE_ENV !== 'production' || process.env.SERVE_STATIC === 'true'

/** True when the server should serve the compiled frontend from `dist/public`. */
export const IS_STATIC_SERVING =
  process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true'

type BaseErrors = typeof BASE_ERRORS

/**
 * Server-shaped error responses for ts-rest handlers. Each entry mirrors
 * `shared/errors.ts` but pre-wraps it as `{ status, body: { message } }`.
 */
export const ERRORS = mapValues(
  BASE_ERRORS,
  ({ status, message }: AppError) => ({
    status,
    body: { message },
  }),
) as {
  [K in keyof BaseErrors]: {
    status: BaseErrors[K]['status']
    body: { message: BaseErrors[K]['message'] }
  }
}
