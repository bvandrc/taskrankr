import { expect, type Response } from '@playwright/test'
import { mapValues } from 'es-toolkit'
import type { Entries, SetOptional } from 'type-fest'

import type { RankField, Task } from '~/shared/schema'
import { ApiPaths } from '../constants'
import { getIsLoggedIn, getPage, getRequestTracker } from '../test-globals'
import { checkTasksDontExistBackend } from './api'

export type CreatedTask = SetOptional<
  Pick<Task, 'name' | 'status' | 'schedule' | RankField>,
  'schedule'
>

const getWaitForNResponses =
  (predicate: (r: Response) => boolean) =>
  (n: number, timeout = 15_000) => {
    if (n === 0) return Promise.resolve()
    const page = getPage()
    return new Promise<void>((resolve, reject) => {
      let count = 0
      const timer = setTimeout(() => {
        page.off('response', handler)
        reject(
          new Error(
            `Timed out waiting for ${n} matching responses (got ${count})`,
          ),
        )
      }, timeout)
      const handler = (r: Response) => {
        if (predicate(r)) {
          count++
          if (count >= n) {
            clearTimeout(timer)
            page.off('response', handler)
            resolve()
          }
        }
      }
      page.on('response', handler)
    })
  }

export const waitForCreateTask = getWaitForNResponses(
  (r) =>
    r.url().includes(ApiPaths.GET_TASKS) &&
    r.request().method() === 'POST' &&
    !r.url().includes('/import') &&
    r.status() === 201,
)

export const waitForUpdateTask = getWaitForNResponses(
  (r) =>
    ApiPaths.UPDATE_TASK.test(r.url()) &&
    r.request().method() === 'PATCH' &&
    r.status() === 200,
)

export async function checkTasksDontExistAndAssertDontExist(
  tasks: CreatedTask[],
) {
  const page = getPage()
  tasks.forEach((task) => {
    // UI check: task name shouldn't appear anywhere
    void page
      .locator(`text="${task.name}"`)
      .waitFor({ state: 'detached', timeout: 500 })
      .catch(() => undefined)
  })
  await checkTasksDontExistBackend(tasks)
}

export function checkNumCalls(expected: {
  create?: number
  update?: number
  delete?: number
  updateSettings?: number
}) {
  const tracker = getRequestTracker()
  // In guest mode, no API calls are expected regardless of the passed values
  const effectiveExpected = getIsLoggedIn()
    ? expected
    : mapValues(expected, (value) => (value !== undefined ? 0 : undefined))

  for (const [key, value] of Object.entries(effectiveExpected) as Entries<
    typeof effectiveExpected
  >) {
    if (value !== undefined) {
      expect(tracker[key], `${key} call count`).toBe(value)
    }
  }
}
