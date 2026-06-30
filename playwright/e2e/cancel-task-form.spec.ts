import { Routes } from '../../client/src/lib/constants'
import { TaskStatus } from '../../shared/schema'
import { DefaultTaskFields, Selectors } from '../support/constants'
import { expect, test } from '../support/fixtures'
import { checkTasksDontExist } from '../support/utils/api'
import { checkNumCalls } from '../support/utils/intercepts'
import {
  checkTaskFormSubtasks,
  clickSubmitBtnCreate,
  fillTaskForm,
  getTaskForm,
} from '../support/utils/task-form'
import { openTaskEditForm } from '../support/utils/task-tree'

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
        page,
        isLoggedIn,
        taskName,
        requestTracker,
      }) => {
        const rootTask = {
          ...DefaultTaskFields,
          name: taskName('E2E Root Task'),
          status: TaskStatus.PINNED,
        }

        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, rootTask)
        await getTaskForm(page, 0).locator(TaskForm.CANCEL_BTN).click()

        await expect(
          page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
        ).not.toBeAttached()
        await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
        await checkTasksDontExist(page, isLoggedIn, [rootTask])
        checkNumCalls(requestTracker, isLoggedIn, { create: 0, update: 0 })
      })
    }

    test('cancel on parent form after a subtask was added — confirmation dialog appears, discard removes all', async ({
      page,
      isLoggedIn,
      taskName,
      requestTracker,
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
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, rootTask)
        await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
          newTasks: [rootTask],
        })
        await openTaskEditForm(page, rootTask)
        checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })
      } else {
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, rootTask)
      }

      await getTaskForm(page, 0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
      await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

      await checkTaskFormSubtasks(getTaskForm(page, 0), [subtask])
      await getTaskForm(page, 0).locator(TaskForm.CANCEL_BTN).click()

      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toContainText(
        '1 unsaved subtask',
      )
      await page.locator(ConfirmDialog.CONFIRM_BTN).click()

      await expect(
        page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
      ).not.toBeAttached()
      await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
      await checkTasksDontExist(page, isLoggedIn, [subtask])
      if (isEdit) {
        checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })
      } else {
        await checkTasksDontExist(page, isLoggedIn, [rootTask])
        checkNumCalls(requestTracker, isLoggedIn, { create: 0, update: 0 })
      }
    })

    test('cancel on parent form after multiple subtasks — correct count in dialog, deny/confirm flows', async ({
      page,
      isLoggedIn,
      taskName,
      requestTracker,
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
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, rootTask)
        await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
          newTasks: [rootTask],
        })
        await openTaskEditForm(page, rootTask)
        checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })
      } else {
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, rootTask)
      }

      await getTaskForm(page, 0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask)
      await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

      await checkTaskFormSubtasks(getTaskForm(page, 0), [subtask])
      await getTaskForm(page, 0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await fillTaskForm(getTaskForm(page, 1), page, isLoggedIn, subtask2)
      await clickSubmitBtnCreate(getTaskForm(page, 1), page, isLoggedIn)

      // Deny discard — form is preserved
      await checkTaskFormSubtasks(getTaskForm(page, 0), [subtask, subtask2])
      await getTaskForm(page, 0).locator(TaskForm.CANCEL_BTN).click()

      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toContainText(
        '2 unsaved subtask',
      )
      await page.locator(ConfirmDialog.DENY_BTN).click()

      await expect(page.locator(TaskForm.NAME_INPUT)).toHaveValue(rootTask.name)
      await checkTaskFormSubtasks(getTaskForm(page, 0), [subtask, subtask2])

      // Confirm discard — all removed
      await getTaskForm(page, 0).locator(TaskForm.CANCEL_BTN).click()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
      await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toContainText(
        '2 unsaved subtask',
      )
      await page.locator(ConfirmDialog.CONFIRM_BTN).click()

      await expect(
        page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
      ).not.toBeAttached()
      await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
      await checkTasksDontExist(page, isLoggedIn, [subtask, subtask2])
      if (isEdit) {
        checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })
      } else {
        await checkTasksDontExist(page, isLoggedIn, [rootTask])
        checkNumCalls(requestTracker, isLoggedIn, { create: 0, update: 0 })
      }
    })

    test('cancel on subtask form navigates back to parent, then cancel parent discards without confirmation', async ({
      page,
      isLoggedIn,
      taskName,
      requestTracker,
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
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, rootTask)
        await clickSubmitBtnCreate(getTaskForm(page, 0), page, isLoggedIn, {
          newTasks: [rootTask],
        })
        await openTaskEditForm(page, rootTask)
        checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })
      } else {
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        await fillTaskForm(getTaskForm(page, 0), page, isLoggedIn, rootTask)
      }

      await getTaskForm(page, 0).locator(TaskForm.ADD_SUBTASK_BTN).click()
      await getTaskForm(page, 1).locator(TaskForm.NAME_INPUT).fill(subtask.name)
      await getTaskForm(page, 1).locator(TaskForm.CANCEL_BTN).click()

      // Cancel parent — no confirmation needed (no submitted subtasks)
      await expect(
        getTaskForm(page, 0).locator(TaskForm.NAME_INPUT),
      ).toHaveValue(rootTask.name)
      await getTaskForm(page, 0).locator(TaskForm.CANCEL_BTN).click()

      await expect(
        page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
      ).not.toBeAttached()
      await expect(page.locator(TaskForm.FORM)).not.toBeAttached()
      if (isEdit) {
        checkNumCalls(requestTracker, isLoggedIn, { create: 1, update: 0 })
      } else {
        await checkTasksDontExist(page, isLoggedIn, [rootTask, subtask])
        checkNumCalls(requestTracker, isLoggedIn, { create: 0, update: 0 })
      }
    })
  })
}
