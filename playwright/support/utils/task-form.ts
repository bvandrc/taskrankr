import type { PickDeep } from 'type-fest'

import {
  DEFAULT_FIELD_CONFIG,
  type FieldConfig,
  type RankField,
  RankFields,
  type Task,
  TaskStatus,
  type TaskSubtaskSettings,
} from '~/shared/schema'
import { Selectors } from '../constants'
import { getElementArrayText, type SettingsOptions } from '.'
import { checkTasksDontExistBackend } from './api'
import { type CreatedTask, waitForCreate, waitForUpdate } from './intercepts'

const { TaskForm, AssignSubtaskDialog } = Selectors

type TaskFormData = PickDeep<
  CreatedTask,
  'name' | 'schedule.hideUntil' | 'schedule.dueAt' | RankField
>

export const getTaskForm = (tier = 0) =>
  cy.get(`${TaskForm.FORM}[data-tier="${tier}"]`).should('be.visible')

export const fillTaskFormRankFields = (
  task: TaskFormData,
  settings: FieldConfig,
) => {
  const requiredFields = RankFields.filter(
    (field) => settings[field].visible && settings[field].required,
  )

  cy.get(TaskForm.SUBMIT_BTN) //
    .should(requiredFields.length ? 'be.disabled' : 'not.be.disabled')

  const filled = new Set<RankField>()
  for (const field of RankFields) {
    const RankSelect = TaskForm.rankSelect(field)
    const value = task[field]
    const config = settings[field]
    if (config.visible) {
      cy.get(RankSelect).should('be.visible')
      if (value !== null) {
        cy.wrap(RankSelect).click()
        cy.escapeWithin()
          .find('[role="listbox"]')
          .contains(new RegExp(`^${value}$`))
          .click()
        filled.add(field)
      }
      const allRequiredFilled = requiredFields.every((f) => filled.has(f))
      cy.get(TaskForm.SUBMIT_BTN) //
        .should(allRequiredFilled ? 'not.be.disabled' : 'be.disabled')
    } else {
      cy.get(RankSelect).should('not.exist')
    }
  }
}

/**
 * Fills form.
 */
export const fillTaskForm = async (
  task: TaskFormData,
  {
    settings = DEFAULT_FIELD_CONFIG,
    hasIncompleteSubtasks = false,
  }: SettingsOptions & {
    /**
     * @default false
     */
    hasIncompleteSubtasks?: boolean
  } = {},
) => {
  // STEP: **filling task form... (task: ${task.name})**
  checkTasksDontExistBackend([task])

  cy.get(TaskForm.SUBMIT_BTN).should('be.disabled')

  cy.get(TaskForm.ADD_SUBTASK_BTN).should('be.disabled')
  cy.get(TaskForm.NAME_INPUT).type(task.name)
  cy.get(TaskForm.ADD_SUBTASK_BTN).should('be.enabled')

  await fillTaskFormRankFields(task, settings)

  cy.get(TaskForm.MARK_COMPLETED_CHECKBOX).should(
    hasIncompleteSubtasks ? 'be.disabled' : 'be.enabled',
  )

  const { schedule } = task
  if (schedule) {
    openMoreSection()
    if (schedule.hideUntil)
      cy.get(TaskForm.Schedule.HIDE_UNTIL_PICKER).selectDate(schedule.hideUntil)
    if (schedule.dueAt)
      cy.get(TaskForm.Schedule.DUE_AT_PICKER).selectDate(schedule.dueAt)
  }

  // STEP: **...task form filled (task: ${task.name})**
}

type SubmitBtnArgs = {
  newTasks?: CreatedTask[]
  updatedTasks?: CreatedTask[]
  confirmDialog?: string
}

