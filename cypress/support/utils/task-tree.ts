import { format } from 'date-fns'
import type { PickDeep } from 'type-fest'

import {
  type RankField,
  RankFields,
  type Task,
  TaskStatus,
} from '~/shared/schema'
import { Selectors } from '../constants'
import { type CreatedTask, waitForUpdate } from './intercepts'
import { checkIsAtHomePage, goToCompletedPage } from './navigation'

const { TaskCard } = Selectors

type TaskTreeNode = PickDeep<
  CreatedTask,
  'name' | 'status' | 'schedule.dueAt' | RankField
> & { subtasks?: TaskTreeNode[] }

const flattenTree = (nodes: TaskTreeNode[]): TaskTreeNode[] =>
  nodes.flatMap((n) => [n, ...flattenTree(n.subtasks ?? [])])

export const getTaskCardTitle = (task: Pick<Task, 'name'>) =>
  cy
    .contains(
      `${TaskCard.CARD} ${TaskCard.TITLE}`,
      new RegExp(`^${task.name}$`),
    )
    .should('have.length', 1)
    .scrollIntoView()
    .should('be.visible')

const checkTitleAndSubtasks = (task: TaskTreeNode, tier: number) => {
  const getTaskCard = () =>
    getTaskCardTitle(task)
      .should(
        tier > 0 && task.status === TaskStatus.COMPLETED
          ? 'have.class'
          : 'not.have.class',
        'line-through',
      )
      .closest(TaskCard.CARD)
      .should('have.attr', 'data-status', task.status)
      .then(($el) => {
        if (task.schedule?.dueAt) {
          cy.wrap($el)
            .find(TaskCard.DUE_BADGE)
            .should('be.visible')
            .and('have.text', `Due ${format(task.schedule.dueAt, 'MMM d')}`)
        } else {
          cy.wrap($el).find(TaskCard.DUE_BADGE).should('not.exist')
        }
        for (const field of RankFields) {
          const value = task[field]
          const badge = cy.wrap($el).find(TaskCard.RankFieldBadge(field))
          if (value != null) {
            badge.should('have.text', value.toUpperCase())
          } else {
            badge.should('not.exist')
          }
        }
        return cy.wrap($el)
      })

  const taskCard = getTaskCard()

  if (!task.subtasks?.length) return

  taskCard.then(($card) => {
    const expandBtn = $card.find(TaskCard.EXPAND_BTN).first()
    if (expandBtn.length > 0) {
      cy.log('expanding collapsed card...')
      cy.wrap(expandBtn).click()
      cy.wrap($card).find(TaskCard.COLLAPSE_BTN).should('exist')
      cy.wrap($card).find(TaskCard.CARD).should('exist')
      cy.wait(50) // flakes without this. probably due to animation. If problem occurs on subtasks, try basing time on # of subtasks
      cy.log('...done expanding collapsed card...')
    }
  })

  // re-renders on expand, reduce flake by re-getting
  getTaskCard().within(() => {
    checkSubtasksInCard(task, tier + 1)
  })
}

const checkSubtasksInCard = (task: TaskTreeNode, tier: number) => {
  task.subtasks?.forEach((subtask) => {
    checkTitleAndSubtasks(subtask, tier)
  })
}

export const expandAndCheckTree = (task: TaskTreeNode) =>
  checkTitleAndSubtasks(task, 0)

export const openTaskEditForm = (task: Pick<Task, 'name'>) => {
  cy.get(Selectors.TaskForm.FORM).should('not.exist')
  getTaskCardTitle(task).click()
  cy.get(Selectors.TaskForm.FORM).should('be.visible')
}

export const openStatusChangeDialog = (task: Pick<Task, 'name'>) => {
  const title = getTaskCardTitle(task)
  cy.clock()
  title.trigger('mousedown')
  cy.tick(900)
  cy.get(Selectors.ChangeStatusDialog.DIALOG).should('be.visible')
  cy.clock().invoke('restore')
}

export const changeStatusViaStatusChangeDialog = (
  task: Omit<CreatedTask, 'status'>,
  newStatus: TaskStatus.COMPLETED,
  {
    hasIncompleteSubtasks = false,
    sideEffects = [],
  }: { hasIncompleteSubtasks?: boolean; sideEffects?: CreatedTask[] } = {},
) => {
  openStatusChangeDialog(task)

  if (hasIncompleteSubtasks) {
    cy.get(Selectors.ChangeStatusDialog.COMPLETE_BTN).should('be.disabled')
  } else {
    cy.get(Selectors.ChangeStatusDialog.COMPLETE_BTN)
      .should('be.enabled')
      .click()
  }
  waitForUpdate([{ ...task, status: newStatus }, ...sideEffects])
  cy.get(Selectors.ChangeStatusDialog.DIALOG).should('not.exist')
}

export const checkCompletedPage = (completedTasks: TaskTreeNode[]) => {
  cy.log('Check task is not in main tree')
  checkIsAtHomePage()
  flattenTree(completedTasks).forEach((task) => {
    cy.contains(task.name).should('not.exist')
  })

  cy.log('Check task is in completed page')
  goToCompletedPage()
  for (const task of completedTasks) {
    expandAndCheckTree(task)
  }
}
