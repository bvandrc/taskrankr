/**
 * @fileoverview Tree-walking helpers + sorting/filtering logic for task
 * lists.
 */

import type { ValueOf } from 'type-fest'

import type { TaskWithSubtasks } from '@/types'
import {
  type Ease,
  type Enjoyment,
  type Priority,
  SortOption,
  SubtaskSortMode,
  type Task,
  TaskStatus,
  type Time,
} from '~/shared/schema'

export * from '~/shared/utils/task-utils'

// *****************************************************************************
// Sorting
// *****************************************************************************

const SortBy = { ...SortOption, DATE_COMPLETED: 'date_completed' } as const
type SortBy = ValueOf<typeof SortBy>

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/** Default sort direction per field (DESC = best-first). */
export const SORT_DIRECTIONS: Record<SortBy, SortDirection> = {
  date_created: SortDirection.DESC,
  date_completed: SortDirection.DESC,
  priority: SortDirection.DESC,
  ease: SortDirection.ASC,
  enjoyment: SortDirection.DESC,
  time: SortDirection.ASC,
}

const LEVEL_WEIGHTS = {
  highest: 5,
  hardest: 5,
  high: 4,
  hard: 4,
  medium: 3,
  low: 2,
  easy: 2,
  lowest: 1,
  easiest: 1,
} as const satisfies Record<Priority | Ease | Enjoyment | Time, number>

const getLevelWeight = (
  level: keyof typeof LEVEL_WEIGHTS | null | undefined,
): number => (level ? (LEVEL_WEIGHTS[level] ?? 0) : 0)

/** Compares two tasks by a single field, respecting its sort direction. */
const compareByField = (a: Task, b: Task, field: SortBy): number => {
  if (field === SortBy.DATE_CREATED) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  }
  if (field === SortBy.DATE_COMPLETED) {
    return (
      new Date(b.completedAt ?? b.createdAt).getTime() -
      new Date(a.completedAt ?? a.createdAt).getTime()
    )
  }
  const direction = SORT_DIRECTIONS[field]
  const valA = getLevelWeight(a[field])
  const valB = getLevelWeight(b[field])
  return direction === SortDirection.DESC ? valB - valA : valA - valB
}

/** Sorts tasks by a passed sort order of fields; earlier fields take priority.
 *  Completed tasks always sort to the bottom. */
export const sortTasksByField = <T extends Task>(
  tasks: T[],
  order: SortBy[],
): T[] =>
  [...tasks].sort((a, b) => {
    const aCompleted = a.status === TaskStatus.COMPLETED ? 1 : 0
    const bCompleted = b.status === TaskStatus.COMPLETED ? 1 : 0
    if (aCompleted !== bCompleted) return aCompleted - bCompleted

    for (const field of order) {
      const cmp = compareByField(a, b, field)
      if (cmp !== 0) return cmp
    }
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

/** Sorts tasks by their position in a user-defined sequence of IDs (the saved manual order). */
export const sortTasksByManualOrder = <T extends Task>(
  tasks: T[],
  order: number[],
): T[] =>
  [...tasks].sort((a, b) => {
    const indexA = order.indexOf(a.id)
    const indexB = order.indexOf(b.id)
    return (
      (indexA === -1 ? Number.POSITIVE_INFINITY : indexA) -
      (indexB === -1 ? Number.POSITIVE_INFINITY : indexB)
    )
  })

export const SORT_ORDER_MAP = {
  date_created: [SortBy.DATE_CREATED],
  priority: [SortBy.PRIORITY, SortBy.EASE, SortBy.ENJOYMENT],
  ease: [SortBy.EASE, SortBy.PRIORITY, SortBy.ENJOYMENT],
  enjoyment: [SortBy.ENJOYMENT, SortBy.PRIORITY, SortBy.EASE],
  time: [SortBy.TIME, SortBy.PRIORITY, SortBy.EASE],
} as const satisfies { [K in SortOption]: [K, ...SortBy[]] }

export const sortTaskTree = (
  tasks: TaskWithSubtasks[],
  {
    sortMode,
    fieldSortOrder,
    manualOrder,
    childFieldSortOrder,
  }: {
    sortMode?: SubtaskSortMode
    fieldSortOrder: SortBy[]
    manualOrder?: number[]
    childFieldSortOrder?: SortBy[]
  },
): TaskWithSubtasks[] => {
  const inheritedSort = childFieldSortOrder ?? fieldSortOrder
  const withSortedChildren = tasks.map(({ subtasks, ...task }) => ({
    ...task,
    subtasks: sortTaskTree(subtasks, {
      fieldSortOrder: inheritedSort,
      sortMode: task.subtaskSortMode,
      manualOrder: task.subtaskOrder,
    }),
  }))

  if (sortMode === SubtaskSortMode.MANUAL && manualOrder) {
    return sortTasksByManualOrder(withSortedChildren, manualOrder)
  }

  return sortTasksByField(withSortedChildren, fieldSortOrder)
}

// *****************************************************************************
// Filtering
// *****************************************************************************

export const filterTaskTree = (
  tasks: TaskWithSubtasks[],
  searchTerm: string,
): TaskWithSubtasks[] => {
  if (!searchTerm) return tasks
  const lower = searchTerm.toLowerCase()
  return tasks.reduce((acc: TaskWithSubtasks[], task) => {
    const matches = task.name.toLowerCase().includes(lower)
    const filteredSubtasks = filterTaskTree(task.subtasks, searchTerm)
    if (matches || filteredSubtasks.length > 0) {
      acc.push({ ...task, subtasks: filteredSubtasks })
    }
    return acc
  }, [])
}

export const filterRootTasks = (tasks: Task[], searchTerm: string): Task[] => {
  if (!searchTerm.trim()) return tasks
  const q = searchTerm.toLowerCase()
  return tasks.filter((task) => task.name.toLowerCase().includes(q))
}

export const filterAndSortTree = (
  tasks: TaskWithSubtasks[],
  {
    searchTerm,
    fieldSortOrder,
    childFieldSortOrder,
  }: {
    searchTerm: string
    fieldSortOrder: SortBy[]
    childFieldSortOrder?: SortBy[]
  },
) =>
  sortTaskTree(filterTaskTree(tasks, searchTerm), {
    fieldSortOrder,
    childFieldSortOrder,
  })

// *****************************************************************************
// Hiding
// *****************************************************************************

/**
 * true iff `task` is hidden purely because its parent has `autoHideCompleted`
 * enabled and the task is COMPLETED. (i.e., ignore the user-set `hidden` flag)
 */
export const isAutoHiddenByParent = (
  task: Pick<Task, 'status'>,
  parent: Pick<Task, 'autoHideCompleted'> | undefined,
): boolean =>
  Boolean(parent?.autoHideCompleted && task.status === TaskStatus.COMPLETED)

/**
 * true iff `task` should be considered hidden in the UI, accounting for both
 * the user-set `hidden` flag and parent-driven auto-hide of COMPLETED subtasks.
 */
export const isEffectivelyHiddenInTree = (
  task: Pick<Task, 'hidden' | 'status' | 'parentId'>,
  taskById: Map<number, Task>,
): boolean =>
  task.hidden ||
  isAutoHiddenByParent(
    task,
    task.parentId != null ? taskById.get(task.parentId) : undefined,
  )
