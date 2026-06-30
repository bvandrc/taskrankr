import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { getPage } from '@test/support/page-context'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import { goToCompletedPage } from '@test/support/utils/navigation'
import {
  checkTaskFormSubtaskSettings,
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
  setTaskFormSubtaskSettings,
} from '@test/support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  checkCompletedPage,
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

test.describe('Completed Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  async function createRootWithUncompletedSubtask(
    rootTask: Parameters<typeof fillTaskForm>[1] & {
      status: CreatedTask['status']
    },
    subtask: Parameters<typeof fillTaskForm>[1] & {
      status: CreatedTask['status']
    },
  ) {
    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(0)
    await fillTaskForm(form0, rootTask)
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(1), subtask)
    await clickSubmitBtnCreate(getTaskForm(1))
    await setTaskFormSubtaskSettings(form0, { autoHideCompleted: false })
    await clickSubmitBtnCreate(form0, {
      newTasks: [rootTask, subtask] as CreatedTask[],
    })
  }

  test('complete subtask via New Task Form - present in main tree as crossed out, not in completed page', async ({
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
    const subtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask'),
      status: TaskStatus.OPEN,
    }
    const completedSubtask = { ...subtask, status: TaskStatus.COMPLETED }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(0)
    await fillTaskForm(form0, rootTask)
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    const form1 = getTaskForm(1)
    await fillTaskForm(form1, subtask)
    await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
    await clickSubmitBtnCreate(form1)
    await setTaskFormSubtaskSettings(form0, { autoHideCompleted: false })
    await checkTaskFormSubtasks(form0, [completedSubtask])
    await clickSubmitBtnCreate(form0, {
      newTasks: [rootTask, completedSubtask],
    })
    checkNumCalls(requestTracker, { create: 2, update: 0 })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage()
    await expect(page.getByText(subtask.name)).not.toBeAttached()
    await expect(page.getByText(rootTask.name)).not.toBeAttached()
  })

  test('complete subtask via Edit Form - present in main tree as crossed out, not in completed page', async ({
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
    const subtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask'),
      status: TaskStatus.OPEN,
    }
    const completedSubtask = { ...subtask, status: TaskStatus.COMPLETED }

    await createRootWithUncompletedSubtask(rootTask, subtask)
    checkNumCalls(requestTracker, { create: 2, update: 0 })
    await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })

    await openTaskEditForm(subtask)
    await getTaskForm(0)
      .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
      .click()
    await clickSubmitBtnUpdate(getTaskForm(0), {
      updatedTasks: [completedSubtask],
    })
    checkNumCalls(requestTracker, { create: 2, update: 1 })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage()
    await expect(page.getByText(subtask.name)).not.toBeAttached()
    await expect(page.getByText(rootTask.name)).not.toBeAttached()
  })

  test('complete subtask via Change Status Dialog - present in main tree as crossed out, not in completed page', async ({
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
    const subtask = {
      ...DefaultTaskFields,
      name: taskName('E2E Subtask'),
      status: TaskStatus.OPEN,
    }
    const completedSubtask = { ...subtask, status: TaskStatus.COMPLETED }

    await createRootWithUncompletedSubtask(rootTask, subtask)
    checkNumCalls(requestTracker, { create: 2, update: 0 })
    await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })

    await changeStatusViaStatusChangeDialog(subtask, TaskStatus.COMPLETED)
    checkNumCalls(requestTracker, { create: 2, update: 1 })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage()
    await expect(page.getByText(subtask.name)).not.toBeAttached()
    await expect(page.getByText(rootTask.name)).not.toBeAttached()
  })

  test.describe('Auto-complete parent when all subtasks completed', () => {
    test('auto-completes parent when inheritCompletionState is enabled first, then last subtask becomes completed', async ({
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
      const completedRootTask = { ...rootTask, status: TaskStatus.COMPLETED }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask'),
        status: TaskStatus.OPEN,
      }
      const completedSubtask = { ...subtask, status: TaskStatus.COMPLETED }

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const form0 = getTaskForm(0)
      await fillTaskForm(form0, rootTask)
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask)
      await clickSubmitBtnCreate(getTaskForm(1))
      await setTaskFormSubtaskSettings(form0, {
        autoHideCompleted: false,
        inheritCompletionState: true,
      })
      await clickSubmitBtnCreate(form0, {
        newTasks: [rootTask, subtask],
      })
      checkNumCalls(requestTracker, { create: 2, update: 0 })
      await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })

      await changeStatusViaStatusChangeDialog(subtask, TaskStatus.COMPLETED, {
        sideEffects: [completedRootTask],
      })
      checkNumCalls(requestTracker, { create: 2, update: 2 })
      await checkCompletedPage([
        { ...completedRootTask, subtasks: [completedSubtask] },
      ])
    })

    test('auto-completes parent when inheritCompletionState becomes enabled after all subtasks already completed', async ({
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
      const completedRootTask = { ...rootTask, status: TaskStatus.COMPLETED }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask'),
        status: TaskStatus.OPEN,
      }
      const completedSubtask = { ...subtask, status: TaskStatus.COMPLETED }

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const form0 = getTaskForm(0)
      await fillTaskForm(form0, rootTask)
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const form1 = getTaskForm(1)
      await fillTaskForm(form1, subtask)
      await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form1)
      await setTaskFormSubtaskSettings(form0, {
        autoHideCompleted: false,
      })
      await clickSubmitBtnCreate(form0, {
        newTasks: [rootTask, completedSubtask],
      })
      await expandAndCheckTree({
        ...rootTask,
        subtasks: [completedSubtask],
      })

      await openTaskEditForm(rootTask)
      await setTaskFormSubtaskSettings(getTaskForm(0), {
        inheritCompletionState: true,
      })
      await clickSubmitBtnUpdate(getTaskForm(0), {
        updatedTasks: [completedRootTask],
      })
      checkNumCalls(requestTracker, { create: 2, update: 1 })
      await checkCompletedPage([
        { ...completedRootTask, subtasks: [completedSubtask] },
      ])
    })

    test('auto-completes grandparent chain when completing the last subtask', async ({
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
      const completedRootTask = { ...rootTask, status: TaskStatus.COMPLETED }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask'),
        status: TaskStatus.OPEN,
      }
      const completedSubtask = { ...subtask, status: TaskStatus.COMPLETED }
      const subtask2 = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask 2'),
        status: TaskStatus.OPEN,
      }
      const completedSubtask2 = { ...subtask2, status: TaskStatus.COMPLETED }

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const form0 = getTaskForm(0)
      await fillTaskForm(form0, rootTask)
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask)
      await clickSubmitBtnCreate(getTaskForm(1))
      await setTaskFormSubtaskSettings(form0, {
        autoHideCompleted: false,
        inheritCompletionState: true,
      })
      await clickSubmitBtnCreate(form0, {
        newTasks: [rootTask, subtask],
      })
      checkNumCalls(requestTracker, { create: 2, update: 0 })
      await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })

      await openTaskEditForm(subtask)
      const editForm1 = getTaskForm(1)
      await editForm1.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(2), subtask2)
      await clickSubmitBtnCreate(getTaskForm(2))
      await setTaskFormSubtaskSettings(editForm1, {
        autoHideCompleted: false,
        inheritCompletionState: true,
      })
      await clickSubmitBtnUpdate(editForm1, {
        updatedTasks: [subtask],
      })
      checkNumCalls(requestTracker, { create: 3, update: 1 })
      await expandAndCheckTree({
        ...rootTask,
        subtasks: [{ ...subtask, subtasks: [subtask2] }],
      })

      await changeStatusViaStatusChangeDialog(subtask2, TaskStatus.COMPLETED, {
        sideEffects: [completedSubtask, completedRootTask],
      })
      checkNumCalls(requestTracker, { create: 3, update: 4 })
      await checkCompletedPage([
        {
          ...completedRootTask,
          subtasks: [{ ...completedSubtask, subtasks: [completedSubtask2] }],
        },
      ])
    })
  })

  test.describe('Auto-hide completed subtasks', () => {
    test.describe('When creating a new root task', () => {
      test('via completion checkbox in new subtask form', async ({
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
        const subtask = {
          ...DefaultTaskFields,
          name: taskName('E2E Subtask'),
          status: TaskStatus.OPEN,
        }
        const subtask2 = {
          ...DefaultTaskFields,
          name: taskName('E2E Subtask 2'),
          status: TaskStatus.OPEN,
        }
        const completedSubtask2 = { ...subtask2, status: TaskStatus.COMPLETED }

        await page.locator(Selectors.CREATE_TASK_BTN).click()
        const form0 = getTaskForm(0)
        await fillTaskForm(form0, rootTask)
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(1), subtask)
        await clickSubmitBtnCreate(getTaskForm(1))

        // default is autoHideCompleted: true
        await checkTaskFormSubtaskSettings(form0, {
          autoHideCompleted: true,
        })

        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const form1 = getTaskForm(1)
        await fillTaskForm(form1, subtask2)
        await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnCreate(form1)

        await checkTaskFormSubtaskSettings(form0, {
          autoHideCompleted: true,
        })
        await checkTaskFormSubtasks(form0, [subtask])
        await clickSubmitBtnCreate(form0, {
          newTasks: [rootTask, subtask, completedSubtask2],
        })
        checkNumCalls(requestTracker, { create: 3, update: 0 })
        await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      })

      test('via completion checkbox in edit subtask form', async ({
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
        const subtask = {
          ...DefaultTaskFields,
          name: taskName('E2E Subtask'),
          status: TaskStatus.OPEN,
        }
        const subtask2 = {
          ...DefaultTaskFields,
          name: taskName('E2E Subtask 2'),
          status: TaskStatus.OPEN,
        }
        const completedSubtask2 = { ...subtask2, status: TaskStatus.COMPLETED }

        await page.locator(Selectors.CREATE_TASK_BTN).click()
        const form0 = getTaskForm(0)
        await fillTaskForm(form0, rootTask)
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(1), subtask)
        await clickSubmitBtnCreate(getTaskForm(1))
        await checkTaskFormSubtaskSettings(form0, {
          autoHideCompleted: true,
        })

        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(1), subtask2)
        await clickSubmitBtnCreate(getTaskForm(1))

        await checkTaskFormSubtasks(form0, [subtask, subtask2])
        await form0.locator(Selectors.TaskForm.EDIT_SUBTASK_BTN).last().click()
        await getTaskForm(1)
          .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
          .click()
        await clickSubmitBtnCreate(getTaskForm(1))

        await checkTaskFormSubtaskSettings(form0, {
          autoHideCompleted: true,
        })
        await checkTaskFormSubtasks(form0, [subtask])
        await clickSubmitBtnCreate(form0, {
          newTasks: [rootTask, subtask, completedSubtask2],
        })
        checkNumCalls(requestTracker, { create: 3, update: 0 })
        await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      })
    })

    test.describe('When editing an existing root task', () => {
      test('with subtasks already completed', async ({
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
        const subtask = {
          ...DefaultTaskFields,
          name: taskName('E2E Subtask'),
          status: TaskStatus.OPEN,
        }
        const subtask2 = {
          ...DefaultTaskFields,
          name: taskName('E2E Subtask 2'),
          status: TaskStatus.OPEN,
        }
        const completedSubtask2 = { ...subtask2, status: TaskStatus.COMPLETED }

        await page.locator(Selectors.CREATE_TASK_BTN).click()
        const form0 = getTaskForm(0)
        await fillTaskForm(form0, rootTask)
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(1), subtask)
        await clickSubmitBtnCreate(getTaskForm(1))
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const form1 = getTaskForm(1)
        await fillTaskForm(form1, subtask2)
        await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnCreate(form1)

        await setTaskFormSubtaskSettings(form0, {
          autoHideCompleted: false,
        })
        await checkTaskFormSubtasks(form0, [subtask, completedSubtask2])
        await clickSubmitBtnCreate(form0, {
          newTasks: [rootTask, subtask, completedSubtask2],
        })
        await expandAndCheckTree({
          ...rootTask,
          subtasks: [subtask, completedSubtask2],
        })
        checkNumCalls(requestTracker, { create: 3, update: 0 })

        await openTaskEditForm(rootTask)
        const editForm0 = getTaskForm(0)
        await checkTaskFormSubtasks(editForm0, [subtask, completedSubtask2])
        await setTaskFormSubtaskSettings(editForm0, {
          autoHideCompleted: true,
        })
        await checkTaskFormSubtasks(editForm0, [subtask])
        await clickSubmitBtnUpdate(editForm0, {
          updatedTasks: [rootTask],
        })
        checkNumCalls(requestTracker, { create: 3, update: 1 })
        await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      })
    })
  })
})
