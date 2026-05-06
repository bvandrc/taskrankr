import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@cypress/support/constants'
import { checkTasksExistBackend, isLoggedIn } from '@cypress/support/utils'
import {
  type CreatedTask,
  checkNumCalls,
} from '@cypress/support/utils/intercepts'
import { goToCompletedPage } from '@cypress/support/utils/navigation'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@cypress/support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  expandAndCheckTree,
  openTaskEditForm,
} from '@cypress/support/utils/task-tree'

import { TaskStatus } from '~/shared/schema'

const { TaskForm } = Selectors

describe('Completed Subtasks', () => {
  const rootTask = {
    ...DefaultTask,
    name: 'E2E Root Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const subtask = {
    ...DefaultTask,
    name: 'E2E Subtask',
    status: TaskStatus.OPEN,
  } as const satisfies CreatedTask

  const completedSubtask = {
    ...subtask,
    status: TaskStatus.COMPLETED,
  } as const satisfies CreatedTask

  const subtask2 = {
    ...DefaultTask,
    name: 'E2E Subtask 2',
    status: TaskStatus.OPEN,
  } as const satisfies CreatedTask

  const completedSubtask2 = {
    ...subtask2,
    status: TaskStatus.COMPLETED,
  } as const satisfies CreatedTask

  const createUncompletedSubtask = () => {
    cy.log('Create root task with uncompleted subtask')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    getTaskForm(0).within(() => {
      fillTaskForm(rootTask)
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(() => {
      fillTaskForm(subtask)
      clickSubmitBtnCreate()
    })

    getTaskForm(0).within(() => {
      clickSubmitBtnCreate({ newTasks: [rootTask, subtask] })
    })

    checkNumCalls({ create: 2, update: 0 })
  }

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  for (const { testTitle, markSubtaskComplete } of [
    {
      testTitle: 'complete subtask via New Task Form',
      markSubtaskComplete: () => {
        cy.get(Selectors.CREATE_TASK_BTN).click()
        getTaskForm(0).within(() => {
          fillTaskForm(rootTask)
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask)
          cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
          clickSubmitBtnCreate()
        })

        getTaskForm(0).within(() => {
          checkTaskFormSubtasks([completedSubtask])
          clickSubmitBtnCreate({ newTasks: [rootTask, completedSubtask] })
        })

        checkNumCalls({ create: 2, update: 0 })
      },
    },
    {
      testTitle: 'complete subtask via Edit Form',
      markSubtaskComplete: () => {
        createUncompletedSubtask()
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] }) // expands the tree

        openTaskEditForm(subtask)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        clickSubmitBtnUpdate({
          updatedTasks: [{ ...subtask, status: TaskStatus.COMPLETED }],
        })
        checkNumCalls({ create: 2, update: 1 })
      },
    },
    {
      testTitle: 'complete subtask via Change Status Dialog',
      markSubtaskComplete: () => {
        createUncompletedSubtask()
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] }) // expands the tree
        changeStatusViaStatusChangeDialog(subtask, TaskStatus.COMPLETED)
        checkNumCalls({ create: 2, update: 1 })
      },
    },
  ] as const) {
    it(`${testTitle} - present in main tree as crossed out, not in completed page`, () => {
      markSubtaskComplete()
      expandAndCheckTree({ ...rootTask, subtasks: [completedSubtask] })
      checkTasksExistBackend([completedSubtask])

      goToCompletedPage()
      cy.contains(subtask.name).should('not.exist')
      cy.contains(rootTask.name).should('not.exist')
    })
  }

  context('Auto-hide completed subtasks', () => {
    context('When creating a new root task', () => {
      beforeEach(() => {
        cy.get(Selectors.CREATE_TASK_BTN).click()
        getTaskForm(0).within(() => {
          fillTaskForm(rootTask)
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          // task that will not be marked as completed, to verify that only completed subtasks are hidden
          fillTaskForm(subtask)
          clickSubmitBtnCreate()
        })

        getTaskForm(0).within(() => {
          cy.get(TaskForm.SUBTASK_SETTINGS_BTN).click()
          cy.get(TaskForm.AUTOHIDE_COMPLETED_SUBTASKS_SWITCH).toggleState(true)
        })
      })

      // after each, but we don't want failure to prevent other tests from running.
      const afterEachSafe = () => {
        getTaskForm(0).within(() => {
          cy.get(TaskForm.SUBTASK_SETTINGS_BTN).click() // show settings for debug purposes
          cy.get(TaskForm.AUTOHIDE_COMPLETED_SUBTASKS_SWITCH)
            .getCheckedState()
            .should('be.true')
          checkTaskFormSubtasks([subtask])
          clickSubmitBtnCreate({
            newTasks: [rootTask, subtask, completedSubtask2],
          })
        })

        checkNumCalls({ create: 3, update: 0 })
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      }

      it('via completion checkbox in new subtask form', () => {
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask2)
          cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
          clickSubmitBtnCreate()
        })

        afterEachSafe()
      })

      it('via completion checkbox in edit subtask form', () => {
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask2)
          clickSubmitBtnCreate()
        })

        getTaskForm(0).within(() => {
          checkTaskFormSubtasks([subtask, subtask2])
          cy.get(TaskForm.EDIT_SUBTASK_BTN).last().click()
        })

        getTaskForm(1).within(() => {
          cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
          clickSubmitBtnCreate()
        })

        afterEachSafe()
      })
    })

    context('When editing an existing root task', () => {
      it('with subtasks already completed', () => {
        cy.get(Selectors.CREATE_TASK_BTN).click()
        getTaskForm(0).within(() => {
          fillTaskForm(rootTask)
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask)
          clickSubmitBtnCreate()
        })

        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask2)
          cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
          clickSubmitBtnCreate()
        })

        const subtasks = [subtask, completedSubtask2]

        getTaskForm(0).within(() => {
          checkTaskFormSubtasks(subtasks)
          clickSubmitBtnCreate({ newTasks: [rootTask, ...subtasks] })
        })

        expandAndCheckTree({ ...rootTask, subtasks })
        checkNumCalls({ create: 3, update: 0 })

        openTaskEditForm(rootTask)
        getTaskForm(0).within(() => {
          checkTaskFormSubtasks(subtasks)

          cy.get(TaskForm.SUBTASK_SETTINGS_BTN).click()
          cy.get(TaskForm.AUTOHIDE_COMPLETED_SUBTASKS_SWITCH).toggleState(true)
          checkTaskFormSubtasks([subtask])
          clickSubmitBtnUpdate({ updatedTasks: [rootTask] })
        })

        checkNumCalls({ create: 3, update: 1 })
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      })
    })
  })
})
