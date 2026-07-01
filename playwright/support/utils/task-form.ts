import { expect, type Locator } from '@playwright/test'
import { format, parse } from 'date-fns'
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
import { waitForCreate, waitForUpdate } from '../fixtures'
import { getIsLoggedIn, getPage } from '../test-globals'
import { checkTasksDontExistBackend, checkTasksExistBackend } from './api'
import { getCheckedState, toggleState } from './index'
import type { CreatedTask } from './intercepts'

const { TaskForm, AssignSubtaskDialog } = Selectors

export type TaskFormData = PickDeep<
  CreatedTask,
  'name' | 'schedule.hideUntil' | 'schedule.dueAt' | RankField
>

type SubmitBtnArgs = {
  newTasks?: CreatedTask[]
  updatedTasks?: CreatedTask[]
  confirmDialog?: string
}

export class TaskFormLocator {
  constructor(private readonly self: Locator) {}

  locator(
    ...args: Parameters<Locator['locator']>
  ): ReturnType<Locator['locator']> {
    return this.self.locator(...args)
  }

  async fillTaskForm(
    task: TaskFormData,
    {
      settings = DEFAULT_FIELD_CONFIG,
      hasIncompleteSubtasks = false,
    }: {
      settings?: FieldConfig
      hasIncompleteSubtasks?: boolean
    } = {},
  ) {
    await checkTasksDontExistBackend([task])

    await expect(this.locator(TaskForm.SUBMIT_BTN)).toBeDisabled()
    await expect(this.locator(TaskForm.ADD_SUBTASK_BTN)).toBeDisabled()

    await this.locator(TaskForm.NAME_INPUT).fill(task.name)
    await expect(this.locator(TaskForm.ADD_SUBTASK_BTN)).not.toBeDisabled()

    await this.fillTaskFormRankFields(task, settings)

    const completedCheckbox = this.locator(TaskForm.MARK_COMPLETED_CHECKBOX)
    if (hasIncompleteSubtasks) {
      await expect(completedCheckbox).toBeDisabled()
    } else {
      await expect(completedCheckbox).not.toBeDisabled()
    }

    const { schedule } = task
    if (schedule) {
      await this.openMoreSection()
      if (schedule.hideUntil)
        await selectDate(
          this.locator(TaskForm.Schedule.HIDE_UNTIL_PICKER),
          schedule.hideUntil,
        )
      if (schedule.dueAt)
        await selectDate(
          this.locator(TaskForm.Schedule.DUE_AT_PICKER),
          schedule.dueAt,
        )
    }
  }

  async assignSubtask(task: CreatedTask) {
    await this.locator(TaskForm.ASSIGN_SUBTASK_BTN).click()
    const dialog = getPage().locator(AssignSubtaskDialog.DIALOG)
    await expect(dialog).toBeVisible()
    await dialog
      .locator(AssignSubtaskDialog.TASK_OPTION)
      .filter({ hasText: task.name })
      .click()
    await dialog.locator(AssignSubtaskDialog.CONFIRM_BTN).click()
  }

  async checkTaskFormSubtasks(subtasks: Pick<Task, 'name' | 'status'>[]) {
    await this.locator(TaskForm.SUBTASKS_CARD).scrollIntoViewIfNeeded()
    const rows = this.locator(TaskForm.SUBTASK_ROW)
    await expect(rows).toHaveCount(subtasks.length)

    const nameEls = rows.locator(TaskForm.SUBTASK_NAME)
    const names = await nameEls.allTextContents()
    expect(names).toEqual(subtasks.map((s) => s.name))

    const completedNames = await rows
      .locator(`${TaskForm.SUBTASK_NAME}.line-through`)
      .allTextContents()
    expect(completedNames).toEqual(
      subtasks
        .filter((s) => s.status === TaskStatus.COMPLETED)
        .map((s) => s.name),
    )
  }

  async setTaskFormSubtaskSettings({
    autoHideCompleted,
    inheritCompletionState,
  }: Partial<TaskSubtaskSettings> = {}) {
    await this.locator(TaskForm.SUBTASK_SETTINGS_BTN).click()
    if (autoHideCompleted !== undefined) {
      await toggleState(
        TaskForm.AUTOHIDE_COMPLETED_SUBTASKS_SWITCH,
        autoHideCompleted,
      )
    }
    if (inheritCompletionState !== undefined) {
      await toggleState(TaskForm.AUTOCOMPLETE_SWITCH, inheritCompletionState)
    }
  }

  async checkTaskFormSubtaskSettings({
    autoHideCompleted,
    inheritCompletionState,
  }: Partial<TaskSubtaskSettings> = {}) {
    await this.locator(TaskForm.SUBTASK_SETTINGS_BTN).click()
    if (autoHideCompleted !== undefined) {
      const state = await getCheckedState(
        TaskForm.AUTOHIDE_COMPLETED_SUBTASKS_SWITCH,
      )
      expect(state).toBe(autoHideCompleted)
    }
    if (inheritCompletionState !== undefined) {
      const state = await getCheckedState(TaskForm.AUTOCOMPLETE_SWITCH)
      expect(state).toBe(inheritCompletionState)
    }
  }

