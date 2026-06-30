import { Routes } from '../../client/src/lib/constants'
import { type FieldConfig, TaskStatus } from '../../shared/schema'
import { DefaultTaskFields, Selectors } from '../support/constants'
import { test } from '../support/fixtures'
import { checkNumCalls } from '../support/utils/intercepts'
import { setSettings } from '../support/utils/settings'
import {
  clickSubmitBtnCreate,
  fillTaskForm,
  getTaskForm,
} from '../support/utils/task-form'
import { expandAndCheckTree } from '../support/utils/task-tree'

test.describe('Task Creation', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('create a task, check displays in main tree', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Level Task'),
      status: TaskStatus.PINNED,
    }

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, task)
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [task],
    })

    await expandAndCheckTree(page, task)
    checkNumCalls(requestTracker, isLoggedIn, { create: 1 })
  })

  test('change rank field visibility/required in settings, check form matches new settings, create task', async ({
    page,
    isLoggedIn,
    taskName,
    requestTracker,
  }) => {
    const fieldConfig = {
      priority: { visible: true, required: true },
      ease: { visible: true, required: false },
      enjoyment: { visible: false, required: false },
      time: { visible: true, required: false },
    } as const satisfies FieldConfig

    const task = {
      ...DefaultTaskFields,
      name: taskName('Field Config Test Task'),
      status: TaskStatus.PINNED,
      ease: null,
      enjoyment: null,
    }

    await setSettings(page, isLoggedIn, requestTracker, { fieldConfig })
    checkNumCalls(requestTracker, isLoggedIn, { updateSettings: 3 })
    await page.locator(Selectors.BACK_BTN).click()

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, task, {
      settings: fieldConfig,
    })
    await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
      newTasks: [task],
    })
    await expandAndCheckTree(page, task, { settings: fieldConfig })
    checkNumCalls(requestTracker, isLoggedIn, { create: 1 })
  })
})
