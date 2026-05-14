import { mapValues } from 'es-toolkit'

import type { AppError } from '~/shared/errors'
import { ERRORS as SHARED_ERRORS } from '~/shared/errors'

/** Wraps a shared `AppError` in the ts-rest response shape. */
export const toHttpError = <E extends AppError>({
  status,
  message,
}: E): { status: E['status']; body: { message: E['message'] } } => ({
  status,
  body: { message },
})

/**
 * Server-shaped error responses for ts-rest handlers. Each entry mirrors
 * `shared/errors.ts` but pre-wraps it as `{ status, body: { message } }`.
 */
export const ERRORS = mapValues(SHARED_ERRORS, toHttpError) as {
  [K in keyof typeof SHARED_ERRORS]: ReturnType<
    typeof toHttpError<(typeof SHARED_ERRORS)[K]>
  >
}
