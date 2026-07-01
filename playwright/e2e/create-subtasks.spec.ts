import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import { goToCompletedPage, goToHomePage } from '@test/support/utils/navigation'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
  setTaskFormSubtaskSettings,
} from '@test/support/utils/task-form'
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

    const form0 = getTaskForm(0)
    await test.step('Open new task form and fill root task', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await fillTaskForm(form0, rootTask)
    })

    await test.step('Add subtask and create', async () => {
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask)
      await clickSubmitBtnCreate(getTaskForm(1))

      await checkTaskFormSubtasks(form0, [subtask])
      await clickSubmitBtnCreate(form0, { newTasks: [rootTask, subtask] })

      await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      checkNumCalls({ create: 2, update: 0 })
    })

    await test.step('Edit root task, add a second subtask', async () => {
      await openTaskEditForm(rootTask)
      const editForm0 = getTaskForm(0)
      await checkTaskFormSubtasks(editForm0, [subtask])
      await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

      await fillTaskForm(getTaskForm(1), subtask2)
      await clickSubmitBtnCreate(getTaskForm(1))

      await checkTaskFormSubtasks(editForm0, [subtask, subtask2])
      await clickSubmitBtnUpdate(editForm0, {
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

    const form0 = getTaskForm(0)
    await test.step('Open new task form and fill root task', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await fillTaskForm(form0, rootTask)
    })

    await test.step('Add two subtasks and create', async () => {
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask)
      await clickSubmitBtnCreate(getTaskForm(1))

      await checkTaskFormSubtasks(form0, [subtask])
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask2)
      await clickSubmitBtnCreate(getTaskForm(1))

      await checkTaskFormSubtasks(form0, [subtask, subtask2])
      await clickSubmitBtnCreate(form0, {
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
      const editForm0 = getTaskForm(0)
      await checkTaskFormSubtasks(editForm0, [subtask, subtask2])
      await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask3)
      await clickSubmitBtnCreate(getTaskForm(1))

      await checkTaskFormSubtasks(editForm0, [subtask, subtask2, subtask3])
      await clickSubmitBtnUpdate(editForm0, {
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

    const form0 = getTaskForm(0)
    await test.step('Open new task form and fill root task', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await fillTaskForm(form0, rootTask)
    })

    await test.step('Add subtask with two nested children', async () => {
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

      const form1 = getTaskForm(1)
      await fillTaskForm(form1, subtask)
      await form1.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

      await fillTaskForm(getTaskForm(2), subtask2)
      await clickSubmitBtnCreate(getTaskForm(2))

      await checkTaskFormSubtasks(form1, [subtask2])
      await form1.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(2), subtask3)
      await clickSubmitBtnCreate(getTaskForm(2))

      await checkTaskFormSubtasks(form1, [subtask2, subtask3])
      await clickSubmitBtnCreate(form1)
    })

    await test.step('Submit root task and verify nested tree', async () => {
      await checkTaskFormSubtasks(form0, [subtask, subtask2, subtask3])
      await clickSubmitBtnCreate(form0, {
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
      const form0 = getTaskForm(0)
      await fillTaskForm(form0, rootTask)
      await form0.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form0, { newTasks: [completedRootTask] })

      await test.step('Navigate to completed page and open the edit form', async () => {
        await goToCompletedPage()
        await openTaskEditForm(completedRootTask)
      })

      const editForm0 = getTaskForm(0)
      await test.step('Add an open subtask', async () => {
        await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(1), subtask)
        await clickSubmitBtnCreate(getTaskForm(1))
      })

      const openRootTask = { ...completedRootTask, status: TaskStatus.OPEN }
      await test.step('Click Save - dialog warns that the parent will be re-opened', async () => {
        await clickSubmitBtnUpdate(editForm0, {
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
      const form0 = getTaskForm(0)
      await fillTaskForm(form0, rootTask)
      await form0.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form0, { newTasks: [completedRootTask] })

      await goToCompletedPage()
      await openTaskEditForm(completedRootTask)

      const editForm0 = getTaskForm(0)
      await test.step('Add a completed subtask', async () => {
        await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const form1 = getTaskForm(1)
        await fillTaskForm(form1, subtask)
        await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnCreate(form1)

        await setTaskFormSubtaskSettings(editForm0, {
          autoHideCompleted: false,
        })
        await clickSubmitBtnUpdate(editForm0, {
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
