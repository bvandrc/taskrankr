import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@test/support/constants'
import { isLoggedIn } from '@test/support/utils'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import {
  assignSubtask,
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

import { Priority, TaskStatus } from '~/shared/schema'

const { TaskForm } = Selectors

describe('Assign Subtasks', () => {
  const rootTask = {
    ...DefaultTask,
    name: 'E2E Root Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const orphanTask = {
    ...DefaultTask,
    priority: Priority.HIGH,
    name: 'E2E Orphan Task 1',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const orphanTask2 = {
    ...DefaultTask,
    priority: Priority.MEDIUM,
    name: 'E2E Orphan Task 2',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const newSubtask = {
    ...DefaultTask,
    priority: Priority.LOW,
    name: 'E2E Brand New Subtask',
    status: TaskStatus.OPEN,
  } as const satisfies CreatedTask

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)

    cy.log('Create orphan tasks')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(orphanTask)
    clickSubmitBtnCreate({ newTasks: [orphanTask] })

    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(orphanTask2)
    clickSubmitBtnCreate({ newTasks: [orphanTask2] })
  })

  it('assign an existing orphaned task as a subtask of a task', () => {
    cy.log(
      'Step 1: Create root task, create new subtask, assign sibling orphanTask',
    )
    cy.get(Selectors.CREATE_TASK_BTN).click()
    getTaskForm(0).within(() => {
      fillTaskForm(rootTask)
      assignSubtask(orphanTask)
    })
    // task form re-renders TODO: debug?
    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([orphanTask])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(newSubtask)
      clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([orphanTask, newSubtask])
      clickSubmitBtnCreate({
        newTasks: [rootTask, newSubtask],
        updatedTasks: [orphanTask],
      })
    })

    expandAndCheckTree({ ...rootTask, subtasks: [orphanTask, newSubtask] })
    checkNumCalls({ create: 4, update: 1 })

    cy.log('Step 2: Edit root task, assign second orphan')
    openTaskEditForm(rootTask)
    getTaskForm(0).within(() => {
      checkTaskFormSubtasks([orphanTask, newSubtask])
      assignSubtask(orphanTask2)
      checkTaskFormSubtasks([orphanTask, orphanTask2, newSubtask]) // all at same level, so we don't care about orde really.
      clickSubmitBtnUpdate({ updatedTasks: [rootTask, orphanTask2] })
    })

    expandAndCheckTree({
      ...rootTask,
      subtasks: [orphanTask, newSubtask, orphanTask2],
    })
    checkNumCalls({ create: 4, update: 3 })
  })
})
