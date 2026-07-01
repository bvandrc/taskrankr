import { expect, type Locator, type Page } from '@playwright/test'
import { format } from 'date-fns'
import { escapeRegExp } from 'es-toolkit'
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
import { waitForUpdateTask } from '../fixtures'
import { getIsLoggedIn, getPage } from '../test-globals'
import { checkTasksExistBackend } from './api'
import { expectWithFlag } from './index'
import type { CreatedTask } from './intercepts'
import { checkIsAtHomePage, goToCompletedPage } from './navigation'

const { TaskCard } = Selectors
const TOP_LEVEL_CARD_TITLE_SEL =
  `:scope > div:first-child ${TaskCard.THIS_TASK_INFO} ${TaskCard.TITLE}` as const

type TaskTreeNode = PickDeep<
  CreatedTask,
  'name' | 'status' | 'schedule.dueAt' | RankField
> & {
  subtasks?: TaskTreeNode[]
}

const flattenTree = (nodes: TaskTreeNode[]): TaskTreeNode[] =>
  nodes.flatMap((n) => [n, ...flattenTree(n.subtasks ?? [])])

const getTaskCardLocator = (
  scope: Locator | Page,
  task: Pick<Task, 'name'>,
): Locator => {
  return scope.locator(TaskCard.CARD).filter({
    // `has` must be page-rooted, not `scope`-rooted: inside a filter its `:scope`
    // binds to the candidate card. Rooting it at `scope` (the parent card for
    // subtasks) points `:scope` at the parent instead, so it matches nothing.
    has: getPage()
      .locator(TOP_LEVEL_CARD_TITLE_SEL)
      // Escape: task names carry a `[wN-xxxxx]` suffix that is otherwise parsed
      // as a regex character class (and `N-x` as an invalid range).
      .filter({ hasText: new RegExp(`^${escapeRegExp(task.name)}$`) }),
  })
}

async function getTaskCard(
  scope: Locator | Page,
  task: Pick<Task, 'name'>,
): Promise<Locator> {
  const card = getTaskCardLocator(scope, task)
  await expect(card).toHaveCount(1)
  await card.scrollIntoViewIfNeeded()
  await expect(card).toBeVisible()
  return card
}

async function checkTitleAndSubtasks(
  scope: Locator | Page,
  task: TaskTreeNode,
  tier: number,
  settings: FieldConfig,
) {
  let card = await getTaskCard(scope, task)
  const title = card.locator(TOP_LEVEL_CARD_TITLE_SEL)
  await expectWithFlag(
    title,
    tier > 0 && task.status === TaskStatus.COMPLETED,
  ).toHaveClass(/line-through/)

  const taskInfo = card.locator(TaskCard.THIS_TASK_INFO).first()
  await expect(taskInfo).toHaveAttribute('data-status', task.status)

  const dueAt = task.schedule?.dueAt
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
    const expVal = task[field]
    if (!settings[field].visible) {
      await expect(badge).not.toBeAttached()
    } else if (expVal == null) {
      await expect(badge).toHaveText('')
      await expect(badge).toHaveCSS('opacity', '0')
    } else {
      await expect(badge).toHaveText(expVal)
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
    card = await getTaskCard(scope, task)
  }

  for (const subtask of task.subtasks) {
    await checkTitleAndSubtasks(card, subtask, tier + 1, settings)
  }
}

export async function expandAndCheckTree(
  task: TaskTreeNode,
  { settings = DEFAULT_FIELD_CONFIG }: { settings?: FieldConfig } = {},
) {
  await checkTitleAndSubtasks(getPage(), task, 0, settings)
}

export async function openTaskEditForm(task: Pick<Task, 'name'>) {
  const page = getPage()
  await expect(page.locator(Selectors.TaskForm.FORM)).not.toBeAttached()
  const card = await getTaskCard(page, task)
  const title = card.locator(TOP_LEVEL_CARD_TITLE_SEL)
  await title.click()
  await expect(page.locator(Selectors.TaskForm.FORM)).toBeVisible()
}

export async function openStatusChangeDialog(task: Pick<Task, 'name'>) {
  const page = getPage()
  const card = await getTaskCard(page, task)
  const title = card.locator(TOP_LEVEL_CARD_TITLE_SEL)
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
) {
  await openStatusChangeDialog(task)

  const page = getPage()
  const completeBtn = page.locator(Selectors.ChangeStatusDialog.COMPLETE_BTN)
  if (hasIncompleteSubtasks) {
    await expect(completeBtn).toBeDisabled()
    return
  }

  const allUpdated = [
    { ...task, status: newStatus },
    ...sideEffects,
  ] satisfies CreatedTask[]
  const updateWaiter = getIsLoggedIn()
    ? waitForUpdateTask(allUpdated.length)
    : null

  await expect(completeBtn).not.toBeDisabled()
  await completeBtn.click()

  if (updateWaiter) await updateWaiter
  await checkTasksExistBackend(allUpdated)
  await expect(
    page.locator(Selectors.ChangeStatusDialog.DIALOG),
  ).not.toBeAttached()
}

export async function checkCompletedPage(completedTasks: TaskTreeNode[]) {
  await checkIsAtHomePage()
  const page = getPage()
  for (const task of flattenTree(completedTasks)) {
    await expect(getTaskCardLocator(page, task)).not.toBeAttached()
  }

  await goToCompletedPage()
  for (const task of completedTasks) {
    await expandAndCheckTree(task)
  }
}
