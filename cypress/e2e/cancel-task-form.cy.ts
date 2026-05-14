import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@cypress/support/constants'
import { checkTasksDontExistBackend } from '@cypress/support/utils/api'
import {
  type CreatedTask,
  checkNumCalls,
} from '@cypress/support/utils/intercepts'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  fillTaskForm,
  getTaskForm,
} from '@cypress/support/utils/task-form'
import { openTaskEditForm } from '@cypress/support/utils/task-tree'
import { isLoggedIn } from '@cypress/support/utils/test-runner'

import { TaskStatus } from '~/shared/schema'

const { TaskForm, ConfirmDialog } = Selectors

const rootTask = {
  ...DefaultTask,
  name: 'E2E Root Task',
  status: TaskStatus.PINNED,
} as const satisfies CreatedTask

const subtask = {
  ...DefaultTask,
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

describe('Task Form Cancellation', () => {
  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  for (const { contextName, beforeEachHook, afterEachHook } of [
    {
      contextName: 'New Task',
      beforeEachHook: () => {
        cy.log('Open new task form and fill')
        cy.get(Selectors.CREATE_TASK_BTN).click()
        getTaskForm(0).within(() => {
          fillTaskForm(rootTask)
        })
      },
      afterEachHook: () => {
        checkTasksDontExist([rootTask, subtask, subtask2])
        checkNumCalls({ create: 0, update: 0 })
      },
    },
    {
      contextName: 'Edit Task',
      beforeEachHook: () => {
        cy.log('Create root task')
        cy.get(Selectors.CREATE_TASK_BTN).click()
        getTaskForm(0).within(() => {
          fillTaskForm(rootTask)
          clickSubmitBtnCreate({ newTasks: [rootTask] })
        })

        cy.log('Open edit form')
        openTaskEditForm(rootTask)
        checkNumCalls({ create: 1, update: 0 })
      },
      afterEachHook: () => {
        checkTasksDontExist([subtask, subtask2])
        checkNumCalls({ create: 1, update: 0 })
      },
    },
  ] as const) {
    context(contextName, () => {
      beforeEach(beforeEachHook)

      // after each, but we don't want failure to prevent other tests from running.
      const afterEachSafe = () => {
        afterEachHook()
        cy.get(TaskForm.CANCEL_CONFIRM_DIALOG).should('not.exist')
        cy.get(TaskForm.FORM).should('not.exist')
      }

      if (contextName === 'New Task') {
        it('cancel on create form before adding any subtask — dialog closes, no task created', () => {
          getTaskForm(0).within(() => {
            cy.get(TaskForm.CANCEL_BTN).click()
          })
          afterEachSafe()
        })
      }

      it('cancel on parent form after a subtask was added — confirmation dialog appears, discard removes all', () => {
        cy.log('Step 1: Add a subtask')
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask)
          clickSubmitBtnCreate()
        })

        cy.log('Step 2: Cancel parent form — expect confirmation dialog')
        getTaskForm(0).within(() => {
          checkTaskFormSubtasks([subtask])
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        cy.get(TaskForm.CANCEL_CONFIRM_DIALOG)
          .should('be.visible')
          .should('contain.text', '1 unsaved subtask')
        cy.get(ConfirmDialog.CONFIRM_BTN).click()
        afterEachSafe()
      })

      it('cancel on parent form after multiple subtasks were added — confirmation shows correct count, discard removes all', () => {
        cy.log('Step 1: Add two subtasks')
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

        cy.log(
          'Step 2: Cancel parent form — deny discard, verify form preserved',
        )
        getTaskForm(0).within(() => {
          checkTaskFormSubtasks([subtask, subtask2])
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        cy.get(TaskForm.CANCEL_CONFIRM_DIALOG)
          .should('be.visible')
          .should('contain.text', '2 unsaved subtask')
        cy.get(ConfirmDialog.DENY_BTN).click()

        getTaskForm(0).within(() => {
          cy.get(TaskForm.NAME_INPUT).should('have.value', rootTask.name)
          checkTaskFormSubtasks([subtask, subtask2])
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        cy.log(
          'Step 3: Cancel parent form — confirm discard, verify all removed',
        )
        cy.get(TaskForm.CANCEL_CONFIRM_DIALOG)
          .should('be.visible')
          .should('contain.text', '2 unsaved subtask')
        cy.get(ConfirmDialog.CONFIRM_BTN).click()
        afterEachSafe()
      })

      it('cancel on subtask form navigates back to parent, then cancel on parent discards all without confirmation', () => {
        cy.log('Step 1: Open subtask form, cancel — returns to parent')
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          cy.get(TaskForm.NAME_INPUT).type(subtask.name)
          cy.get(TaskForm.CANCEL_BTN).click()
        })

        cy.log('Step 2: Cancel parent form — no confirmation needed')
        getTaskForm(0).within(() => {
          cy.get(TaskForm.NAME_INPUT).should('have.value', rootTask.name)
          cy.get(TaskForm.CANCEL_BTN).click()
        })
        afterEachSafe()
      })
    })
  }
})
