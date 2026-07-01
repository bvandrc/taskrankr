import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { checkNumCalls } from '@test/support/utils/intercepts'
import {
  checkDate,
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
  getTaskForm,
  selectDate,
} from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'

test.describe('Edit Task', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('date created shows today and can be changed via the date picker', async ({
    page,
    buildTask,
  }) => {
    const task = buildTask('Root Task', TaskStatus.PINNED)

    const today = new Date()
    // Pick a day in the same month that isn't today
    const newDay = today.getDate() === 1 ? 2 : 1
    const newDate = new Date(today.getFullYear(), today.getMonth(), newDay)

    await test.step('Create task', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      await fillTaskForm(getTaskForm(0), task)
      await clickSubmitBtnCreate(getTaskForm(0), { newTasks: [task] })
    })

    await test.step('Open edit form, verify Date Created shows today', async () => {
      await openTaskEditForm(task)
      await checkDate(
        getTaskForm(0).locator(Selectors.TaskForm.DATE_CREATED_PICKER),
        today,
      )
    })

    await test.step('Open calendar and pick a different day', async () => {
      await selectDate(
        getTaskForm(0).locator(Selectors.TaskForm.DATE_CREATED_PICKER),
        newDate,
      )
    })

    await test.step('Save and verify update count', async () => {
      await clickSubmitBtnUpdate(getTaskForm(0), { updatedTasks: [task] })
      checkNumCalls({ create: 1, update: 1 })
    })

    await test.step('Re-open edit form, verify date was persisted', async () => {
      await openTaskEditForm(task)
      await checkDate(
        getTaskForm(0).locator(Selectors.TaskForm.DATE_CREATED_PICKER),
        newDate,
      )
    })
  })
})
