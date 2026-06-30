import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { checkTasksDontExistBackend } from '@test/support/utils/api'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'
import { isLoggedIn } from '@test/support/utils/test-runner'

const { TaskForm, ConfirmDialog } = Selectors

const rootTask = {
  ...DefaultTaskFields,
  name: 'E2E Root Task',
  status: TaskStatus.PINNED,
} as const satisfies CreatedTask

const subtask = {
  ...DefaultTaskFields,
  name: 'E2E Subtask 1',
  status: TaskStatus.OPEN,
} as const satisfies CreatedTask

const subtask2 = {
  ...subtask,
  name: 'E2E Subtask 2',
} as const satisfies CreatedTask

const checkTasksDontExist = (tasks: CreatedTask[]) => {
  tasks.forEach((task) => {
    cy.contains(task.name).should('not.exist')
  })
  checkTasksDontExistBackend(tasks)
}

const checkCancelWarningDialog = (count: number) =>
  cy
    .get(TaskForm.CANCEL_CONFIRM_DIALOG)
    .should('be.visible')
    .should('contain.text', `${count} unsaved subtask`)

test.describe('Task Form Cancellation', () => {
  test.beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  for (const { contextName, beforeEachHook, afterEachHook } of [
    {
      contextName: 'New Task',
      beforeEachHook: () => {
        // STEP: Open new task form and fill
        cy.get(Selectors.CREATE_TASK_BTN).click()
        getTaskForm(0).within(async () => {
          await fillTaskForm(rootTask)
        })
      },
      afterEachHook: () => {
        checkTasksDontExist([rootTask, subtask, subtask2])
        checkNumCalls({ create: 0, update: 0 })
      },
    },
    {
      contextName: 'Edit Task',
      beforeEachHook: async () => {
        // STEP: Create root task
        cy.get(Selectors.CREATE_TASK_BTN).click()
        getTaskForm(0).within(async () => {
          await fillTaskForm(rootTask)
          await clickSubmitBtnCreate({ newTasks: [rootTask] })
        })

        // STEP: Open edit form
        await openTaskEditForm(rootTask)
        checkNumCalls({ create: 1, update: 0 })
      },
      afterEachHook: () => {
        checkTasksDontExist([subtask, subtask2])
        checkNumCalls({ create: 1, update: 0 })
      },
    },
  ] as const) {
    context(contextName, () => {
      test.beforeEach(beforeEachHook)

      // after each, but we don't want failure to prevent other tests from running.
      const afterEachSafe = () => {
        afterEachHook()
        cy.get(TaskForm.CANCEL_CONFIRM_DIALOG).should('not.exist')
        cy.get(TaskForm.FORM).should('not.exist')
      }

      if (contextName === 'New Task') {
        test('cancel on create form before adding any subtask — dialog closes, no task created', () => {
          getTaskForm(0).within(() => {
            cy.get(TaskForm.CANCEL_BTN).click()
          })
          afterEachSafe()
        })
      }

      test('cancel on parent form after a subtask was added — confirmation dialog appears, discard removes all', () => {
        // STEP: Step 1: Add a subtask
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(async () => {
          await fillTaskForm(subtask)
          await clickSubmitBtnCreate()
        })

        // STEP: Step 2: Cancel parent form — expect confirmation dialog
        getTaskForm(0).within(async () => {
          await checkTaskFormSubtasks([subtask])
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        checkCancelWarningDialog(1)
        cy.get(ConfirmDialog.CONFIRM_BTN).click()
        afterEachSafe()
      })

      test('cancel on parent form after multiple subtasks were added — confirmation shows correct count, discard removes all', () => {
        // STEP: Step 1: Add two subtasks
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

        // STEP: Step 2: Cancel parent form — deny discard, verify form preserved
        getTaskForm(0).within(async () => {
          await checkTaskFormSubtasks([subtask, subtask2])
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        checkCancelWarningDialog(2)
        cy.get(ConfirmDialog.DENY_BTN).click()

        getTaskForm(0).within(async () => {
          cy.get(TaskForm.NAME_INPUT).should('have.value', rootTask.name)
          await checkTaskFormSubtasks([subtask, subtask2])
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        // STEP: Step 3: Cancel parent form — confirm discard, verify all removed
        checkCancelWarningDialog(2)
        cy.get(ConfirmDialog.CONFIRM_BTN).click()
        afterEachSafe()
      })

      test('cancel on subtask form navigates back to parent, then cancel on parent discards all without confirmation', () => {
        // STEP: Step 1: Open subtask form, cancel — returns to parent
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          cy.get(TaskForm.NAME_INPUT).type(subtask.name)
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        // STEP: Step 2: Cancel parent form — no confirmation needed
        getTaskForm(0).within(() => {
          cy.get(TaskForm.NAME_INPUT).should('have.value', rootTask.name)
          cy.get(TaskForm.CANCEL_BTN).click()
        })
        afterEachSafe()
      })
    })
  }
})
