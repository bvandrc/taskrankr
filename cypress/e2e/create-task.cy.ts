import { Routes } from '@client/lib/constants'
import { DefaultTask, Selectors } from '@cypress/support/constants'
import { isLoggedIn } from '@cypress/support/utils'
import {
  type CreatedTask,
  checkNumCalls,
} from '@cypress/support/utils/intercepts'
import { setSettings } from '@cypress/support/utils/settings'
import {
  clickSubmitBtnCreate,
  fillTaskForm,
} from '@cypress/support/utils/task-form'
import { expandAndCheckTree } from '@cypress/support/utils/task-tree'

import { type FieldConfig, TaskStatus } from '~/shared/schema'

describe('Task Creation', () => {
  const task = {
    ...DefaultTask,
    name: 'E2E Root Level Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)
  })

  it('create a task, check displays in main tree', () => {
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(task)
    clickSubmitBtnCreate({ newTasks: [task] })

    expandAndCheckTree(task)
    checkNumCalls({ create: 1 })
  })

  it('change rank field visibility/required in settings, check form matches the new settings, create task adhering to new settings', () => {
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

    cy.log('Step 1: Update rank field settings')
    setSettings({ fieldConfig })
    checkNumCalls({ updateSettings: 4 })
    cy.get(Selectors.BACK_BTN).click()

    cy.log('Step 2: Create task using new field config, verify in tree')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(newTask, { settings: fieldConfig })
    clickSubmitBtnCreate({ newTasks: [newTask] })
    expandAndCheckTree(newTask)
    checkNumCalls({ create: 1 })
  })
})
