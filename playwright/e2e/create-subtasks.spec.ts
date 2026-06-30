import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
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
    taskName,
  }) => {
    const rootTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Level Task'),
      status: TaskStatus.PINNED,
    }
    const subtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 1'),
      status: TaskStatus.OPEN,
    }
    const subtask2 = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 2'),
      status: TaskStatus.OPEN,
    }

    // STEP: Open new task form and fill root task
    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(0)
    await fillTaskForm(form0, rootTask)

    // STEP: Add subtask and create
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(1), subtask)
    await clickSubmitBtnCreate(getTaskForm(1))

    await checkTaskFormSubtasks(form0, [subtask])
    await clickSubmitBtnCreate(form0, {
      newTasks: [rootTask, subtask],
    })

    await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
    checkNumCalls({ create: 2, update: 0 })

    // STEP: Edit root task, add a second subtask
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

  test('create multiple subtasks, check appear in tree', async ({
    page,
    taskName,
  }) => {
    const rootTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Level Task'),
      status: TaskStatus.PINNED,
    }
    const subtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 1'),
      status: TaskStatus.OPEN,
    }
    const subtask2 = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 2'),
      status: TaskStatus.OPEN,
    }
    const subtask3 = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 3'),
      status: TaskStatus.OPEN,
    }

    // STEP: Open new task form and fill root task
    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(0)
    await fillTaskForm(form0, rootTask)

    // STEP: Add two subtasks and create
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

    // STEP: Edit root task, add a third subtask
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

  test('create nested subtasks, ensure appear in tree', async ({
    page,
    taskName,
  }) => {
    const rootTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Level Task'),
      status: TaskStatus.PINNED,
    }
    const subtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 1'),
      status: TaskStatus.OPEN,
    }
    const subtask2 = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 2'),
      status: TaskStatus.OPEN,
    }
    const subtask3 = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask 3'),
      status: TaskStatus.OPEN,
    }

    // STEP: Open new task form and fill root task
    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(0)
    await fillTaskForm(form0, rootTask)

    // STEP: Add subtask with two nested children
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

    // STEP: Submit root task and verify nested tree
    await checkTaskFormSubtasks(form0, [subtask, subtask2, subtask3])
    await clickSubmitBtnCreate(form0, {
      newTasks: [rootTask, subtask, subtask2, subtask3],
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [{ ...subtask, subtasks: [subtask2, subtask3] }],
    })
    checkNumCalls({ create: 4, update: 0 })

    // TODO: test EDIT
  })

  test.describe('Adding subtasks to a completed task', () => {
    test('adding open subtask — save dialog appears, parent re-opens on home page', async ({
      page,
      taskName,
    }) => {
      const rootTask = {
        ...DefaultTaskFields,
        name: taskName('E2E Root Level Task'),
        status: TaskStatus.PINNED,
      }
      const completedRootTask = { ...rootTask, status: TaskStatus.COMPLETED }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask 1'),
        status: TaskStatus.OPEN,
      }

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const form0 = getTaskForm(0)
      await fillTaskForm(form0, rootTask)
      await form0.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form0, {
        newTasks: [completedRootTask],
      })

      // STEP: Navigate to completed page and open the edit form
      await goToCompletedPage()
      await openTaskEditForm(completedRootTask)

      // STEP: Add an open subtask
      const editForm0 = getTaskForm(0)
      await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask)
      await clickSubmitBtnCreate(getTaskForm(1))

      // STEP: Click Save — dialog warns that the parent will be re-opened
      const openRootTask = { ...completedRootTask, status: TaskStatus.OPEN }
      await clickSubmitBtnUpdate(editForm0, {
        newTasks: [subtask],
        updatedTasks: [openRootTask],
        confirmDialog: Selectors.SaveOpenSubtasksConfirmDialog.DIALOG,
      })

      // STEP: Parent task is now visible on home page with the new open subtask, no longer on completed page
      await expect(page.getByText(rootTask.name)).not.toBeAttached()
      await expect(page.getByText(subtask.name)).not.toBeAttached()
      await goToHomePage()
      await expandAndCheckTree({ ...openRootTask, subtasks: [subtask] })
    })

    test('adding completed subtask — no dialog, parent stays on completed page', async ({
      page,
      taskName,
    }) => {
      const rootTask = {
        ...DefaultTaskFields,
        name: taskName('E2E Root Level Task'),
        status: TaskStatus.PINNED,
      }
      const completedRootTask = { ...rootTask, status: TaskStatus.COMPLETED }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask 1'),
        status: TaskStatus.OPEN,
      }
      const completedSubtask = { ...subtask, status: TaskStatus.COMPLETED }

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const form0 = getTaskForm(0)
      await fillTaskForm(form0, rootTask)
      await form0.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form0, {
        newTasks: [completedRootTask],
      })

      await goToCompletedPage()
      await openTaskEditForm(completedRootTask)

      // STEP: Add a completed subtask
      const editForm0 = getTaskForm(0)
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

      // STEP: Completed page still shows parent task with its new completed subtask
      await expandAndCheckTree({
        ...completedRootTask,
        subtasks: [completedSubtask],
      })
    })
  })
})
