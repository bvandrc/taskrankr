import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { isLoggedIn } from '@test/support/utils'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import {
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  openMoreSection,
} from '@test/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

const { TaskForm } = Selectors

test.describe('Scheduling', () => {
  test.beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  const today = new Date()

  const baseTask = {
    ...DefaultTaskFields,
    name: 'E2E Test Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  test('create a task with a due date, verify due badge displays on task card', async () => {
    const taskWithDueDate = {
      ...baseTask,
      schedule: {
        // next month, day 15 — avoids today edge cases and always navigates to a future date
        dueAt: new Date(today.getFullYear(), today.getMonth() + 1, 15),
      },
    } as const satisfies CreatedTask

    // STEP 1: Create task with due date
    cy.get(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(taskWithDueDate)
    await clickSubmitBtnCreate({ newTasks: [taskWithDueDate] })
    checkNumCalls({ create: 1, update: 0 })

    // STEP 2: Verify due badge displays on task card with correct text
    await expandAndCheckTree(taskWithDueDate)

    // STEP 3: Edit task again, clear the due date
    await openTaskEditForm(taskWithDueDate)
    await openMoreSection()
    cy.get(TaskForm.Schedule.CLEAR_DUE_AT_BTN).click()

    await clickSubmitBtnUpdate({ updatedTasks: [baseTask] })
    checkNumCalls({ create: 1, update: 1 })

    // STEP 4: Verify due badge is gone
    await expandAndCheckTree(baseTask)
  })

  test('task with hideUntil in the future is hidden from home page', async () => {
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

    // STEP 1: Create task with hideUntil = tomorrow
    cy.get(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(hiddenTask)
    await clickSubmitBtnCreate({ newTasks: [hiddenTask] })

    // STEP 2: Task should not be visible in the home page list
    cy.contains(hiddenTask.name).should('not.exist')
  })

  // TODO: reconciles priority escalation on load when escalation date has passed
})
