import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@cypress/support/constants'
import { isLoggedIn } from '@cypress/support/utils'
import {
  type CreatedTask,
  checkNumCalls,
} from '@cypress/support/utils/intercepts'
import { goToCompletedPage } from '@cypress/support/utils/navigation'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@cypress/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@cypress/support/utils/task-tree'

import { TaskStatus } from '~/shared/schema'

const { TaskForm } = Selectors

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
})

const { SaveOpenSubtasksConfirmDialog } = Selectors

describe('Adding subtasks to a completed task', () => {
  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  it('adding open subtask — save dialog appears, parent re-opens on home page', () => {
    const completedTask = {
      ...DefaultTask,
      name: 'E2E Completed Task - Open Subtask Test',
      status: TaskStatus.COMPLETED,
    } as const satisfies CreatedTask

    const openSubtask = {
      ...DefaultTask,
      name: 'E2E Open Subtask of Completed Task',
      status: TaskStatus.OPEN,
    } as const satisfies CreatedTask

    cy.log('Create a completed root task')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(completedTask)
    cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
    clickSubmitBtnCreate({ newTasks: [completedTask] })

    cy.log('Navigate to completed page and open the edit form')
    goToCompletedPage()
    openTaskEditForm(completedTask)

    cy.log('Add an open subtask')
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })
    getTaskForm(1).within(() => {
      fillTaskForm(openSubtask)
      clickSubmitBtnCreate()
    })

    cy.log('Click Save — dialog warns that the parent will be re-opened')
    cy.get(TaskForm.SUBMIT_BTN).should('have.text', 'Save').click()
    cy.get(SaveOpenSubtasksConfirmDialog.DIALOG).should('be.visible')
    cy.get(SaveOpenSubtasksConfirmDialog.CONFIRM_BTN).click()
    cy.get(Selectors.TaskForm.FORM).should('not.exist')

    cy.log('Navigate home — parent is now open and subtask is visible')
    cy.get(Selectors.MENU_BTN).click()
    cy.get(Selectors.Menu.HOME).click()
    cy.get(Selectors.Pages.HOME).should('be.visible')
    expandAndCheckTree({
      ...completedTask,
      status: TaskStatus.OPEN,
      subtasks: [openSubtask],
    })
  })

  it('adding completed subtask — no dialog, parent stays on completed page with new subtask', () => {
    const completedTask = {
      ...DefaultTask,
      name: 'E2E Completed Task - Completed Subtask Test',
      status: TaskStatus.COMPLETED,
    } as const satisfies CreatedTask

    const completedSubtask = {
      ...DefaultTask,
      name: 'E2E Completed Subtask of Completed Task',
      status: TaskStatus.COMPLETED,
    } as const satisfies CreatedTask

    cy.log('Create a completed root task')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(completedTask)
    cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
    clickSubmitBtnCreate({ newTasks: [completedTask] })

    cy.log('Navigate to completed page and open the edit form')
    goToCompletedPage()
    openTaskEditForm(completedTask)

    cy.log('Add a completed subtask')
    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })
    getTaskForm(1).within(() => {
      fillTaskForm(completedSubtask)
      cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
      clickSubmitBtnCreate()
    })

    cy.log('Click Save — no dialog should appear, form closes immediately')
    cy.get(TaskForm.SUBMIT_BTN).should('have.text', 'Save').click()
    cy.get(SaveOpenSubtasksConfirmDialog.DIALOG).should('not.exist')
    cy.get(Selectors.TaskForm.FORM).should('not.exist')

    cy.log(
      'Completed page still shows parent task with its new completed subtask',
    )
    expandAndCheckTree({
      ...completedTask,
      subtasks: [completedSubtask],
    })
  })
})
