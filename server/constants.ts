import type { AppError } from '~/shared/errors'
import { ERRORS as SHARED_ERRORS } from '~/shared/errors'

/** Wraps a shared `AppError` in the ts-rest response shape. */
export const toHttpError = <S extends number>(
  error: AppError & { status: S },
) =>
  ({ status: error.status, body: { message: error.message } }) as {
    status: S
    body: { message: string }
  }

/**
 * Server-shaped error responses for ts-rest handlers. Each entry mirrors
 * `shared/errors.ts` but pre-wraps it as `{ status, body: { message } }`.
 */
export const ERRORS = {
  TASK_NOT_FOUND: toHttpError(SHARED_ERRORS.TASK_NOT_FOUND),
  PARENT_NOT_FOUND: toHttpError(SHARED_ERRORS.PARENT_NOT_FOUND),
  TIME_SPENT_REQUIRED: toHttpError(SHARED_ERRORS.TIME_SPENT_REQUIRED),
  INCOMPLETE_SUBTASKS: toHttpError(SHARED_ERRORS.INCOMPLETE_SUBTASKS),
} as const
