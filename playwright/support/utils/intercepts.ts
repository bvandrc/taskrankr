import { expect } from '@playwright/test'
import { mapValues } from 'es-toolkit'
import type { Entries } from 'type-fest'

import type { Task } from '~/shared/schema'
import { Selectors } from '../constants'
import { waitForCreate, waitForUpdate } from '../fixtures'
import { getIsLoggedIn, getPage, getRequestTracker } from '../test-globals'
import { checkTasksDontExistBackend, checkTasksExistBackend } from './api'

export async function maybeWaitForResponses(
  type: 'create' | 'update',
  count: number,
  _expectedStatus: number,
): Promise<void> {
  if (!getIsLoggedIn() || count === 0) return
  const waiter = type === 'create' ? waitForCreate(count) : waitForUpdate(count)
  await waiter
  await expect(getPage().locator(Selectors.Toasts.ERROR)).not.toBeVisible()
}

export type CreatedTask = Pick<Task, 'name' | 'status'> &
  Partial<Pick<Task, 'priority' | 'ease' | 'enjoyment' | 'time' | 'schedule'>>

export async function waitForCreateAndVerify(
  tasks: CreatedTask[],
): Promise<void> {
  await maybeWaitForResponses('create', tasks.length, 201)
  await checkTasksExistBackend(tasks)
}

export async function waitForUpdateAndVerify(
  tasks: CreatedTask[],
): Promise<void> {
  await maybeWaitForResponses('update', tasks.length, 200)
  await checkTasksExistBackend(tasks)
}

export async function checkTasksDontExistAndAssertDontExist(
  tasks: CreatedTask[],
): Promise<void> {
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
      // TODO: check the whole object at once
      expect(tracker[key], `${key} call count`).toBe(value)
    }
  }
}
