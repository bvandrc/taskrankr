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

  const baseTask = {
    ...DefaultTask,
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  it('create a task with a due date, verify due badge displays on task card', () => {
    const taskWithDueDate = {
      ...baseTask,
      schedule: {
        // next month, day 15 — avoids today edge cases and always navigates to a future date
        dueAt: new Date(today.getFullYear(), today.getMonth() + 1, 15),
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

    clickSubmitBtnUpdate({ updatedTasks: [baseTask] })
    checkNumCalls({ create: 1, update: 1 })

    cy.log('Step 4: Verify due badge is gone')
    expandAndCheckTree(baseTask)
  })

  it('task with hideUntil in the future is hidden from home page', () => {
    const hiddenTask = {
      ...baseTask,
      schedule: {
        // tomorrow
        hideUntil: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
        ),
      },
    } as const satisfies CreatedTask

    cy.log('Step 1: Create task with hideUntil = tomorrow')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(hiddenTask)
    clickSubmitBtnCreate({ newTasks: [hiddenTask] })

    cy.log('Step 2: Task should not be visible in the home page list')
    cy.contains(hiddenTask.name).should('not.exist')
  })

  // TODO: reconciles priority escalation on load when escalation date has passed
})
