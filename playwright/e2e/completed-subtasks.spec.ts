import { Routes } from '~/client/lib/constants'
import { TaskStatus } from '~/shared/schema'
import { Selectors } from '@test/support/constants'
import { expect, test } from '@test/support/fixtures'
import { getPage } from '@test/support/test-globals'
import { type CreatedTask, checkNumCalls } from '@test/support/utils/intercepts'
import { goToCompletedPage } from '@test/support/utils/navigation'
import { getTaskForm, type TaskFormData } from '@test/support/utils/task-form'
import {
  changeStatusViaStatusChangeDialog,
  checkCompletedPage,
  expandAndCheckTree,
  openTaskEditForm,
} from '@test/support/utils/task-tree'

test.describe('Completed Subtasks', () => {
  test.beforeEach(async ({ page, isLoggedIn }) => {
    await page.goto(isLoggedIn ? Routes.HOME : Routes.GUEST)
  })

  async function createRootWithUncompletedSubtask(
    rootTask: TaskFormData,
    subtask: TaskFormData,
  ) {
    await getPage().locator(Selectors.CREATE_TASK_BTN).click()
    const rootTaskForm = getTaskForm(0)
    await rootTaskForm.fillTaskForm(rootTask)
    await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
    const subtaskForm = getTaskForm(1)
    await subtaskForm.fillTaskForm(subtask)
    await subtaskForm.clickSubmitBtnCreate()
    await rootTaskForm.setTaskFormSubtaskSettings({ autoHideCompleted: false })
    await rootTaskForm.clickSubmitBtnCreate({
      newTasks: [rootTask, subtask] as CreatedTask[],
    })
  }

  test('complete subtask via New Task Form - present in main tree as crossed out, not in completed page', async ({
    page,
    buildTask,
  }) => {
    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const subtask = buildTask('Subtask', TaskStatus.OPEN)
    const completedSubtask = {
      ...subtask,
      status: TaskStatus.COMPLETED,
    } as const satisfies CreatedTask

    await test.step('Create root task with subtask pre-marked as completed', async () => {
      await page.locator(Selectors.CREATE_TASK_BTN).click()
      const rootTaskForm = getTaskForm(0)
      await rootTaskForm.fillTaskForm(rootTask)
      await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
      const subtaskForm = getTaskForm(1)
      await subtaskForm.fillTaskForm(subtask)
      await subtaskForm
        .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
        .click()
      await subtaskForm.clickSubmitBtnCreate()
      await rootTaskForm.setTaskFormSubtaskSettings({
        autoHideCompleted: false,
      })
      await rootTaskForm.checkTaskFormSubtasks([completedSubtask])
      await rootTaskForm.clickSubmitBtnCreate({
        newTasks: [rootTask, completedSubtask],
      })
      checkNumCalls({ create: 2, update: 0 })
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage()
    await expect(page.getByText(subtask.name)).not.toBeAttached()
    await expect(page.getByText(rootTask.name)).not.toBeAttached()
  })

  test('complete subtask via Edit Form - present in main tree as crossed out, not in completed page', async ({
    page,
    buildTask,
  }) => {
    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const subtask = buildTask('Subtask', TaskStatus.OPEN)
    const completedSubtask = {
      ...subtask,
      status: TaskStatus.COMPLETED,
    } as const satisfies CreatedTask

    await test.step('Create root task with uncompleted subtask', async () => {
      await createRootWithUncompletedSubtask(rootTask, subtask)
      checkNumCalls({ create: 2, update: 0 })
      await expandAndCheckTree({ ...rootTask, subtasks: [subtask] }) // expands the tree
    })

    await test.step('Edit subtask, mark as completed', async () => {
      // Editing a subtask renders its form at tier 1 (parent chain length 1).
      await openTaskEditForm(subtask)
      const subtaskForm = getTaskForm(1)
      await subtaskForm
        .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
        .click()
      await subtaskForm.clickSubmitBtnUpdate({
        updatedTasks: [completedSubtask],
      })
      checkNumCalls({ create: 2, update: 1 })
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage()
    await expect(page.getByText(subtask.name)).not.toBeAttached()
    await expect(page.getByText(rootTask.name)).not.toBeAttached()
  })

  test('complete subtask via Change Status Dialog - present in main tree as crossed out, not in completed page', async ({
    page,
    buildTask,
  }) => {
    const rootTask = buildTask('Root Task', TaskStatus.PINNED)
    const subtask = buildTask('Subtask', TaskStatus.OPEN)
    const completedSubtask = {
      ...subtask,
      status: TaskStatus.COMPLETED,
    } as const satisfies CreatedTask

    await test.step('Create root task with uncompleted subtask', async () => {
      await createRootWithUncompletedSubtask(rootTask, subtask)
      checkNumCalls({ create: 2, update: 0 })
      await expandAndCheckTree({ ...rootTask, subtasks: [subtask] }) // expands the tree
    })

    await test.step('Complete subtask via status change dialog', async () => {
      await changeStatusViaStatusChangeDialog(subtask, TaskStatus.COMPLETED)
      checkNumCalls({ create: 2, update: 1 })
    })

    await expandAndCheckTree({
      ...rootTask,
      subtasks: [completedSubtask],
    })
    await goToCompletedPage()
    await expect(page.getByText(subtask.name)).not.toBeAttached()
    await expect(page.getByText(rootTask.name)).not.toBeAttached()
  })

  test.describe('Auto-complete parent when all subtasks completed', () => {
    test('auto-completes parent when inheritCompletionState is enabled first, then last subtask becomes completed', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const completedRootTask = {
        ...rootTask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask
      const subtask = buildTask('Subtask', TaskStatus.OPEN)
      const completedSubtask = {
        ...subtask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask

      await test.step('Create root task (autocomplete=on) with one subtask', async () => {
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.fillTaskForm(rootTask)
        await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.fillTaskForm(subtask)
        await subtaskForm.clickSubmitBtnCreate()
        await rootTaskForm.setTaskFormSubtaskSettings({
          autoHideCompleted: false,
          inheritCompletionState: true,
        })
        await rootTaskForm.clickSubmitBtnCreate({
          newTasks: [rootTask, subtask],
        })
        checkNumCalls({ create: 2, update: 0 })
        await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      })

      await test.step('Complete subtask — parent auto-completes', async () => {
        await changeStatusViaStatusChangeDialog(subtask, TaskStatus.COMPLETED, {
          sideEffects: [completedRootTask], // Parent auto-completes as the last subtask is marked done
        })
        checkNumCalls({ create: 2, update: 2 })
      })
      await checkCompletedPage([
        { ...completedRootTask, subtasks: [completedSubtask] },
      ])
    })

    test('auto-completes parent when inheritCompletionState becomes enabled after all subtasks already completed', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const completedRootTask = {
        ...rootTask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask
      const subtask = buildTask('Subtask', TaskStatus.OPEN)
      const completedSubtask = {
        ...subtask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask

      await test.step('Create task with completed subtask', async () => {
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.fillTaskForm(rootTask)
        await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.fillTaskForm(subtask)
        await subtaskForm
          .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
          .click()
        await subtaskForm.clickSubmitBtnCreate()
        await rootTaskForm.setTaskFormSubtaskSettings({
          autoHideCompleted: false,
        })
        await rootTaskForm.clickSubmitBtnCreate({
          newTasks: [rootTask, completedSubtask],
        })
        await expandAndCheckTree({
          ...rootTask,
          subtasks: [completedSubtask],
        })
      })

      await test.step('Enable inheritCompletionState — parent auto-completes immediately', async () => {
        await openTaskEditForm(rootTask)
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.setTaskFormSubtaskSettings({
          inheritCompletionState: true,
        })
        await rootTaskForm.clickSubmitBtnUpdate({
          updatedTasks: [completedRootTask],
        })
        checkNumCalls({ create: 2, update: 1 })
      })
      await checkCompletedPage([
        { ...completedRootTask, subtasks: [completedSubtask] },
      ])
    })

    test('auto-completes grandparent chain when completing the last subtask', async ({
      page,
      buildTask,
    }) => {
      const rootTask = buildTask('Root Task', TaskStatus.PINNED)
      const completedRootTask = {
        ...rootTask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask
      const subtask = buildTask('Subtask', TaskStatus.OPEN)
      const completedSubtask = {
        ...subtask,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask
      const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)

      const completedSubtask2 = {
        ...subtask2,
        status: TaskStatus.COMPLETED,
      } as const satisfies CreatedTask

      await test.step('Create root task with subtask, set autocomplete=on', async () => {
        await page.locator(Selectors.CREATE_TASK_BTN).click()
        const rootTaskForm = getTaskForm(0)
        await rootTaskForm.fillTaskForm(rootTask)
        await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const subtaskForm = getTaskForm(1)
        await subtaskForm.fillTaskForm(subtask)
        await subtaskForm.clickSubmitBtnCreate()
        await rootTaskForm.setTaskFormSubtaskSettings({
          autoHideCompleted: false,
          inheritCompletionState: true,
        })
        await rootTaskForm.clickSubmitBtnCreate({
          newTasks: [rootTask, subtask],
        })
        checkNumCalls({ create: 2, update: 0 })
        await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
      })

      await test.step('Edit subtask to enable autocomplete and add subtask2 as its child', async () => {
        await openTaskEditForm(subtask)
        const subtaskForm = getTaskForm(1)
        await subtaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
        const subtask2Form = getTaskForm(2)
        await subtask2Form.fillTaskForm(subtask2)
        await subtask2Form.clickSubmitBtnCreate()
        await subtaskForm.setTaskFormSubtaskSettings({
          autoHideCompleted: false,
          inheritCompletionState: true,
        })
        await subtaskForm.clickSubmitBtnUpdate({ updatedTasks: [subtask] })
        checkNumCalls({ create: 3, update: 1 })
        await expandAndCheckTree({
          ...rootTask,
          subtasks: [{ ...subtask, subtasks: [subtask2] }],
        })
      })

      await test.step('Complete subtask2 — subtask and rootTask both auto-complete', async () => {
        await changeStatusViaStatusChangeDialog(
          subtask2,
          TaskStatus.COMPLETED,
          {
            sideEffects: [completedSubtask, completedRootTask], // Parent and grandparent auto-completes as the last subtask is marked done
          },
        )
        checkNumCalls({ create: 3, update: 4 })
      })
      await checkCompletedPage([
        {
          ...completedRootTask,
          subtasks: [{ ...completedSubtask, subtasks: [completedSubtask2] }],
        },
      ])
    })
  })

  test.describe('Auto-hide completed subtasks', () => {
    test.describe('When creating a new root task', () => {
      test('via completion checkbox in new subtask form', async ({
        page,
        buildTask,
      }) => {
        const rootTask = buildTask('Root Task', TaskStatus.PINNED)
        const subtask = buildTask('Subtask', TaskStatus.OPEN)
        const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)
        const completedSubtask2 = {
          ...subtask2,
          status: TaskStatus.COMPLETED,
        } as const satisfies CreatedTask

        const rootTaskForm = getTaskForm(0)
        await test.step('Create root task with one uncompleted subtask, enable auto-hide', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          await rootTaskForm.fillTaskForm(rootTask)
          await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
          const subtaskForm = getTaskForm(1)
          await subtaskForm.fillTaskForm(subtask) // task that will not be marked as completed, to verify that only completed subtasks are hidden
          await subtaskForm.clickSubmitBtnCreate()

          // default is autoHideCompleted: true
          await rootTaskForm.checkTaskFormSubtaskSettings({
            autoHideCompleted: true,
          })
        })

        await test.step('Add a second subtask, mark it completed in the form', async () => {
          await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
          const subtask2Form = getTaskForm(1)
          await subtask2Form.fillTaskForm(subtask2)
          await subtask2Form
            .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
            .click()
          await subtask2Form.clickSubmitBtnCreate()
        })

        await test.step('Submit root task — completed subtask hidden in tree', async () => {
          await rootTaskForm.checkTaskFormSubtaskSettings({
            autoHideCompleted: true,
          })
          await rootTaskForm.checkTaskFormSubtasks([subtask])
          await rootTaskForm.clickSubmitBtnCreate({
            newTasks: [rootTask, subtask, completedSubtask2],
          })
          checkNumCalls({ create: 3, update: 0 })
          await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
        })
      })

      test('via completion checkbox in edit subtask form', async ({
        page,
        buildTask,
      }) => {
        const rootTask = buildTask('Root Task', TaskStatus.PINNED)
        const subtask = buildTask('Subtask', TaskStatus.OPEN)
        const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)
        const completedSubtask2 = {
          ...subtask2,
          status: TaskStatus.COMPLETED,
        } as const satisfies CreatedTask

        const rootTaskForm = getTaskForm(0)
        await test.step('Create root task with one uncompleted subtask, enable auto-hide', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          await rootTaskForm.fillTaskForm(rootTask)
          await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
          const subtaskForm = getTaskForm(1)
          await subtaskForm.fillTaskForm(subtask) // task that will not be marked as completed, to verify that only completed subtasks are hidden
          await subtaskForm.clickSubmitBtnCreate()
          await rootTaskForm.checkTaskFormSubtaskSettings({
            autoHideCompleted: true,
          })
        })

        await test.step('Add a second subtask', async () => {
          await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
          const subtask2Form = getTaskForm(1)
          await subtask2Form.fillTaskForm(subtask2)
          await subtask2Form.clickSubmitBtnCreate()
        })

        await test.step('Edit the second subtask, mark it completed', async () => {
          await rootTaskForm.checkTaskFormSubtasks([subtask, subtask2])
          await rootTaskForm
            .locator(Selectors.TaskForm.EDIT_SUBTASK_BTN)
            .last()
            .click()
          const subtask2Form = getTaskForm(1)
          await subtask2Form
            .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
            .click()
          await subtask2Form.clickSubmitBtnCreate()
        })

        await test.step('Submit root task — completed subtask hidden in tree', async () => {
          await rootTaskForm.checkTaskFormSubtaskSettings({
            autoHideCompleted: true,
          })
          await rootTaskForm.checkTaskFormSubtasks([subtask])
          await rootTaskForm.clickSubmitBtnCreate({
            newTasks: [rootTask, subtask, completedSubtask2],
          })
          checkNumCalls({ create: 3, update: 0 })
          await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
        })
      })
    })

    test.describe('When editing an existing root task', () => {
      test('with subtasks already completed', async ({ page, buildTask }) => {
        const rootTask = buildTask('Root Task', TaskStatus.PINNED)
        const subtask = buildTask('Subtask', TaskStatus.OPEN)
        const subtask2 = buildTask('Subtask 2', TaskStatus.OPEN)
        const completedSubtask2 = {
          ...subtask2,
          status: TaskStatus.COMPLETED,
        } as const satisfies CreatedTask

        const rootTaskForm = getTaskForm(0)
        await test.step('Create root task with one open and one completed subtask', async () => {
          await page.locator(Selectors.CREATE_TASK_BTN).click()
          await rootTaskForm.fillTaskForm(rootTask)
          await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
          const subtaskForm = getTaskForm(1)
          await subtaskForm.fillTaskForm(subtask)
          await subtaskForm.clickSubmitBtnCreate()
          await rootTaskForm.locator(Selectors.TaskForm.ADD_SUBTASK_BTN).click()
          const subtask2Form = getTaskForm(1)
          await subtask2Form.fillTaskForm(subtask2)
          await subtask2Form
            .locator(Selectors.TaskForm.MARK_COMPLETED_CHECKBOX)
            .click()
          await subtask2Form.clickSubmitBtnCreate()

          await rootTaskForm.setTaskFormSubtaskSettings({
            autoHideCompleted: false,
          })
          await rootTaskForm.checkTaskFormSubtasks([subtask, completedSubtask2])
          await rootTaskForm.clickSubmitBtnCreate({
            newTasks: [rootTask, subtask, completedSubtask2],
          })
          await expandAndCheckTree({
            ...rootTask,
            subtasks: [subtask, completedSubtask2],
          })
          checkNumCalls({ create: 3, update: 0 })
        })

        await test.step('Edit root task, enable auto-hide — completed subtask disappears from form', async () => {
          await openTaskEditForm(rootTask)
          const editedRootTaskForm = getTaskForm(0)
          await editedRootTaskForm.checkTaskFormSubtasks([
            subtask,
            completedSubtask2,
          ])
          await editedRootTaskForm.setTaskFormSubtaskSettings({
            autoHideCompleted: true,
          })
          await editedRootTaskForm.checkTaskFormSubtasks([subtask])
          await editedRootTaskForm.clickSubmitBtnUpdate({
            updatedTasks: [rootTask],
          })
          checkNumCalls({ create: 3, update: 1 })
          await expandAndCheckTree({ ...rootTask, subtasks: [subtask] })
        })
      })
    })
  })
})
