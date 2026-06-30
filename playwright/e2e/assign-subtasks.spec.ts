import { Routes } from '~/client/lib/constants'
import { Priority, TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { isLoggedIn } from '@test/support/utils'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import {
  assignSubtask,
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

const { TaskForm } = Selectors

describe('Assign Subtasks', () => {
  const rootTask = {
    ...DefaultTaskFields,
    name: 'E2E Root Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const orphanTask = {
    ...DefaultTaskFields,
    priority: Priority.HIGH,
    name: 'E2E Orphan Task 1',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const orphanTask2 = {
    ...DefaultTaskFields,
    priority: Priority.MEDIUM,
    name: 'E2E Orphan Task 2',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  const newSubtask = {
    ...DefaultTaskFields,
    priority: Priority.LOW,
    name: 'E2E Brand New Subtask',
    status: TaskStatus.OPEN,
  } as const satisfies CreatedTask

  beforeEach(async () => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)

    // STEP: Create orphan tasks
    cy.get(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(orphanTask)
    await clickSubmitBtnCreate({ newTasks: [orphanTask] })

    cy.get(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(orphanTask2)
    await clickSubmitBtnCreate({ newTasks: [orphanTask2] })
  })

  test('assign an existing orphaned task as a subtask of a task', async () => {
    // STEP: Step 1: Create root task, create new subtask, assign sibling orphanTask
    cy.get(Selectors.CREATE_TASK_BTN).click()
    getTaskForm(0).within(async () => {
      await fillTaskForm(rootTask)
      await assignSubtask(orphanTask)
    })
    // task form re-renders TODO: debug?
    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([orphanTask])
      cy.get(TaskForm.ADD_SUBTASK_BTN).click()
    })

    getTaskForm(1).within(async () => {
      await fillTaskForm(newSubtask)
      await clickSubmitBtnCreate()
    })

    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([orphanTask, newSubtask])
      await clickSubmitBtnCreate({
        newTasks: [rootTask, newSubtask],
        updatedTasks: [orphanTask],
      })
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [orphanTask, newSubtask],
    })
    checkNumCalls({ create: 4, update: 1 })

    // STEP: Step 2: Edit root task, assign second orphan
    await openTaskEditForm(rootTask)
    getTaskForm(0).within(async () => {
      await checkTaskFormSubtasks([orphanTask, newSubtask])
      await assignSubtask(orphanTask2)
      await checkTaskFormSubtasks([orphanTask, orphanTask2, newSubtask]) // all at same level, so we don't care about orde really.
      await clickSubmitBtnUpdate({ updatedTasks: [rootTask, orphanTask2] })
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [orphanTask, newSubtask, orphanTask2],
    })
    checkNumCalls({ create: 4, update: 3 })
  })
})
