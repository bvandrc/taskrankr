import { mapValues } from 'es-toolkit'

import { type AppError, ERRORS as BASE_ERRORS } from '~/shared/constants'

export const IS_PROD = process.env.NODE_ENV === 'production'

// Default true; opt-out via SERVE_STATIC=false (dev only).
// IS_PROD is folded in so the compiled bundle always serves static files
// without needing the env var — esbuild bakes IS_PROD=true.
export const SERVE_STATIC = process.env.SERVE_STATIC !== 'false' || IS_PROD

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
