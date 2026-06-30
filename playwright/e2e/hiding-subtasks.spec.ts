import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { isLoggedIn } from '@test/support/utils'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'

const { TaskForm } = Selectors

describe('Hiding Subtasks', () => {
  const rootTask = {
    ...DefaultTaskFields,
    name: 'E2E Root Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const openSubtask = {
    ...DefaultTaskFields,
    name: 'E2E Open Subtask',
    status: TaskStatus.OPEN,
  } as const satisfies CreatedTask

  const completedSubtask = {
    ...DefaultTaskFields,
    name: 'E2E Completed Subtask',
    status: TaskStatus.COMPLETED,
  } as const satisfies CreatedTask

  beforeEach(async () => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)

    /**
     * Create rootTask with one open subtask and one completed subtask, with
     * auto-hide completed enabled. The completed subtask will be hidden in the
     * form and tree until "Show Hidden" is toggled.
     */

    cy.get(Selectors.CREATE_TASK_BTN).click()

    getTaskForm(0).within(async () => {
      await fillTaskForm(rootTask)
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(openSubtask)
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(completedSubtask)
      cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([openSubtask]) // completed subtask is hidden by default
      await clickSubmitBtnCreate({
        newTasks: [rootTask, openSubtask, completedSubtask],
      })
    })

    checkNumCalls({ create: 3, update: 0 })

    await openTaskEditForm(rootTask)
  })

  it('shows and hides hidden subtasks via the toggle button', () => {
    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([openSubtask])

      cy.get(TaskForm.SUBTASK_SETTINGS_BTN).click()
      cy.get(TaskForm.SHOW_HIDDEN_BTN).click()
      await checkTaskFormSubtasks([openSubtask, completedSubtask])

      cy.get(TaskForm.SHOW_HIDDEN_BTN).click()
      await checkTaskFormSubtasks([openSubtask])
    })
  })

  const showHiddenAndEditSubtask = () => {
    getTaskForm(0).within(async () => {
      cy.get(TaskForm.SUBTASK_SETTINGS_BTN).click()
      cy.get(TaskForm.SHOW_HIDDEN_BTN).click()
      await checkTaskFormSubtasks([openSubtask, completedSubtask])

      cy.get(TaskForm.EDIT_SUBTASK_BTN).first().click()
    })
  }

  const checkAllVisible = () => {
    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([openSubtask, completedSubtask])
    })
  }

  it('preserves show-hidden state after saving a subtask form and returning to the parent', () => {
    showHiddenAndEditSubtask()

    // Save the subtask form without changes — pops back to the parent form
    getTaskForm(1).within(async () => {
      await clickSubmitBtnUpdate()
    })

    // The parent form should still have show-hidden on
    checkAllVisible()
  })

  it('preserves show-hidden state after cancelling a subtask form and returning to the parent', () => {
    showHiddenAndEditSubtask()

    getTaskForm(1).within(() => {
      cy.get(TaskForm.CANCEL_BTN).click()
    })

    // The parent form should still have show-hidden on
    checkAllVisible()
  })
})
