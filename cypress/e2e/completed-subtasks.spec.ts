import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTask, Selectors } from '@cypress/support/constants'
import { checkTasksExistBackend, isLoggedIn } from '@cypress/support/utils'
import {
  type CreatedTask,
  checkNumCalls,
} from '@cypress/support/utils/intercepts'
import { goToCompletedPage } from '@cypress/support/utils/navigation'
import {
  checkTaskFormSubtaskSettings,
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
  setTaskFormSubtaskSettings,
} from '@cypress/support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  checkCompletedPage,
  expandAndCheckTree,
  openTaskEditForm,
} from '@cypress/support/utils/task-tree'

const { TaskForm } = Selectors

describe('Completed Subtasks', () => {
  const rootTask = {
    ...DefaultTask,
    name: 'E2E Root Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const completedRootTask = {
    ...rootTask,
    status: TaskStatus.COMPLETED,
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
      setTaskFormSubtaskSettings({ autoHideCompleted: false })
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
        cy.log('Step 1: Create root task with subtask pre-marked as completed')
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
          setTaskFormSubtaskSettings({ autoHideCompleted: false })
          checkTaskFormSubtasks([completedSubtask])
          clickSubmitBtnCreate({ newTasks: [rootTask, completedSubtask] })
        })

        checkNumCalls({ create: 2, update: 0 })
      },
    },
    {
      testTitle: 'complete subtask via Edit Form',
      markSubtaskComplete: () => {
        cy.log('Step 1: Create root task with uncompleted subtask')
        createUncompletedSubtask()
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] }) // expands the tree

        cy.log('Step 2: Edit subtask, mark as completed')
        openTaskEditForm(subtask)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
        clickSubmitBtnUpdate({ updatedTasks: [completedSubtask] })
        checkNumCalls({ create: 2, update: 1 })
      },
    },
    {
      testTitle: 'complete subtask via Change Status Dialog',
      markSubtaskComplete: () => {
        cy.log('Step 1: Create root task with uncompleted subtask')
        createUncompletedSubtask()
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] }) // expands the tree

        cy.log('Step 2: Complete subtask via status change dialog')
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

  context('Auto-complete parent when all subtasks completed', () => {
    it('auto-completes parent when inheritCompletionState is enabled first, then the last subtask becomes completed', () => {
      cy.log('Step 1: Create root task (autocomplete=on) with one subtask')
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
        setTaskFormSubtaskSettings({
          autoHideCompleted: false,
          inheritCompletionState: true,
        })
        clickSubmitBtnCreate({ newTasks: [rootTask, subtask] })
      })

      checkNumCalls({ create: 2, update: 0 })
      expandAndCheckTree({ ...rootTask, subtasks: [subtask] })

      cy.log('Step 2: Complete subtask — parent auto-completes')
      changeStatusViaStatusChangeDialog(subtask, TaskStatus.COMPLETED, {
        sideEffects: [completedRootTask], // Parent auto-completes as the last subtask is marked done
      })

      checkNumCalls({ create: 2, update: 2 })
      checkCompletedPage([
        { ...completedRootTask, subtasks: [completedSubtask] },
      ])
    })

    it('auto-completes parent when inheritCompletionState becomes enabled after all subtasks are already completed', () => {
      cy.log('Step 1: Create task with completed subtask')
      cy.get(Selectors.CREATE_TASK_BTN).click()
      getTaskForm(0).within(() => {
        fillTaskForm(rootTask)
        cy.get(TaskForm.ADD_SUBTASK_BTN).click()
      })

      getTaskForm(1).within(() => {
        fillTaskForm(subtask)
        cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).toggleState(true)
        clickSubmitBtnCreate()
      })

      getTaskForm(0).within(() => {
        setTaskFormSubtaskSettings({ autoHideCompleted: false })
        clickSubmitBtnCreate({ newTasks: [rootTask, completedSubtask] })
      })
      expandAndCheckTree({ ...rootTask, subtasks: [completedSubtask] })

      cy.log(
        'Step 2: Enable inheritCompletionState — parent auto-completes immediately',
      )
      openTaskEditForm(rootTask)
      getTaskForm(0).within(() => {
        setTaskFormSubtaskSettings({ inheritCompletionState: true })
        clickSubmitBtnUpdate({ updatedTasks: [completedRootTask] })
      })

      checkNumCalls({ create: 2, update: 1 })
      checkCompletedPage([
        { ...completedRootTask, subtasks: [completedSubtask] },
      ])
    })

    it('auto-completes grandparent chain when completing the last subtask', () => {
      cy.log('Step 1: Create root task with subtask, set autocomplete=on')
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
        setTaskFormSubtaskSettings({
          autoHideCompleted: false,
          inheritCompletionState: true,
        })
        clickSubmitBtnCreate({ newTasks: [rootTask, subtask] })
      })
      checkNumCalls({ create: 2, update: 0 })
      expandAndCheckTree({ ...rootTask, subtasks: [subtask] })

      cy.log(
        'Step 2: Edit subtask to enable autocomplete and add subtask2 as its child',
      )
      openTaskEditForm(subtask)
      // TODO: would be nice if we could base `data-tier` by the level of dialog it is, not by the level in tree
      getTaskForm(1).within(() => {
        cy.get(TaskForm.ADD_SUBTASK_BTN).click()
      })
      getTaskForm(2).within(() => {
        fillTaskForm(subtask2)
        clickSubmitBtnCreate()
      })
      getTaskForm(1).within(() => {
        setTaskFormSubtaskSettings({
          autoHideCompleted: false,
          inheritCompletionState: true,
        })
        clickSubmitBtnUpdate({ updatedTasks: [subtask] })
      })
      checkNumCalls({ create: 3, update: 1 })
      expandAndCheckTree({
        ...rootTask,
        subtasks: [{ ...subtask, subtasks: [subtask2] }],
      })

      cy.log(
        'Step 3: Complete subtask2 — subtask and rootTask both auto-complete',
      )
      changeStatusViaStatusChangeDialog(subtask2, TaskStatus.COMPLETED, {
        sideEffects: [completedSubtask, completedRootTask], // Parent and grandparent auto-completes as the last subtask is marked done
      })
      checkNumCalls({ create: 3, update: 4 })
      checkCompletedPage([
        {
          ...completedRootTask,
          subtasks: [{ ...completedSubtask, subtasks: [completedSubtask2] }],
        },
      ])
    })
  })

  context('Auto-hide completed subtasks', () => {
    context('When creating a new root task', () => {
      beforeEach(() => {
        cy.log(
          'Create root task with one uncompleted subtask, enable auto-hide',
        )
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
          // default value
          checkTaskFormSubtaskSettings({ autoHideCompleted: true })
        })
      })

      // after each, but we don't want failure to prevent other tests from running.
      const afterEachSafe = () => {
        getTaskForm(0).within(() => {
          checkTaskFormSubtaskSettings({ autoHideCompleted: true })
          checkTaskFormSubtasks([subtask])
          clickSubmitBtnCreate({
            newTasks: [rootTask, subtask, completedSubtask2],
          })
        })

        checkNumCalls({ create: 3, update: 0 })
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      }

      it('via completion checkbox in new subtask form', () => {
        cy.log('Step 1: Add a second subtask, mark it completed in the form')
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask2)
          cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
          clickSubmitBtnCreate()
        })

        cy.log('Step 2: Submit root task — completed subtask hidden in tree')
        afterEachSafe()
      })

      it('via completion checkbox in edit subtask form', () => {
        cy.log('Step 1: Add a second subtask')
        getTaskForm(0).within(() => {
          cy.get(TaskForm.ADD_SUBTASK_BTN).click()
        })

        getTaskForm(1).within(() => {
          fillTaskForm(subtask2)
          clickSubmitBtnCreate()
        })

        cy.log('Step 2: Edit the second subtask, mark it completed')
        getTaskForm(0).within(() => {
          checkTaskFormSubtasks([subtask, subtask2])
          cy.get(TaskForm.EDIT_SUBTASK_BTN).last().click()
        })

        getTaskForm(1).within(() => {
          cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
          clickSubmitBtnCreate()
        })

        cy.log('Step 3: Submit root task — completed subtask hidden in tree')
        afterEachSafe()
      })
    })

    context('When editing an existing root task', () => {
      it('with subtasks already completed', () => {
        cy.log(
          'Step 1: Create root task with one open and one completed subtask',
        )
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
          setTaskFormSubtaskSettings({ autoHideCompleted: false })
          checkTaskFormSubtasks(subtasks)
          clickSubmitBtnCreate({ newTasks: [rootTask, ...subtasks] })
        })

        expandAndCheckTree({ ...rootTask, subtasks })
        checkNumCalls({ create: 3, update: 0 })

        cy.log(
          'Step 2: Edit root task, enable auto-hide — completed subtask disappears from form',
        )
        openTaskEditForm(rootTask)
        getTaskForm(0).within(() => {
          checkTaskFormSubtasks(subtasks)

          setTaskFormSubtaskSettings({ autoHideCompleted: true })
          checkTaskFormSubtasks([subtask])
          clickSubmitBtnUpdate({ updatedTasks: [rootTask] })
        })

        checkNumCalls({ create: 3, update: 1 })
        expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      })
    })
  })
})
