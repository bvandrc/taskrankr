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

import { Priority, TaskStatus } from '~/shared/schema'

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

  it('task with hideUntil in the future is hidden from home page', () => {
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    )
    const hiddenTask = {
      ...taskNoDueDate,
      name: 'Hidden Until Tomorrow Task',
      schedule: { hideUntil: tomorrow },
    } as const satisfies CreatedTask

    cy.log('Step 1: Create task with hideUntil = tomorrow')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(hiddenTask)
    clickSubmitBtnCreate({ newTasks: [hiddenTask] })

    cy.log('Step 2: Task should not be visible in the home page list')
    cy.contains(hiddenTask.name).should('not.exist')
  })

  it('reconciles priority escalation on load when escalation date has passed', () => {
    const taskName = 'Priority Escalation Test Task'

    // Task starts at LOW priority — only priority field needed, ease/enjoyment/time hidden
    const lowPrioritySettings = {
      priority: { visible: true, required: true },
      ease: { visible: false, required: false },
      enjoyment: { visible: false, required: false },
      time: { visible: false, required: false },
    }
    const baseTask = {
      name: taskName,
      priority: Priority.LOW,
      ease: null,
      enjoyment: null,
      time: null,
      status: TaskStatus.PINNED,
    } as const satisfies CreatedTask

    cy.log('Step 1: Create task with priority=low')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(baseTask, { settings: lowPrioritySettings })
    clickSubmitBtnCreate({ newTasks: [baseTask] })

    cy.log('Step 2: Inject a past medium-escalation date into local state')
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const storageMode = isLoggedIn() ? 'auth' : 'guest'
    const storageKey = `taskrankr-${storageMode}-tasks`

    cy.window().then((win) => {
      const stored: Array<{ id: number; name: string; schedule: unknown }> =
        JSON.parse(win.localStorage.getItem(storageKey) || '[]')
      const task = stored.find((t) => t.name === taskName)
      if (!task) return

      task.schedule = { [Priority.MEDIUM]: pastDate }
      win.localStorage.setItem(storageKey, JSON.stringify(stored))

      if (isLoggedIn() && task.id > 0) {
        cy.getAuthToken().then((token) =>
          cy.request({
            method: 'PATCH',
            url: `/api/tasks/${task.id}`,
            body: { schedule: { [Priority.MEDIUM]: new Date(pastDate) } },
            headers: { Authorization: `Bearer ${token}` },
          }),
        )
      }
    })

    cy.log(
      'Step 3: Reload — reconcileScheduledPriority should promote priority to medium',
    )
    cy.reload()

    cy.log('Step 4: Task card should now show badge-medium (promoted priority)')
    cy.contains(Selectors.TaskCard.TITLE, taskName)
      .closest(Selectors.TaskCard.CARD)
      .find('[data-testid="badge-medium"]')
      .should('exist')
  })
})