const clickSubmitBtn = (
  submitBtnText: string,
  { newTasks, updatedTasks, confirmDialog }: SubmitBtnArgs = {},
) => {
  if (newTasks) {
    checkTasksDontExistBackend(newTasks)
  }
  cy.get(TaskForm.SUBMIT_BTN)
    .should('have.text', submitBtnText)
    .should('not.be.disabled')
    .click()
    .then(($btn) => {
      if (confirmDialog) {
        cy.escapeWithin().within(() => {
          cy.get(confirmDialog).should('be.visible')
          cy.get(Selectors.ConfirmDialog.CONFIRM_BTN).click()
        })
      }
      newTasks && waitForCreate(newTasks)
      updatedTasks && waitForUpdate(updatedTasks)
      // this form should disapper after submit
      cy.wrap($btn).should('not.exist')
    })
  // API calls should only be created when root task form is submitted
  if (newTasks || updatedTasks) {
    cy.escapeWithin().find(Selectors.TaskForm.FORM).should('not.exist')
  }
}

export const clickSubmitBtnCreate = (args: SubmitBtnArgs = {}) =>
  clickSubmitBtn('Create', args)

export const clickSubmitBtnUpdate = (args: SubmitBtnArgs = {}) =>
  clickSubmitBtn('Save', args)

export const assignSubtask = (
  /**
   * the orphan task to assign as subtask.
   */
  task: CreatedTask,
) => {
  cy.get(TaskForm.ASSIGN_SUBTASK_BTN).click()
  cy.escapeWithin()
    .find(AssignSubtaskDialog.DIALOG)
    .should('be.visible')
    .within(() => {
      cy.contains(AssignSubtaskDialog.TASK_OPTION, task.name).click()
      cy.get(AssignSubtaskDialog.CONFIRM_BTN).click()
    })
}

export const checkTaskFormSubtasks = (
  subtasks: Pick<Task, 'name' | 'status'>[],
) => {
  // TODO: test how they are nested
  cy.get(TaskForm.SUBTASKS_CARD).scrollIntoView()
  cy.get(TaskForm.SUBTASK_ROW)
    .should('have.length', subtasks.length)
    .find(TaskForm.SUBTASK_NAME)
    .should(($names) =>
      expect(getElementArrayText($names)).to.deep.equal(
        subtasks.map((subtask) => subtask.name),
        'Task form should list all subtasks',
      ),
    )
    .should(($names) =>
      expect(getElementArrayText($names.filter('.line-through'))).to.deep.equal(
        subtasks
          .filter((subtask) => subtask.status === TaskStatus.COMPLETED)
          .map((subtask) => subtask.name),
        'Completed subtasks should be crossed out',
      ),
    )
}

export const setTaskFormSubtaskSettings = ({
  autoHideCompleted,
  inheritCompletionState,
}: Partial<TaskSubtaskSettings> = {}) => {
  cy.get(TaskForm.SUBTASK_SETTINGS_BTN).click()
  if (autoHideCompleted !== undefined) {
    cy.get(TaskForm.AUTOHIDE_COMPLETED_SUBTASKS_SWITCH).toggleState(
      autoHideCompleted,
    )
  }
  if (inheritCompletionState !== undefined) {
    cy.get(TaskForm.AUTOCOMPLETE_SWITCH).toggleState(inheritCompletionState)
  }
}

export const checkTaskFormSubtaskSettings = ({
  autoHideCompleted,
  inheritCompletionState,
}: Partial<TaskSubtaskSettings> = {}) => {
  cy.get(TaskForm.SUBTASK_SETTINGS_BTN).click()
  if (autoHideCompleted !== undefined) {
    cy.get(TaskForm.AUTOHIDE_COMPLETED_SUBTASKS_SWITCH)
      .getCheckedState()
      .should('eq', autoHideCompleted)
  }
  if (inheritCompletionState !== undefined) {
    cy.get(TaskForm.AUTOCOMPLETE_SWITCH)
      .getCheckedState()
      .should('eq', inheritCompletionState)
  }
}

export const openMoreSection = () => {
  cy.get(TaskForm.MORE_SECTION).scrollIntoView().click()
}
