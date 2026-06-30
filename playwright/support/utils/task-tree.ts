import { expect, type Locator } from '@playwright/test'
import { format } from 'date-fns'
import type { PickDeep } from 'type-fest'

import {
  DEFAULT_FIELD_CONFIG,
  type FieldConfig,
  type RankField,
  RankFields,
  type Task,
  TaskStatus,
} from '~/shared/schema'
import { Selectors } from '../constants'
import { waitForUpdate } from '../fixtures'
import { getIsLoggedIn, getPage } from '../test-globals'
import { checkTasksExist } from './api'
import type { CreatedTask } from './intercepts'
import { checkIsAtHomePage, goToCompletedPage } from './navigation'

const { TaskCard } = Selectors

type TaskTreeNode = PickDeep<
  CreatedTask,
  'name' | 'status' | 'schedule.dueAt' | RankField
> & {
  subtasks?: TaskTreeNode[]
}

const flattenTree = (nodes: TaskTreeNode[]): TaskTreeNode[] =>
  nodes.flatMap((n) => [n, ...flattenTree(n.subtasks ?? [])])

export function getTaskCardTitle(task: Pick<Task, 'name'>): Locator {
  return getPage()
    .locator(`${TaskCard.CARD} ${TaskCard.TITLE}`)
    .filter({ hasText: new RegExp(`^${task.name}$`) })
}

async function getTaskCard(task: TaskTreeNode): Promise<Locator> {
  const title = getTaskCardTitle(task)
  await expect(title).toHaveCount(1)
  await title.scrollIntoViewIfNeeded()
  await expect(title).toBeVisible()
  return getPage().locator(TaskCard.CARD).filter({ has: title })
}

async function checkTitleAndSubtasks(
  task: TaskTreeNode,
  tier: number,
  settings: FieldConfig,
): Promise<void> {
  const _page = getPage()
  const title = getTaskCardTitle(task)
  if (tier > 0 && task.status === TaskStatus.COMPLETED) {
    await expect(title).toHaveClass(/line-through/)
  } else {
    await expect(title).not.toHaveClass(/line-through/)
  }

  let card = await getTaskCard(task)
  const taskInfo = card.locator(TaskCard.THIS_TASK_INFO).first()
  await expect(taskInfo).toHaveAttribute('data-status', task.status)

  const dueAt = (task as CreatedTask).schedule?.dueAt
  if (dueAt) {
    await expect(taskInfo.locator(TaskCard.DUE_BADGE)).toBeVisible()
    await expect(taskInfo.locator(TaskCard.DUE_BADGE)).toHaveText(
      `Due ${format(dueAt, 'MMM d')}`,
    )
  } else {
    await expect(taskInfo.locator(TaskCard.DUE_BADGE)).not.toBeAttached()
  }

  for (const field of RankFields) {
    const badge = taskInfo.locator(TaskCard.RankFieldBadge(field))
    const expVal = (task as Record<string, unknown>)[field]
    if (!settings[field].visible) {
      await expect(badge).not.toBeAttached()
    } else if (expVal == null) {
      await expect(badge).toHaveText('')
      await expect(badge).not.toBeVisible()
    } else {
      await expect(badge).toHaveText(expVal as string)
    }
  }

  if (!task.subtasks?.length) {
    await expect(
      card.locator(`${TaskCard.COLLAPSE_BTN}, ${TaskCard.EXPAND_BTN}`).first(),
    ).not.toBeAttached()
    return
  }

  // Expand if collapsed
  const expandBtn = card.locator(TaskCard.EXPAND_BTN).first()
  if (await expandBtn.isVisible()) {
    await expandBtn.click()
    await expect(card.locator(TaskCard.COLLAPSE_BTN).first()).toBeVisible()
    // Re-get card after expand (may re-render)
    card = await getTaskCard(task)
  }

  for (const subtask of task.subtasks) {
    await checkTitleAndSubtasks(subtask, tier + 1, settings)
  }
}

export async function expandAndCheckTree(
  task: TaskTreeNode,
  { settings = DEFAULT_FIELD_CONFIG }: { settings?: FieldConfig } = {},
): Promise<void> {
  await checkTitleAndSubtasks(task, 0, settings)
}

export async function openTaskEditForm(
  task: Pick<Task, 'name'>,
): Promise<void> {
  const page = getPage()
  await expect(page.locator(Selectors.TaskForm.FORM)).not.toBeAttached()
  await getTaskCardTitle(task).click()
  await expect(page.locator(Selectors.TaskForm.FORM)).toBeVisible()
}

export async function openStatusChangeDialog(
  task: Pick<Task, 'name'>,
): Promise<void> {
  const page = getPage()
  const title = getTaskCardTitle(task)
  await page.clock.install()
  await title.dispatchEvent('mousedown')
  await page.clock.fastForward(900)
  await expect(page.locator(Selectors.ChangeStatusDialog.DIALOG)).toBeVisible()
  await page.clock.resume()
}

export async function changeStatusViaStatusChangeDialog(
  task: Omit<CreatedTask, 'status'>,
  newStatus: TaskStatus.COMPLETED,
  {
    hasIncompleteSubtasks = false,
    sideEffects = [],
  }: { hasIncompleteSubtasks?: boolean; sideEffects?: CreatedTask[] } = {},
): Promise<void> {
  await openStatusChangeDialog(task)

  const page = getPage()
  const completeBtn = page.locator(Selectors.ChangeStatusDialog.COMPLETE_BTN)
  if (hasIncompleteSubtasks) {
    await expect(completeBtn).toBeDisabled()
    return
  }

  const allUpdated = [
    { ...task, status: newStatus } as CreatedTask,
    ...sideEffects,
  ]
  const updateWaiter = getIsLoggedIn() ? waitForUpdate(allUpdated.length) : null

  await expect(completeBtn).not.toBeDisabled()
  await completeBtn.click()

  if (updateWaiter) await updateWaiter
  await checkTasksExist(allUpdated)
  await expect(
    page.locator(Selectors.ChangeStatusDialog.DIALOG),
  ).not.toBeAttached()
}

export async function checkCompletedPage(
  completedTasks: TaskTreeNode[],
): Promise<void> {
  await checkIsAtHomePage()
  for (const task of flattenTree(completedTasks)) {
    await expect(getTaskCardTitle(task)).not.toBeAttached()
  }

  await goToCompletedPage()
  for (const task of completedTasks) {
    await expandAndCheckTree(task)
  }
}
