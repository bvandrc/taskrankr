import { Routes } from '../../client/src/lib/constants'
import { TaskStatus } from '../../shared/schema'
import { DefaultTaskFields, Selectors } from '../support/constants'
import { expect, test } from '../support/fixtures'
import { type CreatedTask, checkNumCalls } from '../support/utils/intercepts'
import { goToCompletedPage } from '../support/utils/navigation'
import {
  checkTaskFormSubtaskSettings,
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
  setTaskFormSubtaskSettings,
} from '../support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  checkCompletedPage,
  expandAndCheckTree,
  openTaskEditForm,
} from '../support/utils/task-tree'

test.describe('Completed Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  async function createRootWithUncompletedSubtask(
    page: Parameters<typeof fillTaskForm>[1],
    isLoggedIn: boolean,
    rootTask: Parameters<typeof fillTaskForm>[3] & {
      status: CreatedTask['status']
    },
    subtask: Parameters<typeof fillTaskForm>[3] & {
      status: CreatedTask['status']
    },
  ) {
    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(page, 0)
    await fillTaskForm(form0, page, isLoggedIn, rootTask)
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
    await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)
    await setTaskFormSubtaskSettings(form0, page, { autoHideCompleted: false })
    await clickSubmitBtnCreate(form0, page, isLoggedIn, {
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
    const form0 = getTaskForm(page, 0)
    await fillTaskForm(form0, page, isLoggedIn, rootTask)
    await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    const form1 = getTaskForm(page, 1)
    await fillTaskForm(form1, page, isLoggedIn, subtask)
    await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
    await clickSubmitBtnCreate(form1, page, isLoggedIn)
    await setTaskFormSubtaskSettings(form0, page, { autoHideCompleted: false })
    await checkTaskFormSubtasks(form0, [completedSubtask])
    await clickSubmitBtnCreate(form0, page, isLoggedIn, {
      newTasks: [rootTask, completedSubtask],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 0 })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage(page)
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

    await createRootWithUncompletedSubtask(page, isLoggedIn, rootTask, subtask)
    checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 0 })
    await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })

    await openTaskEditForm(page, subtask)
    await getTaskForm(page, 0)
      .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
      .click()
    await clickSubmitBtnUpdate(getTaskForm(page, 0), page, isLoggedIn, {
      updatedTasks: [completedSubtask],
    })
    checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 1 })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage(page)
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

    await createRootWithUncompletedSubtask(page, isLoggedIn, rootTask, subtask)
    checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 0 })
    await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })

    await changeStatusViaStatusChangeDialog(
      page,
      isLoggedIn,
      subtask,
      TaskStatus.COMPLETED,
    )
    checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 1 })

    await expandAndCheckTree(page, {
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage(page)
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
      const form0 = getTaskForm(page, 0)
      await fillTaskForm(form0, page, isLoggedIn, rootTask)
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
      await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)
      await setTaskFormSubtaskSettings(form0, page, {
        autoHideCompleted: false,
        inheritCompletionState: true,
      })
      await clickSubmitBtnCreate(form0, page, isLoggedIn, {
        newTasks: [rootTask, subtask],
      })
      checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 0 })
      await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })

      await changeStatusViaStatusChangeDialog(
        page,
        isLoggedIn,
        subtask,
        TaskStatus.COMPLETED,
        {
          sideEffects: [completedRootTask],
        },
      )
      checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 2 })
      await checkCompletedPage(page, isLoggedIn, [
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
      const form0 = getTaskForm(page, 0)
      await fillTaskForm(form0, page, isLoggedIn, rootTask)
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const form1 = getTaskForm(page, 1)
      await fillTaskForm(form1, page, isLoggedIn, subtask)
      await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate(form1, page, isLoggedIn)
      await setTaskFormSubtaskSettings(form0, page, {
        autoHideCompleted: false,
      })
      await clickSubmitBtnCreate(form0, page, isLoggedIn, {
        newTasks: [rootTask, completedSubtask],
      })
      await expandAndCheckTree(page, {
        ...rootTask,
        subtasks: [completedSubtask],
      })

      await openTaskEditForm(page, rootTask)
      await setTaskFormSubtaskSettings(getTaskForm(page, 0), page, {
        inheritCompletionState: true,
      })
      await clickSubmitBtnUpdate(getTaskForm(page, 0), page, isLoggedIn, {
        updatedTasks: [completedRootTask],
      })
      checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 1 })
      await checkCompletedPage(page, isLoggedIn, [
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
      const form0 = getTaskForm(page, 0)
      await fillTaskForm(form0, page, isLoggedIn, rootTask)
      await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
      await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)
      await setTaskFormSubtaskSettings(form0, page, {
        autoHideCompleted: false,
        inheritCompletionState: true,
      })
      await clickSubmitBtnCreate(form0, page, isLoggedIn, {
        newTasks: [rootTask, subtask],
      })
      checkNumCalls(requestTracker, isLoggedIn, { create: 2, update: 0 })
      await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })

      await openTaskEditForm(page, subtask)
      const editForm1 = getTaskForm(page, 1)
      await editForm1.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(page, 2), page, isLoggedIn, subtask2)
      await clickSubmitBtnCreate(getTaskForm(page, 2), page, isLoggedIn)
      await setTaskFormSubtaskSettings(editForm1, page, {
        autoHideCompleted: false,
        inheritCompletionState: true,
      })
      await clickSubmitBtnUpdate(editForm1, page, isLoggedIn, {
        updatedTasks: [subtask],
      })
      checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 1 })
      await expandAndCheckTree(page, {
        ...rootTask,
        subtasks: [{ ...subtask, subtasks: [subtask2] }],
      })

      await changeStatusViaStatusChangeDialog(
        page,
        isLoggedIn,
        subtask2,
        TaskStatus.COMPLETED,
        {
          sideEffects: [completedSubtask, completedRootTask],
        },
      )
      checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 4 })
      await checkCompletedPage(page, isLoggedIn, [
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
        const form0 = getTaskForm(page, 0)
        await fillTaskForm(form0, page, isLoggedIn, rootTask)
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
        await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

        // default is autoHideCompleted: true
        await checkTaskFormSubtaskSettings(form0, page, {
          autoHideCompleted: true,
        })

        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const form1 = getTaskForm(page, 1)
        await fillTaskForm(form1, page, isLoggedIn, subtask2)
        await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnCreate(form1, page, isLoggedIn)

        await checkTaskFormSubtaskSettings(form0, page, {
          autoHideCompleted: true,
        })
        await checkTaskFormSubtasks(form0, [subtask])
        await clickSubmitBtnCreate(form0, page, isLoggedIn, {
          newTasks: [rootTask, subtask, completedSubtask2],
        })
        checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 0 })
        await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })
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
        const form0 = getTaskForm(page, 0)
        await fillTaskForm(form0, page, isLoggedIn, rootTask)
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
        await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)
        await checkTaskFormSubtaskSettings(form0, page, {
          autoHideCompleted: true,
        })

        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask2)
        await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

        await checkTaskFormSubtasks(form0, [subtask, subtask2])
        await form0.locator(Selectors.TaskForm.EDIT_SUBTASK_BTN).last().click()
        await getTaskForm(page, 1)
          .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
          .click()
        await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

        await checkTaskFormSubtaskSettings(form0, page, {
          autoHideCompleted: true,
        })
        await checkTaskFormSubtasks(form0, [subtask])
        await clickSubmitBtnCreate(form0, page, isLoggedIn, {
          newTasks: [rootTask, subtask, completedSubtask2],
        })
        checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 0 })
        await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })
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
        const form0 = getTaskForm(page, 0)
        await fillTaskForm(form0, page, isLoggedIn, rootTask)
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
        await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)
        await form0.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const form1 = getTaskForm(page, 1)
        await fillTaskForm(form1, page, isLoggedIn, subtask2)
        await form1.locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnCreate(form1, page, isLoggedIn)

        await setTaskFormSubtaskSettings(form0, page, {
          autoHideCompleted: false,
        })
        await checkTaskFormSubtasks(form0, [subtask, completedSubtask2])
        await clickSubmitBtnCreate(form0, page, isLoggedIn, {
          newTasks: [rootTask, subtask, completedSubtask2],
        })
        await expandAndCheckTree(page, {
          ...rootTask,
          subtasks: [subtask, completedSubtask2],
        })
        checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 0 })

        await openTaskEditForm(page, rootTask)
        const editForm0 = getTaskForm(page, 0)
        await checkTaskFormSubtasks(editForm0, [subtask, completedSubtask2])
        await setTaskFormSubtaskSettings(editForm0, page, {
          autoHideCompleted: true,
        })
        await checkTaskFormSubtasks(editForm0, [subtask])
        await clickSubmitBtnUpdate(editForm0, page, isLoggedIn, {
          updatedTasks: [rootTask],
        })
        checkNumCalls(requestTracker, isLoggedIn, { create: 3, update: 1 })
        await expandAndCheckTree(page, { ...rootTask, subtasks: [subtask] })
      })
    })
  })
})
