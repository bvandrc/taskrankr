import { Routes } from '~/client/lib/constants'
import { type FieldConfig, TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { isLoggedIn } from '@test/support/utils'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import { setSettings } from '@test/support/utils/settings'
import {
  clickSubmitBtnCreate,
  fillTaskForm,
} from '@test/support/utils/task-form'
import { expandAndCheckTree } from '@test/support/utils/task-tree'

describe('Task Creation', () => {
  const task = {
    ...DefaultTaskFields,
    name: 'E2E Root Level Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  it('create a task, check displays in main tree', async () => {
    cy.get(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(task)
    await clickSubmitBtnCreate({ newTasks: [task] })

    await expandAndCheckTree(task)
    checkNumCalls({ create: 1 })
  })

  it('change rank field visibility/required in settings, check form matches the new settings, create task adhering to new settings', async () => {
    const fieldConfig = {
      priority: { visible: true, required: true },
      ease: { visible: true, required: false },
      enjoyment: { visible: false, required: false },
      time: { visible: true, required: false },
    } as const satisfies FieldConfig

    const newTask = {
      ...task,
      name: 'Field Config Test Task',
      ease: null,
      enjoyment: null,
    } satisfies CreatedTask

    // STEP: Step 1: Update rank field settings
    setSettings({ fieldConfig })
    checkNumCalls({ updateSettings: 3 })
    cy.get(Selectors.BACK_BTN).click()

    // STEP: Step 2: Create task using new field config, verify in tree
    cy.get(Selectors.CREATE_TASK_BTN).click()
    await fillTaskForm(newTask, { settings: fieldConfig })
    await clickSubmitBtnCreate({ newTasks: [newTask] })
    await expandAndCheckTree(newTask, { settings: fieldConfig })
    checkNumCalls({ create: 1 })
  })
})
