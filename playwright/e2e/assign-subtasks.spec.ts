import { Routes } from '~/client/lib/constants'
import { Priority, TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
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

test.describe('Assign Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('assign an existing orphaned task as a subtask of a task', async ({
    page,
    taskName,
  }) => {
    const rootTask = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Task'),
      status: TaskStatus.PINNED,
    } as const satisfies CreatedTask
    const orphanTask = {
      ...DefaultTaskFields,
      priority: Priority.HIGH,
      name: taskName('E2E Orphan Task 1'),
      status: TaskStatus.PINNED,
    } as const satisfies CreatedTask
    const orphanTask2 = {
      ...DefaultTaskFields,
      priority: Priority.MEDIUM,
      name: taskName('E2E Orphan Task 2'),
      status: TaskStatus.PINNED,
    } as const satisfies CreatedTask
    const newSubtask = {
      ...DefaultTaskFields,
      priority: Priority.LOW,
      name: taskName('E2E Brand New Subtask'),
      status: TaskStatus.OPEN,
    } as const satisfies CreatedTask

    // STEP: Create orphan tasks
    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), orphanTask)
    await clickSubmitBtnCreate(getTaskForm(0), { newTasks: [orphanTask] })

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), orphanTask2)
    await clickSubmitBtnCreate(getTaskForm(0), { newTasks: [orphanTask2] })

    // STEP 1: Create root task, create new subtask, assign sibling orphanTask
    await page.locator(Selectors.CREATE_TASK_BTN).click()
    const form0 = getTaskForm(0)
    await fillTaskForm(form0, rootTask)
    await assignSubtask(form0, orphanTask)
    // task form re-renders TODO: debug?

    await checkTaskFormSubtasks(getTaskForm(0), [orphanTask])
    await getTaskForm(0).locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    await fillTaskForm(getTaskForm(1), newSubtask)
    await clickSubmitBtnCreate(getTaskForm(1))

    await checkTaskFormSubtasks(getTaskForm(0), [orphanTask, newSubtask])
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [rootTask, newSubtask],
      updatedTasks: [orphanTask],
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [orphanTask, newSubtask],
    })
    checkNumCalls({ create: 4, update: 1 })

    // STEP 2: Edit root task, assign second orphan
    await openTaskEditForm(rootTask)
    const editForm0 = getTaskForm(0)
    await checkTaskFormSubtasks(editForm0, [orphanTask, newSubtask])
    await assignSubtask(editForm0, orphanTask2)
    await checkTaskFormSubtasks(getTaskForm(0), [
      // all at same level, so we don't care about order really.
      orphanTask,
      orphanTask2,
      newSubtask,
    ])
    await clickSubmitBtnUpdate(getTaskForm(0), {
      updatedTasks: [rootTask, orphanTask2],
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [orphanTask, newSubtask, orphanTask2],
    })
    checkNumCalls({ create: 4, update: 3 })
  })
})
