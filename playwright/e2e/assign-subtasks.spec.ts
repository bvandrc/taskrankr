import { Routes } from '~/client/lib/constants'
import { Priority, TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
import {
  assignSubtask,
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

test.describe('Assign Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('assign an existing orphaned task as a subtask of a task', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const rootTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Task'),
      status: TaskStatus.PINNED,
    }
    const orphanTask = {
      ...DefaultTaskFields,
      priority: Priority.HIGH,
      name: taskName('E2E Orphan Task 1'),
      status: TaskStatus.PINNED,
    }
    const orphanTask2 = {
      ...DefaultTaskFields,
      priority: Priority.MEDIUM,
      name: taskName('E2E Orphan Task 2'),
      status: TaskStatus.PINNED,
    }
    const newSubtask = {
      ...DefaultTaskFields,
      priority: Priority.LOW,
      name: taskName('E2E Brand New Subtask'),
      status: TaskStatus.OPEN,
    }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, orphanTask)
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [orphanTask],
    })

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, orphanTask2)
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [orphanTask2],
    })

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(page, 0)
    await fillTaskForm(form0, page, isLoggedIn, rootTask)
    await assignSubtask(form0, page, orphanTask)

    await checkTaskFormSubtasks(getTaskForm(page, 0), [orphanTask])
    await getTaskForm(page, 0)
      .locator(Selectors.TaskForm.ADD_SUBTASK_BTN)
      .click()
    await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, newSubtask)
    await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

    await checkTaskFormSubtasks(getTaskForm(page, 0), [orphanTask, newSubtask])
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [rootTask, newSubtask],
      updatedTasks: [orphanTask],
    })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [orphanTask, newSubtask],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 4, update: 1 })

    await openTaskEditForm(page, rootTask)
    const editForm0 = getTaskForm(page, 0)
    await checkTaskFormSubtasks(editForm0, [orphanTask, newSubtask])
    await assignSubtask(editForm0, page, orphanTask2)
    await checkTaskFormSubtasks(getTaskForm(page, 0), [
      orphanTask,
      orphanTask2,
      newSubtask,
    ])
    await clickSubmitBtnUpdate(getTaskForm(page, 0), page, isLoggedIn, {
      updatedTasks: [rootTask, orphanTask2],
    })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [orphanTask, newSubtask, orphanTask2],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 4, update: 3 })
  })
})
