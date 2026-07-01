import { expect } from '@playwright/test'
import { mapValues } from 'es-toolkit'
import type { Entries, SetOptional } from 'type-fest'

import type { RankField, Task } from '~/shared/schema'
import { Selectors } from '../constants'
import { waitForCreateTask, waitForUpdateTask } from '../fixtures'
import { getIsLoggedIn, getPage, getRequestTracker } from '../test-globals'
import { checkTasksDontExistBackend, checkTasksExistBackend } from './api'

async function maybeWaitForResponses(
  waiter: (count: number) => Promise<void>,
  count: number,
) {
  if (getIsLoggedIn() && count > 0) {
    await waiter(count)
  }
  await expect(getPage().locator(Selectors.Toasts.ERROR)).not.toBeVisible()
}

export type CreatedTask = SetOptional<
  Pick<Task, 'name' | 'status' | 'schedule' | RankField>,
  'schedule'
>

export async function waitForCreateAndVerify(tasks: CreatedTask[]) {
  await maybeWaitForResponses(waitForCreateTask, tasks.length)
  await checkTasksExistBackend(tasks)
}

export async function waitForUpdateAndVerify(tasks: CreatedTask[]) {
  await maybeWaitForResponses(waitForUpdateTask, tasks.length)
  await checkTasksExistBackend(tasks)
}

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
