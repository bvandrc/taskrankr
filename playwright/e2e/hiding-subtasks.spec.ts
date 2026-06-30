import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'

test.describe('Hiding Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn, taskName }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)

    const rootTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Task'),
      status: TaskStatus.PINNED,
    }
    const openSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Open Subtask'),
      status: TaskStatus.OPEN,
    }
    const completedSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Completed Subtask'),
      status: TaskStatus.COMPLETED,
    }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(0)
    await fillTaskForm(form0, rootTask)
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(1), openSubtask)
    await clickSubmitBtnCreate(getTaskForm(1))
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    const form1 = getTaskForm(1)
    await fillTaskForm(form1, completedSubtask)
    await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
    await clickSubmitBtnCreate(form1)

    // completed subtask is hidden by default (autoHideCompleted: true)
    await checkTaskFormSubtasks(form0, [openSubtask])
    await clickSubmitBtnCreate(form0, {
      newTasks: [rootTask, openSubtask, completedSubtask],
    })
    checkNumCalls({ create: 3, update: 0 })

    await openTaskEditForm(rootTask)
  })

  test('shows and hides hidden subtasks via the toggle button', async ({
    taskName,
  }) => {
    const openSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Open Subtask'),
      status: TaskStatus.OPEN,
    }
    const completedSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Completed Subtask'),
      status: TaskStatus.COMPLETED,
    }
    const form0 = getTaskForm(0)

    await checkTaskFormSubtasks(form0, [openSubtask])
    await form0.locator(Selectors.TaskForm.SUBTASK_SETTINGS_BTN).click()
    await form0.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await checkTaskFormSubtasks(form0, [openSubtask, completedSubtask])

    await form0.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await checkTaskFormSubtasks(form0, [openSubtask])
  })

  test('preserves show-hidden state after saving a subtask form and returning to parent', async ({
    taskName,
  }) => {
    const openSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Open Subtask'),
      status: TaskStatus.OPEN,
    }
    const completedSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Completed Subtask'),
      status: TaskStatus.COMPLETED,
    }
    const form0 = getTaskForm(0)

    await form0.locator(Selectors.TaskForm.SUBTASK_SETTINGS_BTN).click()
    await form0.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await checkTaskFormSubtasks(form0, [openSubtask, completedSubtask])
    await form0.locator(Selectors.TaskForm.EDIT_SUBTASK_BTN).first().click()

    // Save without changes — returns to parent with show-hidden preserved
    await clickSubmitBtnUpdate(getTaskForm(1))
    await checkTaskFormSubtasks(form0, [openSubtask, completedSubtask])
  })

  test('preserves show-hidden state after cancelling a subtask form and returning to parent', async ({
    taskName,
  }) => {
    const openSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Open Subtask'),
      status: TaskStatus.OPEN,
    }
    const completedSubtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Completed Subtask'),
      status: TaskStatus.COMPLETED,
    }
    const form0 = getTaskForm(0)

    await form0.locator(Selectors.TaskForm.SUBTASK_SETTINGS_BTN).click()
    await form0.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await checkTaskFormSubtasks(form0, [openSubtask, completedSubtask])
    await form0.locator(Selectors.TaskForm.EDIT_SUBTASK_BTN).first().click()

    await getTaskForm(1).locator(Selectors.TaskForm.CANCEL_BTN).click()
    await checkTaskFormSubtasks(form0, [openSubtask, completedSubtask])
  })
})
