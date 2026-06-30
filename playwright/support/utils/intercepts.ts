import { expect } from '@playwright/test'

import type { Task } from '../../../shared/schema'
import { Selectors } from '../constants'
import { waitForCreate, waitForUpdate } from '../fixtures'
import { getIsLoggedIn, getPage, getRequestTracker } from '../page-context'
import { checkTasksDontExist, checkTasksExist } from './api'

export type CreatedTask = Pick<Task, 'name' | 'status'> &
  Partial<Pick<Task, 'priority' | 'ease' | 'enjoyment' | 'time' | 'schedule'>>

export type SubmitBtnArgs = {
  newTasks?: CreatedTask[]
  updatedTasks?: CreatedTask[]
  confirmDialog?: string
}

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
    : Object.fromEntries(
        Object.entries(expected).map(([k, v]) => [
          k,
          v !== undefined ? 0 : undefined,
        ]),
      )

  if (effectiveExpected.create !== undefined)
    expect(tracker.create, 'create call count').toBe(effectiveExpected.create)
  if (effectiveExpected.update !== undefined)
    expect(tracker.update, 'update call count').toBe(effectiveExpected.update)
  if (effectiveExpected.delete !== undefined)
    expect(tracker.delete, 'delete call count').toBe(effectiveExpected.delete)
  if (effectiveExpected.updateSettings !== undefined)
    expect(tracker.updateSettings, 'updateSettings call count').toBe(
      effectiveExpected.updateSettings,
    )
}

export async function waitForCreateAndVerify(
  tasks: CreatedTask[],
): Promise<void> {
  await maybeWaitForResponses('create', tasks.length, 201)
  await checkTasksExist(tasks)
}

export async function waitForUpdateAndVerify(
  tasks: CreatedTask[],
): Promise<void> {
  await maybeWaitForResponses('update', tasks.length, 200)
  await checkTasksExist(tasks)
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
  await checkTasksDontExist(tasks)
}
