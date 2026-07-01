import { Routes } from '~/client/lib/constants'
import { Priority, TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
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
    buildTask,
  }) => {
    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const orphanTask = buildTask('Orphan Task 1', TaskStatus.PINNED, {
      priority: Priority.HIGH,
    })
    const orphanTask2 = buildTask('Orphan Task 2', TaskStatus.PINNED, {
      priority: Priority.MEDIUM,
    })
    const newSubtask = buildTask('New Subtask', TaskStatus.OPEN, {
      priority: Priority.LOW,
    })

    await test.step('Create dummy orphan tasks (to test order)', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await fillTaskForm(getTaskForm(0), orphanTask)
      await clickSubmitBtnCreate(getTaskForm(0), { newTasks: [orphanTask] })

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await fillTaskForm(getTaskForm(0), orphanTask2)
      await clickSubmitBtnCreate(getTaskForm(0), { newTasks: [orphanTask2] })
    })

    await test.step('Create root task, create new subtask, assign sibling orphanTask', async () => {
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
    })

    await test.step('Edit root task, assign second orphan', async () => {
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
})