  async openMoreSection() {
    await this.locator(TaskForm.MORE_SECTION).scrollIntoViewIfNeeded()
    await this.locator(TaskForm.MORE_SECTION).click()
  }

  private async fillTaskFormRankFields(
    task: TaskFormData,
    settings: FieldConfig,
  ) {
    const requiredFields = RankFields.filter(
      (field) => settings[field].visible && settings[field].required,
    )

    const submitBtn = this.locator(TaskForm.SUBMIT_BTN)
    if (requiredFields.length > 0) {
      await expect(submitBtn).toBeDisabled()
    } else {
      await expect(submitBtn).not.toBeDisabled()
    }

    const filled = new Set<RankField>()
    for (const field of RankFields) {
      const rankSelect = this.locator(TaskForm.rankSelect(field))
      const value = task[field]
      const config = settings[field]
      if (config.visible) {
        await expect(rankSelect).toBeVisible()
        if (value != null) {
          await rankSelect.click()
          await getPage()
            .locator('[role="listbox"]')
            .getByText(new RegExp(`^${value}$`))
            .click()
          filled.add(field)
        }
        const allRequiredFilled = requiredFields.every((f) => filled.has(f))
        if (allRequiredFilled) {
          await expect(submitBtn).not.toBeDisabled()
        } else {
          await expect(submitBtn).toBeDisabled()
        }
      } else {
        await expect(rankSelect).not.toBeAttached()
      }
    }
  }

  private async clickSubmitBtn(
    submitBtnText: string,
    { newTasks = [], updatedTasks = [], confirmDialog }: SubmitBtnArgs = {},
  ) {
    if (newTasks.length > 0) {
      await checkTasksDontExistBackend(newTasks)
    }

    // Set up waiters BEFORE clicking to capture all responses
    const isLoggedIn = getIsLoggedIn()
    const createWaiter =
      isLoggedIn && newTasks.length > 0 ? waitForCreate(newTasks.length) : null
    const updateWaiter =
      isLoggedIn && updatedTasks.length > 0
        ? waitForUpdate(updatedTasks.length)
        : null

    const submitBtn = this.locator(TaskForm.SUBMIT_BTN)
    await expect(submitBtn).toHaveText(submitBtnText)
    await expect(submitBtn).not.toBeDisabled()
    await submitBtn.click()

    if (confirmDialog) {
      const page = getPage()
      await expect(page.locator(confirmDialog)).toBeVisible()
      await page.locator(Selectors.ConfirmDialog.CONFIRM_BTN).click()
    }

    if (createWaiter) await createWaiter
    if (updateWaiter) await updateWaiter

    const page = getPage()
    await expect(page.locator(Selectors.Toasts.ERROR)).not.toBeVisible()

    if (newTasks.length > 0 || updatedTasks.length > 0) {
      await checkTasksExistBackend([...newTasks, ...updatedTasks])
      // Form should disappear after root-level submit
      await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
    }
  }

  clickSubmitBtnCreate(args: SubmitBtnArgs = {}) {
    return this.clickSubmitBtn('Create', args)
  }

  clickSubmitBtnUpdate(args: SubmitBtnArgs = {}) {
    return this.clickSubmitBtn('Save', args)
  }
}

export const getTaskForm = (tier = 0) =>
  new TaskFormLocator(
    getPage().locator(`${TaskForm.FORM}[data-tier="${tier}"]`),
  )

export async function checkDate(datePicker: Locator, date: Date) {
  await datePicker.scrollIntoViewIfNeeded()
  await expect(datePicker).toContainText(format(date, 'PPP'))
}

export async function selectDate(datePicker: Locator, date: Date) {
  const page = getPage()
  await datePicker.click()

  const captionText = await page
    .locator(Selectors.DatePicker.MONTH_YEAR)
    .textContent()
  if (!captionText) {
    throw new Error('Date picker caption text not found')
  }
  const displayed = parse(captionText.trim(), 'MMMM yyyy', new Date())
  const monthDiff =
    (date.getFullYear() - displayed.getFullYear()) * 12 +
    (date.getMonth() - displayed.getMonth())

  if (monthDiff > 0) {
    for (let i = 0; i < monthDiff; i++) {
      await page.locator(Selectors.DatePicker.NEXT_MONTH_BTN).click()
    }
  } else if (monthDiff < 0) {
    for (let i = 0; i < Math.abs(monthDiff); i++) {
      await page.locator(Selectors.DatePicker.PREV_MONTH_BTN).click()
    }
  }

  await page
    .locator(`[data-day="${format(date, 'yyyy-MM-dd')}"] button`)
    .click()
  await checkDate(datePicker, date)
}
