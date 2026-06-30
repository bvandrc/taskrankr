import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTask, Selectors } from '@test/support/constants'
import { isLoggedIn } from '@test/support/utils'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import {
  clickSubmitBtnCreate,
  clickSubmitBtnUpdate,
  fillTaskForm,
} from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'

const { TaskForm } = Selectors

describe('Edit Task', () => {
  const task = {
    ...DefaultTask,
    name: 'E2E Edit Task',
    status: TaskStatus.PINNED,
  } as const satisfies CreatedTask

  beforeEach(() => {
    const loggedIn = isLoggedIn()
    cy.visit(loggedIn ? Routes.HOME : Routes.GUEST)

    cy.log('Step 1: Create task')
    cy.get(Selectors.CREATE_TASK_BTN).click()
    fillTaskForm(task)
    clickSubmitBtnCreate({ newTasks: [task] })
  })

  it('date created shows today and can be changed via the date picker', () => {
    const today = new Date()

    // Pick a day in the same month that isn't today
    const newDay = today.getDate() === 1 ? 2 : 1
    const newDate = new Date(today.getFullYear(), today.getMonth(), newDay)

    cy.log('Step 2: Open edit form, verify Date Created shows today')
    openTaskEditForm(task)
    cy.get(TaskForm.DATE_CREATED_PICKER).checkDate(today)

    cy.log('Step 3: Open calendar and pick a different day')
    cy.get(TaskForm.DATE_CREATED_PICKER).selectDate(newDate)

    cy.log('Step 4: Save and verify update count')
    clickSubmitBtnUpdate({ updatedTasks: [task] })
    checkNumCalls({ create: 1, update: 1 })

    cy.log('Step 5: Re-open edit form, verify date was persisted')
    openTaskEditForm(task)
    cy.get(TaskForm.DATE_CREATED_PICKER).checkDate(newDate)
  })
})
