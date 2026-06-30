import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { getPage } from '@test/support/page-context'
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

test.describe('Completed Tasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('complete task via New Task Form — not in main tree, is on completed page', async ({
    taskName,
  }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Test Task'),
      status: TaskStatus.PINNED,
    }
    const completedTask = { ...task, status: TaskStatus.COMPLETED }

    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), task)
    await getTaskForm(0)
      .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
      .click()
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [completedTask],
    })
    checkNumCalls({ create: 1, update: 0 })

    await checkCompletedPage([completedTask])
  })

  test('complete task via Edit Form — not in main tree, is on completed page', async ({
    taskName,
  }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Test Task'),
      status: TaskStatus.PINNED,
    }
    const completedTask = { ...task, status: TaskStatus.COMPLETED }

    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), task)
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [{ ...task, status: TaskStatus.PINNED }],
    })
    checkNumCalls({ create: 1, update: 0 })

    await openTaskEditForm(task)
    await getTaskForm(0)
      .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
      .click()
    await clickSubmitBtnUpdate(getTaskForm(0), {
      updatedTasks: [completedTask],
    })
    checkNumCalls({ create: 1, update: 1 })

    await checkCompletedPage([completedTask])
  })

  test('complete task via Change Status Dialog — not in main tree, is on completed page', async ({
    taskName,
  }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Test Task'),
      status: TaskStatus.PINNED,
    }
    const completedTask = { ...task, status: TaskStatus.COMPLETED }

    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), task)
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [{ ...task, status: TaskStatus.PINNED }],
    })
    checkNumCalls({ create: 1, update: 0 })

    await changeStatusViaStatusChangeDialog(task, TaskStatus.COMPLETED)
    checkNumCalls({ create: 1, update: 1 })

    await checkCompletedPage([completedTask])
  })
})
