import { Routes } from '~/client/lib/constants'
import { Priority, TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { getPage } from '@test/support/test-globals'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import { getTaskForm, selectDate } from '@test/support/utils/task-form'
import {
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

test.describe('Scheduling', () => {
  const today = new Date()

  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('create a task with a due date, verify due badge displays on task card', async ({
    page,
    buildTask,
  }) => {
    const baseTask = buildTask('Root Task', TaskStatus.PINNED)
    const taskWithDueDate = {
      ...baseTask,
      schedule: {
        // next month, day 15 — avoids today edge cases and always navigates to a future date
        dueAt: new Date(today.getFullYear(), today.getMonth() + 1, 15),
      },
    } as const satisfies CreatedTask

    await test.step('Create task with due date', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const taskWithDueDateForm = getTaskForm(0)
      await taskWithDueDateForm.fillTaskForm(taskWithDueDate)
      await taskWithDueDateForm.clickSubmitBtnCreate({
        newTasks: [taskWithDueDate],
      })
      checkNumCalls({ create: 1, update: 0 })
    })

    await test.step('Verify due badge displays on task card with correct text', async () => {
      await expandAndCheckTree(taskWithDueDate)
    })

    await test.step('Edit task again, clear the due date', async () => {
      await openTaskEditForm(taskWithDueDate)
      const taskWithDueDateForm = getTaskForm(0)
      await taskWithDueDateForm.openMoreSection()
      await page.locator(Selectors.TaskForm.Schedule.CLEAR_DUE_AT_BTN).click()
      await taskWithDueDateForm.clickSubmitBtnUpdate({
        updatedTasks: [baseTask],
      })
      checkNumCalls({ create: 1, update: 1 })
    })

    await test.step('Verify due badge is gone', async () => {
      await expandAndCheckTree(baseTask)
    })
  })

  test('task with hideUntil in the future is hidden from home page', async ({
    buildTask,
  }) => {
    const baseTask = buildTask('Hidden Task', TaskStatus.PINNED)
    const hiddenTask = {
      ...baseTask,
      schedule: {
        // tomorrow
        hideUntil: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
        ),
      },
    } as const satisfies CreatedTask

    await test.step('Create task with hideUntil = tomorrow', async () => {
      await getPage().locator(Selectors.CREATE_TASK_BTN).click()
      const hiddenTaskForm = getTaskForm(0)
      await hiddenTaskForm.fillTaskForm(hiddenTask)
      await hiddenTaskForm.clickSubmitBtnCreate({ newTasks: [hiddenTask] })
    })

    await test.step('Task should not be visible in the home page list', async () => {
      await expect(getPage().getByText(hiddenTask.name)).not.toBeAttached()
    })
  })

  test('priority escalates to the triggered level when its escalation date has passed on page load', async ({
    page,
    buildTask,
  }) => {
    const baseDate = new Date('2025-06-01T12:00:00')
    const escalationDate = new Date('2025-06-02T12:00:00') // tomorrow
    const afterEscalation = new Date('2025-06-04T12:00:00') // 3 days later, past escalation

    await page.clock.install({ time: baseDate })
    await page.reload()

    const baseTask = buildTask('Escalating Task', TaskStatus.PINNED, {
      priority: Priority.LOW,
    })
    const escalatedTask = {
      ...baseTask,
      priority: Priority.HIGH,
    } as const satisfies CreatedTask

    await test.step('Create task with base priority LOW and a HIGH escalation date set to tomorrow', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const taskForm = getTaskForm(0)
      await taskForm.fillTaskForm(baseTask)
      await taskForm.openMoreSection()
      await selectDate(
        page.locator(
          Selectors.TaskForm.Schedule.EscalationPicker(Priority.HIGH),
        ),
        escalationDate,
      )
      await taskForm.clickSubmitBtnCreate({ newTasks: [baseTask] })
      checkNumCalls({ create: 1, update: 0 })
      await expandAndCheckTree(baseTask)
    })

    await test.step('Advance time past the escalation date and reload', async () => {
      await page.clock.fastForward(
        afterEscalation.getTime() - baseDate.getTime(),
      )
      await page.reload()
    })

    await test.step('Priority has automatically escalated to HIGH', async () => {
      await expandAndCheckTree(escalatedTask)
      checkNumCalls({ create: 1, update: 1 })
    })
  })
})
