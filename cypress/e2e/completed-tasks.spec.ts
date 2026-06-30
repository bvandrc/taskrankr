import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@test/support/constants'
import {
  checkTasksDontExistBackend,
  checkTasksExistBackend,
  isLoggedIn,
} from '@test/support/utils'
import { checkNumCalls } from '@test/support/utils/intercepts'
import {
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
} from '@test/support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  checkCompletedPage,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

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
        cy.log('Step 1: Create task already marked as completed')
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
        cy.log('Step 1: Create task')
        cy.get(Selectors.CREATE_TASK_BTN).click()
        fillTaskForm(DefaultTask)
        clickSubmitBtnCreate({
          newTasks: [{ ...DefaultTask, status: TaskStatus.PINNED }],
        })
        checkNumCalls({ create: 1, update: 0 })

        cy.log('Step 2: Edit task, mark as completed')
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
        cy.log('Step 1: Create task')
        cy.get(Selectors.CREATE_TASK_BTN).click()
        fillTaskForm(DefaultTask)
        clickSubmitBtnCreate({
          newTasks: [{ ...DefaultTask, status: TaskStatus.PINNED }],
        })
        checkNumCalls({ create: 1, update: 0 })

        cy.log('Step 2: Complete task via status change dialog')
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
