import { Routes } from '@client/lib/constants'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
import {
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
  openMoreSection,
} from '@test/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

import { TaskStatus } from '~/shared/schema'

test.describe('Scheduling', () => {
  const today = new Date()

  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('create a task with a due date, verify due badge displays on task card', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const baseTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Scheduled Task'),
      status: TaskStatus.PINNED,
    }
    const taskWithDueDate = {
      ...baseTask,
      schedule: {
        dueAt: new Date(today.getFullYear(), today.getMonth() + 1, 15),
      },
    }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, taskWithDueDate)
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [taskWithDueDate],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })

    await expandAndCheckTree(page, taskWithDueDate)

    await openTaskEditForm(page, taskWithDueDate)
    await openMoreSection(getTaskForm(page, 0))
    await page.locator(Selectors.TaskForm.Schedule.CLEAR_DUE_AT_BTN).click()
    await clickSubmitBtnUpdate(getTaskForm(page, 0), page, isLoggedIn, {
      updatedTasks: [baseTask],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 1 })

    await expandAndCheckTree(page, baseTask)
  })

  test('task with hideUntil in the future is hidden from home page', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const baseTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Hidden Task'),
      status: TaskStatus.PINNED,
    }
    const hiddenTask = {
      ...baseTask,
      schedule: {
        hideUntil: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
        ),
      },
    }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, hiddenTask)
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [hiddenTask],
    })

    await expect(page.getByText(hiddenTask.name)).not.toBeAttached()
  })
})
