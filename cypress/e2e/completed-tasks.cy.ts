import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@cypress/support/constants'
import {
  checkTasksDontExistBackend,
  checkTasksExistBackend,
  isLoggedIn,
} from '@cypress/support/utils'
import { checkNumCalls } from '@cypress/support/utils/intercepts'
import {
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
} from '@cypress/support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  checkCompletedPage,
  openTaskEditForm,
} from '@cypress/support/utils/task-tree'

import { TaskStatus } from '~/shared/schema'

const { TaskForm } = Selectors

describe('Completed Tasks', () => {
  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
    checkTasksDontExistBackend([DefaultTask])
  })

  for (const { testTitle, setupTask } of [
    {
      testTitle: 'complete task via New Task Form',
      setupTask: () => {
        cy.get(Selectors.CREATE_TASK_BTN).click()
        fillTaskForm(DefaultTask)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        clickSubmitBtnCreate({
          newTasks: [{ ...DefaultTask, status: TaskStatus.COMPLETED }],
        })
        checkNumCalls({ create: 1, update: 0 })
      },
    },
    {
      testTitle: 'complete task via Edit Form',
      setupTask: () => {
        cy.get(Selectors.CREATE_TASK_BTN).click()
        fillTaskForm(DefaultTask)
        clickSubmitBtnCreate({
          newTasks: [{ ...DefaultTask, status: TaskStatus.PINNED }],
        })
        checkNumCalls({ create: 1, update: 0 })

        openTaskEditForm(DefaultTask)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        clickSubmitBtnUpdate({
          updatedTasks: [{ ...DefaultTask, status: TaskStatus.COMPLETED }],
        })
        checkNumCalls({ create: 1, update: 1 })
      },
    },
    {
      testTitle: 'complete task via Change Status Dialog',
      setupTask: () => {
        cy.get(Selectors.CREATE_TASK_BTN).click()
        fillTaskForm(DefaultTask)
        clickSubmitBtnCreate({
          newTasks: [{ ...DefaultTask, status: TaskStatus.PINNED }],
        })
        checkNumCalls({ create: 1, update: 0 })
        changeStatusViaStatusChangeDialog(DefaultTask, TaskStatus.COMPLETED)
        checkNumCalls({ create: 1, update: 1 })
      },
    },
  ] as const) {
    it(`${testTitle} — not in main tree, is on completed page`, () => {
      setupTask()
      const completedTask = { ...DefaultTask, status: TaskStatus.COMPLETED }

      checkTasksExistBackend([completedTask])
      checkCompletedPage([completedTask])
    })
  }
})
