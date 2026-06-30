import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { DefaultTaskFields, Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { getPage } from '@test/support/test-globals'
import { checkTasksDontExistBackend } from '@test/support/utils/api'
import { checkNumCalls } from '@test/support/utils/intercepts'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  fillTaskForm,
  getTaskForm,
} from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'

const { TaskForm, ConfirmDialog } = Selectors

for (const { contextName, isEdit } of [
  { contextName: 'New Task', isEdit: false },
  { contextName: 'Edit Task', isEdit: true },
] as const) {
  test.describe(`Task Form Cancellation — ${contextName}`, () => {
    test.beforeEach(async ({ page, isLoggedIn }) => {
      await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
    })

    if (!isEdit) {
      test('cancel on create form before adding any subtask — dialog closes, no task created', async ({
        taskName,
      }) => {
        const rootTask = {
          ...DefaultTaskFields,
          name: taskName('E2E Root Task'),
          status: TaskStatus.PINNED,
        }

        await getPage().locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(0), rootTask)
        await getTaskForm(0).locator(TaskForm.CANCEL_BTN).click()

        await expect(
          getPage().locator(TaskForm.CANCEL_CONFIRM_DIALOG),
        ).not.toBeAttached()
        await expect(getPage().locator(TaskForm.FORM)).not.toBeAttached()
        await checkTasksDontExistBackend([rootTask])
        checkNumCalls({ create: 0, update: 0 })
      })
    }

    test('cancel on parent form after a subtask was added — confirmation dialog appears, discard removes all', async ({
      page,
      taskName,
    }) => {
      const rootTask = {
        ...DefaultTaskFields,
        name: taskName('E2E Root Task'),
        status: TaskStatus.PINNED,
      }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask 1'),
        status: TaskStatus.OPEN,
      }

      if (isEdit) {
        // STEP: Create root task
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(0), rootTask)
        await clickSubmitBtnCreate(getTaskForm(0), {
          newTasks: [rootTask],
        })
        // STEP: Open edit form
        await openTaskEditForm(rootTask)
        checkNumCalls({ create: 1, update: 0 })
      } else {
        // STEP: Open new task form and fill
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(0), rootTask)
      }

      // STEP: Add a subtask
      await getTaskForm(0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask)
      await clickSubmitBtnCreate(getTaskForm(1))

      // STEP: Cancel parent form — expect confirmation dialog
      await checkTaskFormSubtasks(getTaskForm(0), [subtask])
      await getTaskForm(0).locator(TaskForm.CANCEL_BTN).click()

      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toContainText(
        '1 unsaved subtask',
      )
      await page.locator(ConfirmDialog.CONFIRM_BTN).click()

      await expect(
        page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
      ).not.toBeAttached()
      await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
      await checkTasksDontExistBackend([subtask])
      if (isEdit) {
        checkNumCalls({ create: 1, update: 0 })
      } else {
        await checkTasksDontExistBackend([rootTask])
        checkNumCalls({ create: 0, update: 0 })
      }
    })

    test('cancel on parent form after multiple subtasks — correct count in dialog, deny/confirm flows', async ({
      page,
      taskName,
    }) => {
      const rootTask = {
        ...DefaultTaskFields,
        name: taskName('E2E Root Task'),
        status: TaskStatus.PINNED,
      }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask 1'),
        status: TaskStatus.OPEN,
      }
      const subtask2 = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask 2'),
        status: TaskStatus.OPEN,
      }

      if (isEdit) {
        // STEP: Create root task
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(0), rootTask)
        await clickSubmitBtnCreate(getTaskForm(0), {
          newTasks: [rootTask],
        })
        // STEP: Open edit form
        await openTaskEditForm(rootTask)
        checkNumCalls({ create: 1, update: 0 })
      } else {
        // STEP: Open new task form and fill
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(0), rootTask)
      }

      // STEP: Add two subtasks
      await getTaskForm(0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask)
      await clickSubmitBtnCreate(getTaskForm(1))

      await checkTaskFormSubtasks(getTaskForm(0), [subtask])
      await getTaskForm(0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(1), subtask2)
      await clickSubmitBtnCreate(getTaskForm(1))

      // Deny discard — form is preserved
      await checkTaskFormSubtasks(getTaskForm(0), [subtask, subtask2])
      await getTaskForm(0).locator(TaskForm.CANCEL_BTN).click()

      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toContainText(
        '2 unsaved subtask',
      )
      await page.locator(ConfirmDialog.DENY_BTN).click()

      await expect(page.locator(TaskForm.NAME_INPUT)).toHaveValue(rootTask.name)
      await checkTaskFormSubtasks(getTaskForm(0), [subtask, subtask2])

      // Confirm discard — all removed
      await getTaskForm(0).locator(TaskForm.CANCEL_BTN).click()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toContainText(
        '2 unsaved subtask',
      )
      await page.locator(ConfirmDialog.CONFIRM_BTN).click()

      await expect(
        page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
      ).not.toBeAttached()
      await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
      await checkTasksDontExistBackend([subtask, subtask2])
      if (isEdit) {
        checkNumCalls({ create: 1, update: 0 })
      } else {
        await checkTasksDontExistBackend([rootTask])
        checkNumCalls({ create: 0, update: 0 })
      }
    })

    test('cancel on subtask form navigates back to parent, then cancel parent discards without confirmation', async ({
      page,
      taskName,
    }) => {
      const rootTask = {
        ...DefaultTaskFields,
        name: taskName('E2E Root Task'),
        status: TaskStatus.PINNED,
      }
      const subtask = {
        ...DefaultTaskFields,
        name: taskName('E2E Subtask 1'),
        status: TaskStatus.OPEN,
      }

      if (isEdit) {
        // STEP: Create root task
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(0), rootTask)
        await clickSubmitBtnCreate(getTaskForm(0), {
          newTasks: [rootTask],
        })
        // STEP: Open edit form
        await openTaskEditForm(rootTask)
        checkNumCalls({ create: 1, update: 0 })
      } else {
        // STEP: Open new task form and fill
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(0), rootTask)
      }

      // STEP: Open subtask form, cancel — returns to parent
      await getTaskForm(0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await getTaskForm(1).locator(TaskForm.NAME_INPUT).fill(subtask.name)
      await getTaskForm(1).locator(TaskForm.CANCEL_BTN).click()

      // Cancel parent — no confirmation needed (no submitted subtasks)
      await expect(getTaskForm(0).locator(TaskForm.NAME_INPUT)).toHaveValue(
        rootTask.name,
      )
      await getTaskForm(0).locator(TaskForm.CANCEL_BTN).click()

      await expect(
        page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
      ).not.toBeAttached()
      await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
      if (isEdit) {
        checkNumCalls({ create: 1, update: 0 })
      } else {
        await checkTasksDontExistBackend([rootTask, subtask])
        checkNumCalls({ create: 0, update: 0 })
      }
    })
  })
}
