import { Routes } from '@client/lib/constants'
import {
  DefaultTask,
  FieldConfigAllFalse,
  Selectors,
} from '@cypress/support/constants'
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

const { TaskForm } = Selectors

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
      timeSpent: { visible: false, required: false },
    } as const satisfies FieldConfig

    const newTask = {
      ...task,
      name: 'Field Config Test Task',
      ease: null,
      enjoyment: null,
    } satisfies CreatedTask

    cy.log('Step 1: Update rank field settings')
    setSettings({ fieldConfig })
    cy.get('@settingsPut.all').should('have.length', isLoggedIn() ? 4 : 0)
    cy.get(Selectors.BACK_BTN).click()

    cy.log('Step 2: Create task using new field config, verify in tree')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(newTask, fieldConfig)
    clickSubmitBtnCreate({ newTasks: [newTask] })
    expandAndCheckTree(newTask)
    checkNumCalls({ create: 1 })
  })

  it('change time spent field visibility/required in settings, check form matches the new settings, create task adhering to new settings', () => {
    const fieldConfig = {
      ...FieldConfigAllFalse,
      timeSpent: { visible: true, required: true },
    } as const satisfies FieldConfig

    const taskAllNull = {
      ...task,
      priority: null,
      ease: null,
      enjoyment: null,
      time: null,
    } satisfies CreatedTask

    cy.log('Step 1: Update settings to show only time spent (required)')
    setSettings({ fieldConfig })
    cy.get('@settingsPut.all').should('have.length', isLoggedIn() ? 5 : 0)
    cy.get(Selectors.BACK_BTN).click()

    cy.log(
      'Step 2: Create completed task — submit blocked until time spent is filled',
    )
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(taskAllNull, fieldConfig)
    cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).click()
    cy.get(TaskForm.SUBMIT_BTN).should('be.disabled')
    cy.get(TaskForm.TIME_SPENT_INPUT_HOURS).type('1')
    clickSubmitBtnCreate({
      newTasks: [{ ...taskAllNull, status: TaskStatus.COMPLETED }],
    })
    // TODO: check is in completed tree
    checkNumCalls({ create: 1 })
  })
})
