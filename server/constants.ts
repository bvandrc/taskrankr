import { mapValues } from 'es-toolkit'

import type { AppError } from '~/shared/errors'
import { ERRORS as BASE_ERRORS } from '~/shared/errors'

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
