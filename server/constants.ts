import { mapValues } from 'es-toolkit'

import type { AppError } from '~/shared/errors'
import { ERRORS as SHARED_ERRORS } from '~/shared/errors'

type SharedErrors = typeof SHARED_ERRORS

/**
 * Server-shaped error responses for ts-rest handlers. Each entry mirrors
 * `shared/errors.ts` but pre-wraps it as `{ status, body: { message } }`.
 */
export const ERRORS = mapValues(
  SHARED_ERRORS,
  ({ status, message }: AppError) => ({
    status,
    body: { message },
  }),
) as {
  [K in keyof SharedErrors]: {
    status: SharedErrors[K]['status']
    body: { message: SharedErrors[K]['message'] }
  }
}
