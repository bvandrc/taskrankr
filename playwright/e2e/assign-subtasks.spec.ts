import { Routes } from '~/client/lib/constants'
import { Priority, TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
import { getTaskForm } from '@test/support/utils/task-form'
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
      const orphanTaskForm = getTaskForm(0)
      await orphanTaskForm.fillTaskForm(orphanTask)
      await orphanTaskForm.clickSubmitBtnCreate({ newTasks: [orphanTask] })

      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const orphanTask2Form = getTaskForm(0)
      await orphanTask2Form.fillTaskForm(orphanTask2)
      await orphanTask2Form.clickSubmitBtnCreate({ newTasks: [orphanTask2] })
    })

    await test.step('Create root task, create new subtask, assign sibling orphanTask', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const rootTaskForm = getTaskForm(0)
      await rootTaskForm.fillTaskForm(rootTask)
      await rootTaskForm.assignSubtask(orphanTask)

      await rootTaskForm.checkTaskFormSubtasks([orphanTask])
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const newSubtaskForm = getTaskForm(1)
      await newSubtaskForm.fillTaskForm(newSubtask)
      await newSubtaskForm.clickSubmitBtnCreate()

      await rootTaskForm.checkTaskFormSubtasks([orphanTask, newSubtask])
      await rootTaskForm.clickSubmitBtnCreate({
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
      const rootTaskForm = getTaskForm(0)
      await rootTaskForm.checkTaskFormSubtasks([orphanTask, newSubtask])
      await rootTaskForm.assignSubtask(orphanTask2)
      await rootTaskForm.checkTaskFormSubtasks([
        // all at same level, so we don't care about order really.
        orphanTask,
        orphanTask2,
        newSubtask,
      ])
      await rootTaskForm.clickSubmitBtnUpdate({
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
