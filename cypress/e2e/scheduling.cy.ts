import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@cypress/support/constants'
import { isLoggedIn } from '@cypress/support/utils'
import {
  type CreatedTask,
  checkNumCalls,
} from '@cypress/support/utils/intercepts'
import {
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  openMoreSection,
} from '@cypress/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@cypress/support/utils/task-tree'

import { TaskStatus } from '~/shared/schema'

const { TaskForm } = Selectors

describe('Scheduling', () => {
  const today = new Date()

  const taskNoDueDate = {
    ...DefaultTask,
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  it('create a task with a due date, verify due badge displays on task card', () => {
    // next month, day 15 — avoids today edge cases and always navigates to a future date
    const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 15)
    const taskWithDueDate = {
      ...taskNoDueDate,
      schedule: {
        dueAt: dueDate,
      },
    } as const satisfies CreatedTask

    cy.log('Step 1: Create task with due date')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(taskWithDueDate)
    clickSubmitBtnCreate({ newTasks: [taskWithDueDate] })
    checkNumCalls({ create: 1, update: 0 })

    cy.log('Step 2: Verify due badge displays on task card with correct text')
    expandAndCheckTree(taskWithDueDate)

    cy.log('Step 3: Edit task again, clear the due date')
    openTaskEditForm(taskWithDueDate)
    openMoreSection()
    cy.get(TaskForm.Schedule.CLEAR_DUE_AT_BTN).click()

    clickSubmitBtnUpdate({ updatedTasks: [taskNoDueDate] })
    checkNumCalls({ create: 1, update: 1 })

    cy.log('Step 4: Verify due badge is gone')
    expandAndCheckTree(taskNoDueDate)
  })
})
