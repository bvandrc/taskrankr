import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { getPage } from '@test/support/test-globals'
import { checkTasksDontExistBackend } from '@test/support/utils/api'
import { checkNumCalls } from '@test/support/utils/intercepts'
import { getTaskForm } from '@test/support/utils/task-form'
import { openTaskEditForm } from '@test/support/utils/task-tree'

const { TaskForm, ConfirmDialog } = Selectors

for (const { contextName, isEdit } of [
  { contextName: 'New Task', isEdit: false },
  { contextName: 'Edit Task', isEdit: true },
] as const) {
  test.describe(`Task Form Cancellation - ${contextName}`, () => {
    test.beforeEach(async ({ page, isLoggedIn }) => {
      await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
    })

    if (!isEdit) {
      test('cancel on create form before adding any subtask - dialog closes, no task created', async ({
        buildTask,
      }) => {
        const rootTask = buildTask('Root Task', TaskStatus.PINNED)

        await getPage().locator(Selectors.CREATE_TASK_BTN).click()
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.fillTaskForm(rootTask)
        await rootTaskForm.locator(TaskForm.CANCEL_BTN).click()

        await expect(
          getPage().locator(TaskForm.CANCEL_CONFIRM_DIALOG),
        ).not.toBeAttached()
        await expect(getPage().locator(TaskForm.FORM)).not.toBeAttached()
        await checkTasksDontExistBackend([rootTask])
        checkNumCalls({ create: 0, update: 0 })
      })
    }

    test('cancel on parent form after a subtask was added - confirmation dialog appears, discard removes all', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const subtask = buildTask('Subtask 1', TaskStatus.OPEN)

      if (isEdit) {
        await test.step('Create root task', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          const rootTaskForm = getTaskForm(0)
          await rootTaskForm.fillTaskForm(rootTask)
          await rootTaskForm.clickSubmitBtnCreate({ newTasks: [rootTask] })
        })
        await test.step('Open edit form', async () => {
          await openTaskEditForm(rootTask)
          checkNumCalls({ create: 1, update: 0 })
        })
      } else {
        await test.step('Open new task form and fill', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          const rootTaskForm = getTaskForm(0)
          await rootTaskForm.fillTaskForm(rootTask)
        })
      }

      await test.step('Add a subtask', async () => {
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.locator(TaskForm.ADD_SUBTASK_BTN).click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.fillTaskForm(subtask)
        await subtaskForm.clickSubmitBtnCreate()
      })

      await test.step('Cancel parent form - expect confirmation dialog', async () => {
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.checkTaskFormSubtasks([subtask])
        await rootTaskForm.locator(TaskForm.CANCEL_BTN).click()

        await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
        await expect(
          page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
        ).toContainText('1 unsaved subtask')
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
    })

    test('cancel on parent form after multiple subtasks - correct count in dialog, deny/confirm flows', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const subtask = buildTask('Subtask 1', TaskStatus.OPEN)
      const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)

      if (isEdit) {
        await test.step('Create root task', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          const rootTaskForm = getTaskForm(0)
          await rootTaskForm.fillTaskForm(rootTask)
          await rootTaskForm.clickSubmitBtnCreate({ newTasks: [rootTask] })
        })
        await test.step('Open edit form', async () => {
          await openTaskEditForm(rootTask)
          checkNumCalls({ create: 1, update: 0 })
        })
      } else {
        await test.step('Open new task form and fill', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          const rootTaskForm = getTaskForm(0)
          await rootTaskForm.fillTaskForm(rootTask)
        })
      }

      await test.step('Add two subtasks', async () => {
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.locator(TaskForm.ADD_SUBTASK_BTN).click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.fillTaskForm(subtask)
        await subtaskForm.clickSubmitBtnCreate()
        await rootTaskForm.checkTaskFormSubtasks([subtask])
        await rootTaskForm.locator(TaskForm.ADD_SUBTASK_BTN).click()
        const subtask2Form = getTaskForm(1)
        await subtask2Form.fillTaskForm(subtask2)
        await subtask2Form.clickSubmitBtnCreate()
      })

      await test.step('Deny discard - form is preserved', async () => {
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.checkTaskFormSubtasks([subtask, subtask2])
        await rootTaskForm.locator(TaskForm.CANCEL_BTN).click()

        await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
        await expect(
          page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
        ).toContainText('2 unsaved subtask')
        await page.locator(ConfirmDialog.DENY_BTN).click()

        await expect(page.locator(TaskForm.NAME_INPUT)).toHaveValue(
          rootTask.name,
        )
        await rootTaskForm.checkTaskFormSubtasks([subtask, subtask2])
      })

      await test.step('Confirm discard - all removed', async () => {
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.locator(TaskForm.CANCEL_BTN).click()
        await expect(page.locator(TaskForm.CANCEL_CONFIRM_DIALOG)).toBeVisible()
        await expect(
          page.locator(TaskForm.CANCEL_CONFIRM_DIALOG),
        ).toContainText('2 unsaved subtask')
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
    })

    test('cancel on subtask form navigates back to parent, then cancel parent discards without confirmation', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const subtask = buildTask('Subtask 1', TaskStatus.OPEN)

      if (isEdit) {
        await test.step('Create root task', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          const rootTaskForm = getTaskForm(0)
          await rootTaskForm.fillTaskForm(rootTask)
          await rootTaskForm.clickSubmitBtnCreate({ newTasks: [rootTask] })
        })
        await test.step('Open edit form', async () => {
          await openTaskEditForm(rootTask)
          checkNumCalls({ create: 1, update: 0 })
        })
      } else {
        await test.step('Open new task form and fill', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          const rootTaskForm = getTaskForm(0)
          await rootTaskForm.fillTaskForm(rootTask)
        })
      }

      await test.step('Open subtask form, cancel - returns to parent', async () => {
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.locator(TaskForm.ADD_SUBTASK_BTN).click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.locator(TaskForm.NAME_INPUT).fill(subtask.name)
        await subtaskForm.locator(TaskForm.CANCEL_BTN).click()
      })

      await test.step('Cancel parent - no confirmation needed (no submitted subtasks)', async () => {
        const rootTaskForm = getTaskForm(0)
        await expect(rootTaskForm.locator(TaskForm.NAME_INPUT)).toHaveValue(
          rootTask.name,
        )
        await rootTaskForm.locator(TaskForm.CANCEL_BTN).click()

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
  })
}
