import { Routes } from '@client/lib/constants'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
import {
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  checkCompletedPage,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

import { TaskStatus } from '~/shared/schema'

test.describe('Completed Tasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('complete task via New Task Form — not in main tree, is on completed page', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Test Task'),
      status: TaskStatus.PINNED,
    }
    const completedTask = { ...task, status: TaskStatus.COMPLETED }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, task)
    await getTaskForm(page, 0)
      .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
      .click()
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [completedTask],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })

    await checkCompletedPage(page, isLoggedIn, [completedTask])
  })

  test('complete task via Edit Form — not in main tree, is on completed page', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Test Task'),
      status: TaskStatus.PINNED,
    }
    const completedTask = { ...task, status: TaskStatus.COMPLETED }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, task)
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [{ ...task, status: TaskStatus.PINNED }],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })

    await openTaskEditForm(page, task)
    await getTaskForm(page, 0)
      .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
      .click()
    await clickSubmitBtnUpdate(getTaskForm(page, 0), page, isLoggedIn, {
      updatedTasks: [completedTask],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 1 })

    await checkCompletedPage(page, isLoggedIn, [completedTask])
  })

  test('complete task via Change Status Dialog — not in main tree, is on completed page', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Test Task'),
      status: TaskStatus.PINNED,
    }
    const completedTask = { ...task, status: TaskStatus.COMPLETED }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, task)
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [{ ...task, status: TaskStatus.PINNED }],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })

    await changeStatusViaStatusChangeDialog(
      page,
      isLoggedIn,
      task,
      TaskStatus.COMPLETED,
    )
    checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 1 })

    await checkCompletedPage(page, isLoggedIn, [completedTask])
  })
})
