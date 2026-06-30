import { Routes } from '../../client/src/lib/constants'
import { TaskStatus } from '../../shared/schema'
import { DefaultTaskFields, Selectors } from '../support/constants'
import { expect, test } from '../support/fixtures'
import { checkNumCalls } from '../support/utils/intercepts'
import { goToCompletedPage, goToHomePage } from '../support/utils/navigation'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
  setTaskFormSubtaskSettings,
} from '../support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '../support/utils/task-tree'

test.describe('Create Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('create a subtask, check appears in tree', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
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

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(page, 0)
    await fillTaskForm(form0, page, isLoggedIn, rootTask)

    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
    await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

    await checkTaskFormSubtasks(form0, [subtask])
    await clickSubmitBtnCreate(form0, page, isLoggedIn, {
      newTasks: [rootTask, subtask],
    })

    await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })
    checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 0 })

    await openTaskEditForm(page, rootTask)
    const editForm0 = getTaskForm(page, 0)
    await checkTaskFormSubtasks(editForm0, [subtask])
    await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

    await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask2)
    await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

    await checkTaskFormSubtasks(editForm0, [subtask, subtask2])
    await clickSubmitBtnUpdate(editForm0, page, isLoggedIn, {
      updatedTasks: [rootTask],
      newTasks: [subtask2],
    })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [subtask, subtask2],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 1 })
  })

  test('create multiple subtasks, check appear in tree', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
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

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(page, 0)
    await fillTaskForm(form0, page, isLoggedIn, rootTask)

    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
    await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

    await checkTaskFormSubtasks(form0, [subtask])
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask2)
    await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

    await checkTaskFormSubtasks(form0, [subtask, subtask2])
    await clickSubmitBtnCreate(form0, page, isLoggedIn, {
      newTasks: [rootTask, subtask, subtask2],
    })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [subtask, subtask2],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 0 })

    await openTaskEditForm(page, rootTask)
    const editForm0 = getTaskForm(page, 0)
    await checkTaskFormSubtasks(editForm0, [subtask, subtask2])
    await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask3)
    await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

    await checkTaskFormSubtasks(editForm0, [subtask, subtask2, subtask3])
    await clickSubmitBtnUpdate(editForm0, page, isLoggedIn, {
      updatedTasks: [rootTask],
      newTasks: [subtask3],
    })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [subtask, subtask2, subtask3],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 4, update: 1 })
  })

  test('create nested subtasks, ensure appear in tree', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
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

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(page, 0)
    await fillTaskForm(form0, page, isLoggedIn, rootTask)
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

    const form1 = getTaskForm(page, 1)
    await fillTaskForm(form1, page, isLoggedIn, subtask)
    await form1.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()

    await fillTaskForm(getTaskForm(page, 2), page, isLoggedIn, subtask2)
    await clickSubmitBtnCreate(getTaskForm(page, 2), page, isLoggedIn)

    await checkTaskFormSubtasks(form1, [subtask2])
    await form1.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 2), page, isLoggedIn, subtask3)
    await clickSubmitBtnCreate(getTaskForm(page, 2), page, isLoggedIn)

    await checkTaskFormSubtasks(form1, [subtask2, subtask3])
    await clickSubmitBtnCreate(form1, page, isLoggedIn)

    await checkTaskFormSubtasks(form0, [subtask, subtask2, subtask3])
    await clickSubmitBtnCreate(form0, page, isLoggedIn, {
      newTasks: [rootTask, subtask, subtask2, subtask3],
    })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [{ ...subtask, subtasks: [subtask2, subtask3] }],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 4, update: 0 })
  })

  test.describe('Adding subtasks to a completed task', () => {
    test('adding open subtask — save dialog appears, parent re-opens on home page', async ({
      page,
      isLoggedIn,
      taskName,
      requestTracker,
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
      const form0 = getTaskForm(page, 0)
      await fillTaskForm(form0, page, isLoggedIn, rootTask)
      await form0.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form0, page, isLoggedIn, {
        newTasks: [completedRootTask],
      })

      await goToCompletedPage(page)
      await openTaskEditForm(page, completedRootTask)

      const editForm0 = getTaskForm(page, 0)
      await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
      await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

      const openRootTask = { ...completedRootTask, status: TaskStatus.OPEN }
      await clickSubmitBtnUpdate(editForm0, page, isLoggedIn, {
        newTasks: [subtask],
        updatedTasks: [openRootTask],
        confirmDialog: Selectors.SaveOpenSubtasksConfirmDialog.DIALOG,
      })

      await expect(page.getByText(rootTask.name)).not.toBeAttached()
      await expect(page.getByText(subtask.name)).not.toBeAttached()
      await goToHomePage(page)
      await expandAndCheckTree(page, { ...openRootTask, subtasks: [subtask] })
    })

    test('adding completed subtask — no dialog, parent stays on completed page', async ({
      page,
      isLoggedIn,
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
      const form0 = getTaskForm(page, 0)
      await fillTaskForm(form0, page, isLoggedIn, rootTask)
      await form0.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form0, page, isLoggedIn, {
        newTasks: [completedRootTask],
      })

      await goToCompletedPage(page)
      await openTaskEditForm(page, completedRootTask)

      const editForm0 = getTaskForm(page, 0)
      await editForm0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const form1 = getTaskForm(page, 1)
      await fillTaskForm(form1, page, isLoggedIn, subtask)
      await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form1, page, isLoggedIn)

      await setTaskFormSubtaskSettings(editForm0, page, {
        autoHideCompleted: false,
      })
      await clickSubmitBtnUpdate(editForm0, page, isLoggedIn, {
        updatedTasks: [completedRootTask],
        newTasks: [completedSubtask],
      })

      await expandAndCheckTree(page, {
        ...completedRootTask,
        subtasks: [completedSubtask],
      })
    })
  })
})
