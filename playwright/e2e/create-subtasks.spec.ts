import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import { goToCompletedPage, goToHomePage } from '@test/support/utils/navigation'
import { getTaskForm } from '@test/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

test.describe('Create Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('create a subtask, check appears in tree', async ({
    page,
    buildTask,
  }) => {
    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const subtask = buildTask('Subtask 1', TaskStatus.OPEN)
    const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)

    const rootTaskForm = getTaskForm(0)
    await test.step('Open new task form and fill root task', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await rootTaskForm.fillTaskForm(rootTask)
    })

    await test.step('Add subtask and create', async () => {
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const subtaskForm = getTaskForm(1)
      await subtaskForm.fillTaskForm(subtask)
      await subtaskForm.clickSubmitBtnCreate()

      await rootTaskForm.checkTaskFormSubtasks([subtask])
      await rootTaskForm.clickSubmitBtnCreate({
        newTasks: [rootTask, subtask],
      })

      await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      checkNumCalls({ create: 2, update: 0 })
    })

    await test.step('Edit root task, add a second subtask', async () => {
      await openTaskEditForm(rootTask)
      const editedRootTaskForm = getTaskForm(0)
      await editedRootTaskForm.checkTaskFormSubtasks([subtask])
      await editedRootTaskForm
        .locator(Selectors.TaskForm.ADD_SUBTASK_BTN)
        .click()

      const subtask2Form = getTaskForm(1)
      await subtask2Form.fillTaskForm(subtask2)
      await subtask2Form.clickSubmitBtnCreate()

      await editedRootTaskForm.checkTaskFormSubtasks([subtask, subtask2])
      await editedRootTaskForm.clickSubmitBtnUpdate({
        updatedTasks: [rootTask],
        newTasks: [subtask2],
      })

      await expandAndCheckTree({
        ...rootTask,
        subtasks: [subtask, subtask2],
      })
      checkNumCalls({ create: 3, update: 1 })
    })
  })

  test('create multiple subtasks, check appear in tree', async ({
    page,
    buildTask,
  }) => {
    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const subtask = buildTask('Subtask 1', TaskStatus.OPEN)
    const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)
    const subtask3 = buildTask('Subtask 3', TaskStatus.OPEN)

    const rootTaskForm = getTaskForm(0)
    await test.step('Open new task form and fill root task', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await rootTaskForm.fillTaskForm(rootTask)
    })

    await test.step('Add two subtasks and create', async () => {
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const subtaskForm = getTaskForm(1)
      await subtaskForm.fillTaskForm(subtask)
      await subtaskForm.clickSubmitBtnCreate()

      await rootTaskForm.checkTaskFormSubtasks([subtask])
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const subtask2Form = getTaskForm(1)
      await subtask2Form.fillTaskForm(subtask2)
      await subtask2Form.clickSubmitBtnCreate()

      await rootTaskForm.checkTaskFormSubtasks([subtask, subtask2])
      await rootTaskForm.clickSubmitBtnCreate({
        newTasks: [rootTask, subtask, subtask2],
      })

      await expandAndCheckTree({
        ...rootTask,
        subtasks: [subtask, subtask2],
      })
      checkNumCalls({ create: 3, update: 0 })
    })

    await test.step('Edit root task, add a third subtask', async () => {
      await openTaskEditForm(rootTask)
      const editedRootTaskForm = getTaskForm(0)
      await editedRootTaskForm.checkTaskFormSubtasks([subtask, subtask2])
      await editedRootTaskForm
        .locator(Selectors.TaskForm.ADD_SUBTASK_BTN)
        .click()
      const subtask3Form = getTaskForm(1)
      await subtask3Form.fillTaskForm(subtask3)
      await subtask3Form.clickSubmitBtnCreate()

      await editedRootTaskForm.checkTaskFormSubtasks([
        subtask,
        subtask2,
        subtask3,
      ])
      await editedRootTaskForm.clickSubmitBtnUpdate({
        updatedTasks: [rootTask],
        newTasks: [subtask3],
      })

      await expandAndCheckTree({
        ...rootTask,
        subtasks: [subtask, subtask2, subtask3],
      })
      checkNumCalls({ create: 4, update: 1 })
    })
  })

  test('create nested subtasks, ensure appear in tree', async ({
    page,
    buildTask,
  }) => {
    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const subtask = buildTask('Subtask 1', TaskStatus.OPEN)
    const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)
    const subtask3 = buildTask('Subtask 3', TaskStatus.OPEN)

    const rootTaskForm = getTaskForm(0)
    await test.step('Open new task form and fill root task', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await rootTaskForm.fillTaskForm(rootTask)
    })

    await test.step('Add subtask with two nested children', async () => {
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

      const subtaskForm = getTaskForm(1)
      await subtaskForm.fillTaskForm(subtask)
      await subtaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

      const subtask2Form = getTaskForm(2)
      await subtask2Form.fillTaskForm(subtask2)
      await subtask2Form.clickSubmitBtnCreate()

      await subtaskForm.checkTaskFormSubtasks([subtask2])
      await subtaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const subtask3Form = getTaskForm(2)
      await subtask3Form.fillTaskForm(subtask3)
      await subtask3Form.clickSubmitBtnCreate()

      await subtaskForm.checkTaskFormSubtasks([subtask2, subtask3])
      await subtaskForm.clickSubmitBtnCreate()
    })

    await test.step('Submit root task and verify nested tree', async () => {
      await rootTaskForm.checkTaskFormSubtasks([subtask, subtask2, subtask3])
      await rootTaskForm.clickSubmitBtnCreate({
        newTasks: [rootTask, subtask, subtask2, subtask3],
      })

      await expandAndCheckTree({
        ...rootTask,
        subtasks: [{ ...subtask, subtasks: [subtask2, subtask3] }],
      })
      checkNumCalls({ create: 4, update: 0 })
    })

    // TODO: test EDIT
  })

  test.describe('Adding subtasks to a completed task', () => {
    test('adding open subtask - save dialog appears, parent re-opens on home page', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const completedRootTask = {
        ...rootTask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask
      const subtask = buildTask('Subtask 1', TaskStatus.OPEN)

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const completedRootTaskForm = getTaskForm(0)
      await completedRootTaskForm.fillTaskForm(rootTask)
      await completedRootTaskForm
        .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
        .click()
      await completedRootTaskForm.clickSubmitBtnCreate({
        newTasks: [completedRootTask],
      })

      await test.step('Navigate to completed page and open the edit form', async () => {
        await goToCompletedPage()
        await openTaskEditForm(completedRootTask)
      })

      const editedCompletedRootTaskForm = getTaskForm(0)
      await test.step('Add an open subtask', async () => {
        await editedCompletedRootTaskForm
          .locator(Selectors.TaskForm.ADD_SUBTASK_BTN)
          .click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.fillTaskForm(subtask)
        await subtaskForm.clickSubmitBtnCreate()
      })

      const openRootTask = { ...completedRootTask, status: TaskStatus.OPEN }
      await test.step('Click Save - dialog warns that the parent will be re-opened', async () => {
        await editedCompletedRootTaskForm.clickSubmitBtnUpdate({
          newTasks: [subtask],
          updatedTasks: [openRootTask],
          confirmDialog: Selectors.SaveOpenSubtasksConfirmDialog.DIALOG,
        })
      })

      await test.step('Parent task is now visible on home page with the new open subtask, no longer on completed page', async () => {
        await expect(page.getByText(rootTask.name)).not.toBeAttached()
        await expect(page.getByText(subtask.name)).not.toBeAttached()
        await goToHomePage()
        await expandAndCheckTree({ ...openRootTask, subtasks: [subtask] })
      })
    })

    test('adding completed subtask - no dialog, parent stays on completed page', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const completedRootTask = {
        ...rootTask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask
      const subtask = buildTask('Subtask 1', TaskStatus.OPEN)
      const completedSubtask = {
        ...subtask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const completedRootTaskForm = getTaskForm(0)
      await completedRootTaskForm.fillTaskForm(rootTask)
      await completedRootTaskForm
        .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
        .click()
      await completedRootTaskForm.clickSubmitBtnCreate({
        newTasks: [completedRootTask],
      })

      await goToCompletedPage()
      await openTaskEditForm(completedRootTask)

      const editedCompletedRootTaskForm = getTaskForm(0)
      await test.step('Add a completed subtask', async () => {
        await editedCompletedRootTaskForm
          .locator(Selectors.TaskForm.ADD_SUBTASK_BTN)
          .click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.fillTaskForm(subtask)
        await subtaskForm
          .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
          .click()
        await subtaskForm.clickSubmitBtnCreate()

        await editedCompletedRootTaskForm.setTaskFormSubtaskSettings({
          autoHideCompleted: false,
        })
        await editedCompletedRootTaskForm.clickSubmitBtnUpdate({
          updatedTasks: [completedRootTask],
          newTasks: [completedSubtask],
        })
      })

      await test.step('Completed page still shows parent task with its new completed subtask', async () => {
        await expandAndCheckTree({
          ...completedRootTask,
          subtasks: [completedSubtask],
        })
      })
    })
  })
})
