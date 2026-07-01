import { Routes } from '~/client/lib/constants'
import { type FieldConfig, TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { test } from '@test/support/fixtures'
import { getPage } from '@test/support/test-globals'
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

  test('create a task, check displays in main tree', async ({ buildTask }) => {
    const task = buildTask('Root Task', TaskStatus.PINNED)

    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    const taskForm = getTaskForm(0)
    await fillTaskForm(taskForm, task)
    await clickSubmitBtnCreate(taskForm, { newTasks: [task] })

    await expandAndCheckTree(task)
    checkNumCalls({ create: 1 })
  })

  test('change rank field visibility/required in settings, check form matches new settings, create task', async ({
    page,
    buildTask,
  }) => {
    const fieldConfig = {
      priority: { visible: true, required: true },
      ease: { visible: true, required: false },
      enjoyment: { visible: false, required: false },
      time: { visible: true, required: false },
    } as const satisfies FieldConfig

    const newTask = buildTask('Field Config Test Task', TaskStatus.PINNED, {
      ease: null,
      enjoyment: null,
    })

    await test.step('Update rank field settings', async () => {
      await setSettings({ fieldConfig })
      checkNumCalls({ updateSettings: 3 })
      await page.locator(Selectors.BACK_BTN).click()
    })

    await test.step('Create task using new field config, verify in tree', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const newTaskForm = getTaskForm(0)
      await fillTaskForm(newTaskForm, newTask, { settings: fieldConfig })
      await clickSubmitBtnCreate(newTaskForm, { newTasks: [newTask] })
      await expandAndCheckTree(newTask, { settings: fieldConfig })
      checkNumCalls({ create: 1 })
    })
  })
})
