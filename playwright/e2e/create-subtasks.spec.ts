import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { isLoggedIn } from '@test/support/utils'
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

const { TaskForm, SaveOpenSubtasksConfirmDialog } = Selectors

test.describe('Create Subtasks', () => {
  const rootTask = {
    ...DefaultTaskFields,
    name: 'E2E Root Level Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const subtask = {
    ...DefaultTaskFields,
    status: TaskStatus.OPEN,
    name: 'E2E Subtask 1',
  } as const satisfies CreatedTask

  const subtask2 = {
    ...subtask,
    name: 'E2E Subtask 2',
  } as const satisfies CreatedTask

  const subtask3 = {
    ...subtask,
    name: 'E2E Subtask 3',
  } as const satisfies CreatedTask

  const completedRootTask = {
    ...rootTask,
    status: TaskStatus.COMPLETED,
  } as const satisfies CreatedTask

  const completedSubtask = {
    ...subtask,
    status: TaskStatus.COMPLETED,
  } as const satisfies CreatedTask

  test.beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)

    // STEP: Open new task form and fill root task
    cy.get(Selectors.CREATE_TASK_BTN).click()
    getTaskForm(0).within(async () => {
      await fillTaskForm(rootTask)
    })
  })

  test('create a subtask, check appears in tree', async () => {
    // STEP: Step 1: Add subtask and create
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(subtask)
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask])
      await clickSubmitBtnCreate({ newTasks: [rootTask, subtask] })
    })

    await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
    checkNumCalls({ create: 2, update: 0 })

    // STEP: Step 2: Edit root task, add a second subtask
    await openTaskEditForm(rootTask)
    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(subtask2)
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask, subtask2])
      await clickSubmitBtnUpdate({
        updatedTasks: [rootTask],
        newTasks: [subtask2],
      })
    })

    await expandAndCheckTree({ ...rootTask, subtasks: [subtask, subtask2] })
    checkNumCalls({ create: 3, update: 1 })
  })

  test('create multiple subtasks, check appear in tree', async () => {
    // STEP: Step 1: Add two subtasks and create
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(subtask)
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(subtask2)
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask, subtask2])
      await clickSubmitBtnCreate({ newTasks: [rootTask, subtask, subtask2] })
    })

    await expandAndCheckTree({ ...rootTask, subtasks: [subtask, subtask2] })
    checkNumCalls({ create: 3, update: 0 })

    // STEP: Step 2: Edit root task, add a third subtask
    await openTaskEditForm(rootTask)
    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask, subtask2])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(subtask3)
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask, subtask2, subtask3])
      await clickSubmitBtnUpdate({
        updatedTasks: [rootTask],
        newTasks: [subtask3],
      })
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [subtask, subtask2, subtask3],
    })
    checkNumCalls({ create: 4, update: 1 })
  })

  test('create nested subtasks, ensure appear in tree', async () => {
    // STEP: Step 1: Add subtask with two nested children
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(subtask)
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(2).within(async () => {
      await fillTaskForm(subtask2)
      await clickSubmitBtnCreate()
    })

    getTaskForm(1).within(async () => {
      await checkTaskFormSubtasks([subtask2])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(2).within(async () => {
      await fillTaskForm(subtask3)
      await clickSubmitBtnCreate()
    })

    getTaskForm(1).within(async () => {
      await checkTaskFormSubtasks([subtask2, subtask3])
      await clickSubmitBtnCreate()
    })

    // STEP: Step 2: Submit root task and verify nested tree
    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([subtask, subtask2, subtask3])
      await clickSubmitBtnCreate({
        newTasks: [rootTask, subtask, subtask2, subtask3],
      })
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [{ ...subtask, subtasks: [subtask2, subtask3] }],
    })
    checkNumCalls({ create: 4, update: 0 })

    // TODO: test EDIT
  })

  context('Adding subtasks to a completed task', () => {
    test.beforeEach(async () => {
      cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate({ newTasks: [completedRootTask] })

      // STEP: Navigate to completed page and open the edit form
      goToCompletedPage()
      await openTaskEditForm(completedRootTask)
    })

    test('adding open subtask — save dialog appears, parent re-opens on home page', async () => {
      // STEP: Add an open subtask
      getTaskForm(0).within(() => {
        cy.get(TaskForm.ADD_SUBTASK_BTN).click()
      })
      getTaskForm(1).within(async () => {
        await fillTaskForm(subtask)
        await clickSubmitBtnCreate()
      })

      const openRootTask = { ...completedRootTask, status: TaskStatus.OPEN }

      // STEP: Click Save — dialog warns that the parent will be re-opened
      getTaskForm(0).within(async () => {
        await clickSubmitBtnUpdate({
          newTasks: [subtask],
          updatedTasks: [openRootTask],
          confirmDialog: SaveOpenSubtasksConfirmDialog.DIALOG,
        })
      })

      // STEP: Parent task is now visible on home page with the new open subtask, no longer on completed page
      cy.contains(rootTask.name).should('not.exist')
      cy.contains(subtask.name).should('not.exist')
      goToHomePage()
      await expandAndCheckTree({ ...openRootTask, subtasks: [subtask] })
    })

    test('adding completed subtask — no dialog, parent stays on completed page with new subtask', async () => {
      // STEP: Add a completed subtask
      getTaskForm(0).within(() => {
        cy.get(TaskForm.ADD_SUBTASK_BTN).click()
      })
      getTaskForm(1).within(async () => {
        await fillTaskForm(completedSubtask)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnCreate()
      })
      getTaskForm(0).within(async () => {
        setTaskFormSubtaskSettings({ autoHideCompleted: false })
        await clickSubmitBtnUpdate({
          updatedTasks: [completedRootTask],
          newTasks: [completedSubtask],
        })
      })

      // STEP: Completed page still shows parent task with its new completed subtask
      await expandAndCheckTree({
        ...completedRootTask,
        subtasks: [completedSubtask],
      })
    })
  })
})
