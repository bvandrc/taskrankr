import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@test/support/constants'
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

import { TaskStatus } from '~/shared/schema'

const { TaskForm, SaveOpenSubtasksConfirmDialog } = Selectors

describe('Create Subtasks', () => {
  const rootTask = {
    ...DefaultTask,
    name: 'E2E Root Level Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const subtask = {
    ...DefaultTask,
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

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)

    cy.log('Open new task form and fill root task')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    getTaskForm(0).within(() => {
      fillTaskForm(rootTask)
    })
  })

  it('create a subtask, check appears in tree', () => {
    cy.log('Step 1: Add subtask and create')
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(subtask)
      clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask])
      clickSubmitBtnCreate({ newTasks: [rootTask, subtask] })
    })

    expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
    checkNumCalls({ create: 2, update: 0 })

    cy.log('Step 2: Edit root task, add a second subtask')
    openTaskEditForm(rootTask)
    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(subtask2)
      clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask, subtask2])
      clickSubmitBtnUpdate({ updatedTasks: [rootTask], newTasks: [subtask2] })
    })

    expandAndCheckTree({ ...rootTask, subtasks: [subtask, subtask2] })
    checkNumCalls({ create: 3, update: 1 })
  })

  it('create multiple subtasks, check appear in tree', () => {
    cy.log('Step 1: Add two subtasks and create')
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(subtask)
      clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(subtask2)
      clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask, subtask2])
      clickSubmitBtnCreate({ newTasks: [rootTask, subtask, subtask2] })
    })

    expandAndCheckTree({ ...rootTask, subtasks: [subtask, subtask2] })
    checkNumCalls({ create: 3, update: 0 })

    cy.log('Step 2: Edit root task, add a third subtask')
    openTaskEditForm(rootTask)
    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask, subtask2])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(subtask3)
      clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask, subtask2, subtask3])
      clickSubmitBtnUpdate({ updatedTasks: [rootTask], newTasks: [subtask3] })
    })

    expandAndCheckTree({ ...rootTask, subtasks: [subtask, subtask2, subtask3] })
    checkNumCalls({ create: 4, update: 1 })
  })

  it('create nested subtasks, ensure appear in tree', () => {
    cy.log('Step 1: Add subtask with two nested children')
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(subtask)
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(2).within(() => {
      fillTaskForm(subtask2)
      clickSubmitBtnCreate()
    })

    getTaskForm(1).within(() => {
      checkTaskFormSubtasks([subtask2])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(2).within(() => {
      fillTaskForm(subtask3)
      clickSubmitBtnCreate()
    })

    getTaskForm(1).within(() => {
      checkTaskFormSubtasks([subtask2, subtask3])
      clickSubmitBtnCreate()
    })

    cy.log('Step 2: Submit root task and verify nested tree')
    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([subtask, subtask2, subtask3])
      clickSubmitBtnCreate({
        newTasks: [rootTask, subtask, subtask2, subtask3],
      })
    })

    expandAndCheckTree({
      ...rootTask,
      subtasks: [{ ...subtask, subtasks: [subtask2, subtask3] }],
    })
    checkNumCalls({ create: 4, update: 0 })

    // TODO: test EDIT
  })

  context('Adding subtasks to a completed task', () => {
    beforeEach(() => {
      cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
      clickSubmitBtnCreate({ newTasks: [completedRootTask] })

      cy.log('Navigate to completed page and open the edit form')
      goToCompletedPage()
      openTaskEditForm(completedRootTask)
    })

    it('adding open subtask — save dialog appears, parent re-opens on home page', () => {
      cy.log('Add an open subtask')
      getTaskForm(0).within(() => {
        cy.get(TaskForm.ADD_SUBTASK_BTN).click()
      })
      getTaskForm(1).within(() => {
        fillTaskForm(subtask)
        clickSubmitBtnCreate()
      })

      const openRootTask = { ...completedRootTask, status: TaskStatus.OPEN }

      cy.log('Click Save — dialog warns that the parent will be re-opened')
      getTaskForm(0).within(() => {
        clickSubmitBtnUpdate({
          newTasks: [subtask],
          updatedTasks: [openRootTask],
          confirmDialog: SaveOpenSubtasksConfirmDialog.DIALOG,
        })
      })

      cy.log(
        'Parent task is now visible on home page with the new open subtask, no longer on completed page',
      )
      cy.contains(rootTask.name).should('not.exist')
      cy.contains(subtask.name).should('not.exist')
      goToHomePage()
      expandAndCheckTree({ ...openRootTask, subtasks: [subtask] })
    })

    it('adding completed subtask — no dialog, parent stays on completed page with new subtask', () => {
      cy.log('Add a completed subtask')
      getTaskForm(0).within(() => {
        cy.get(TaskForm.ADD_SUBTASK_BTN).click()
      })
      getTaskForm(1).within(() => {
        fillTaskForm(completedSubtask)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        clickSubmitBtnCreate()
      })
      getTaskForm(0).within(() => {
        setTaskFormSubtaskSettings({ autoHideCompleted: false })
        clickSubmitBtnUpdate({
          updatedTasks: [completedRootTask],
          newTasks: [completedSubtask],
        })
      })

      cy.log(
        'Completed page still shows parent task with its new completed subtask',
      )
      expandAndCheckTree({ ...completedRootTask, subtasks: [completedSubtask] })
    })
  })
})
