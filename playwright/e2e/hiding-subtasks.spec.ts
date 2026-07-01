import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
import { getTaskForm } from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'

test.describe('Hiding Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn, buildTask }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)

    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const openSubtask = buildTask('Open Subtask', TaskStatus.OPEN)
    const completedSubtask = buildTask(
      'Completed Subtask',
      TaskStatus.COMPLETED,
    )

    await test.step('Create rootTask with one open and one completed subtask; auto-hide completed is enabled, so the completed subtask is hidden in the form and tree until "Show Hidden" is toggled.', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const rootTaskForm = getTaskForm(0)
      await rootTaskForm.fillTaskForm(rootTask)
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const openSubtaskForm = getTaskForm(1)
      await openSubtaskForm.fillTaskForm(openSubtask)
      await openSubtaskForm.clickSubmitBtnCreate()
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const completedSubtaskForm = getTaskForm(1)
      await completedSubtaskForm.fillTaskForm(completedSubtask)
      await completedSubtaskForm
        .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
        .click()
      await completedSubtaskForm.clickSubmitBtnCreate()

      // completed subtask is hidden by default (autoHideCompleted: true)
      await rootTaskForm.checkTaskFormSubtasks([openSubtask])
      await rootTaskForm.clickSubmitBtnCreate({
        newTasks: [rootTask, openSubtask, completedSubtask],
      })
      checkNumCalls({ create: 3, update: 0 })
    })

    await openTaskEditForm(rootTask)
  })

  test('shows and hides hidden subtasks via the toggle button', async ({
    buildTask,
  }) => {
    const openSubtask = buildTask('Open Subtask', TaskStatus.OPEN)
    const completedSubtask = buildTask(
      'Completed Subtask',
      TaskStatus.COMPLETED,
    )

    const rootTaskForm = getTaskForm(0)
    await rootTaskForm.checkTaskFormSubtasks([openSubtask])
    await rootTaskForm.locator(Selectors.TaskForm.SUBTASK_SETTINGS_BTN).click()
    await rootTaskForm.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await rootTaskForm.checkTaskFormSubtasks([openSubtask, completedSubtask])

    await rootTaskForm.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await rootTaskForm.checkTaskFormSubtasks([openSubtask])
  })

  test('preserves show-hidden state after saving a subtask form and returning to parent', async ({
    buildTask,
  }) => {
    const openSubtask = buildTask('Open Subtask', TaskStatus.OPEN)
    const completedSubtask = buildTask(
      'Completed Subtask',
      TaskStatus.COMPLETED,
    )

    const rootTaskForm = getTaskForm(0)
    await rootTaskForm.locator(Selectors.TaskForm.SUBTASK_SETTINGS_BTN).click()
    await rootTaskForm.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await rootTaskForm.checkTaskFormSubtasks([openSubtask, completedSubtask])
    await rootTaskForm
      .locator(Selectors.TaskForm.EDIT_SUBTASK_BTN)
      .first()
      .click()

    // Save without changes — returns to parent with show-hidden preserved
    const openSubtaskForm = getTaskForm(1)
    await openSubtaskForm.clickSubmitBtnUpdate()
    // The parent form should still have show-hidden on
    await rootTaskForm.checkTaskFormSubtasks([openSubtask, completedSubtask])
  })

  test('preserves show-hidden state after cancelling a subtask form and returning to parent', async ({
    buildTask,
  }) => {
    const openSubtask = buildTask('Open Subtask', TaskStatus.OPEN)
    const completedSubtask = buildTask(
      'Completed Subtask',
      TaskStatus.COMPLETED,
    )

    const rootTaskForm = getTaskForm(0)
    await rootTaskForm.locator(Selectors.TaskForm.SUBTASK_SETTINGS_BTN).click()
    await rootTaskForm.locator(Selectors.TaskForm.SHOW_HIDDEN_BTN).click()
    await rootTaskForm.checkTaskFormSubtasks([openSubtask, completedSubtask])
    await rootTaskForm
      .locator(Selectors.TaskForm.EDIT_SUBTASK_BTN)
      .first()
      .click()

    const openSubtaskForm = getTaskForm(1)
    await openSubtaskForm.locator(Selectors.TaskForm.CANCEL_BTN).click()
    // The parent form should still have show-hidden on
    await rootTaskForm.checkTaskFormSubtasks([openSubtask, completedSubtask])
  })
})
