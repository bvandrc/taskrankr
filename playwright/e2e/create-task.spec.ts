import { Routes } from '~/client/lib/constants'
import { type FieldConfig, TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { getPage } from '@test/support/page-context'
import { checkNumCalls } from '@test/support/utils/intercepts'
import { setSettings } from '@test/support/utils/settings'
import {
  clickSubmitBtnCreate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import { expandAndCheckTree } from '@test/support/utils/task-tree'

test.describe('Task Creation', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  test('create a task, check displays in main tree', async ({ taskName }) => {
    const task = {
      ...DefaultTaskFields,
      name: taskName('E2E Root Level Task'),
      status: TaskStatus.PINNED,
    }

    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), task)
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [task],
    })

    await expandAndCheckTree(task)
    checkNumCalls({ create: 1 })
  })

  test('change rank field visibility/required in settings, check form matches new settings, create task', async ({
    page,
    taskName,
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

    await setSettings({ fieldConfig })
    checkNumCalls({ updateSettings: 3 })
    await page.locator(Selectors.BACK_BTN).click()

    await page.locator(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(getTaskForm(0), task, {
      settings: fieldConfig,
    })
    await clickSubmitBtnCreate(getTaskForm(0), {
      newTasks: [task],
    })
    await expandAndCheckTree(task, { settings: fieldConfig })
    checkNumCalls({ create: 1 })
  })
})
