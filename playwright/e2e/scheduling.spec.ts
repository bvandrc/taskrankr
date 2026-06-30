import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { getPage } from '@test/support/test-globals'
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

test.describe('Scheduling', () => {
  const today = new Date()

  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('create a task with a due date, verify due badge displays on task card', async ({
    page,
    taskName,
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
    await fillTaskForm(getTaskForm(0), taskWithDueDate)
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [taskWithDueDate],
    })
    checkNumCalls({ create: 1, update: 0 })

    await expandAndCheckTree(taskWithDueDate)

    await openTaskEditForm(taskWithDueDate)
    await openMoreSection(getTaskForm(0))
    await page.locator(Selectors.TaskForm.Schedule.CLEAR_DUE_AT_BTN).click()
    await clickSubmitBtnUpdate(getTaskForm(0), {
      updatedTasks: [baseTask],
    })
    checkNumCalls({ create: 1, update: 1 })

    await expandAndCheckTree(baseTask)
  })

  test('task with hideUntil in the future is hidden from home page', async ({
    taskName,
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

    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), hiddenTask)
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [hiddenTask],
    })

    await expect(getPage().getByText(hiddenTask.name)).not.toBeAttached()
  })
})
