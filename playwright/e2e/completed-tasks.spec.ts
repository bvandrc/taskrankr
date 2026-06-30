import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
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

const { TaskForm } = Selectors

const task = {
  ...DefaultTaskFields,
  name: taskName('E2E Test Task'),
}

test.describe('Completed Tasks', () => {
  test.beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
    checkTasksDontExistBackend([task])
  })

  for (const { testTitle, setupTask } of [
    {
      testTitle: 'complete task via New Task Form',
      setupTask: async () => {
        // STEP 1: Create task already marked as completed
        cy.get(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(task)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnCreate({
          newTasks: [{ ...task, status: TaskStatus.COMPLETED }],
        })
        checkNumCalls({ create: 1, update: 0 })
      },
    },
    {
      testTitle: 'complete task via Edit Form',
      setupTask: async () => {
        // STEP 1: Create task
        cy.get(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(task)
        await clickSubmitBtnCreate({
          newTasks: [{ ...task, status: TaskStatus.PINNED }],
        })
        checkNumCalls({ create: 1, update: 0 })

        // STEP 2: Edit task, mark as completed
        await openTaskEditForm(task)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        await clickSubmitBtnUpdate({
          updatedTasks: [{ ...task, status: TaskStatus.COMPLETED }],
        })
        checkNumCalls({ create: 1, update: 1 })
      },
    },
    {
      testTitle: 'complete task via Change Status Dialog',
      setupTask: async () => {
        // STEP 1: Create task
        cy.get(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(task)
        await clickSubmitBtnCreate({
          newTasks: [{ ...task, status: TaskStatus.PINNED }],
        })
        checkNumCalls({ create: 1, update: 0 })

        // STEP 2: Complete task via status change dialog
        changeStatusViaStatusChangeDialog(task, TaskStatus.COMPLETED)
        checkNumCalls({ create: 1, update: 1 })
      },
    },
  ] as const) {
    test(`${testTitle} — not in main tree, is on completed page`, async () => {
      setupTask()
      const completedTask = {
        ...task,
        status: TaskStatus.COMPLETED,
      }

      checkTasksExistBackend([completedTask])
      await checkCompletedPage([completedTask])
    })
  }
})
