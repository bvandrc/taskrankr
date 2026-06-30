/**
 * @fileoverview Tree-walking helpers + sorting/filtering logic for task
 * lists.
 */

import type {
  AllUnionFields,
  MergeExclusive,
  Simplify,
  ValueOf,
} from 'type-fest'

import type { TaskWithSubtasks } from '@/types'
import {
  RankField,
  SubtaskSortMode,
  type Task,
  TaskStatus,
} from '~/shared/schema'
import { getLevelWeight } from '~/shared/utils/task-utils'

export * from '~/shared/utils/task-utils'

// *****************************************************************************
// Sorting
// *****************************************************************************

const SortBy = { ...RankField, DATE_COMPLETED: 'date_completed' } as const
type SortBy = ValueOf<typeof SortBy>

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/** Default sort direction per field (DESC = best-first). */
export const SORT_DIRECTIONS: Record<SortBy, SortDirection> = {
  date_completed: SortDirection.DESC,
  [RankField.PRIORITY]: SortDirection.DESC,
  [RankField.EASE]: SortDirection.ASC,
  [RankField.ENJOYMENT]: SortDirection.DESC,
  [RankField.TIME]: SortDirection.ASC,
}

/** Compares two tasks by a single field, respecting its sort direction. */
const compareByField = (a: Task, b: Task, field: SortBy): number => {
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
const sortTasksByField = <T extends Task>(tasks: T[], order: SortBy[]): T[] => {
  return [...tasks].sort((a, b) => {
    const aCompleted = a.status === TaskStatus.COMPLETED ? 1 : 0
    const bCompleted = b.status === TaskStatus.COMPLETED ? 1 : 0
    if (aCompleted !== bCompleted) return aCompleted - bCompleted

    for (const field of order) {
      const cmp = compareByField(a, b, field)
      if (cmp !== 0) return cmp
    }
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

type TaskSortArgs = Simplify<
  MergeExclusive<
    {
      sortMode: SubtaskSortMode.INHERIT
      /** Field order of direct subtasks */
      fieldSortOrder: SortBy[]
    },
    {
      sortMode: SubtaskSortMode.MANUAL
      /** Manual order of direct subtasks */
      manualOrder: number[]
    }
  >
>

type TaskSortArgsComplete = Required<AllUnionFields<TaskSortArgs>>

/** Sorts tasks by their position in a user-defined sequence of IDs (the saved manual order). */
const sortTasksByManualOrder = <T extends Task>(
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

/** Sorts tasks respecting the parent's sort mode: by manual id order, or by rank fields. */
export const sortTasksByMode = <T extends Task>(
  tasks: T[],
  { sortMode, fieldSortOrder, manualOrder }: TaskSortArgsComplete,
): T[] =>
  sortMode === SubtaskSortMode.MANUAL
    ? sortTasksByManualOrder(tasks, manualOrder)
    : sortTasksByField(tasks, fieldSortOrder)

export const SORT_ORDER_MAP = {
  [RankField.PRIORITY]: [SortBy.PRIORITY, SortBy.EASE, SortBy.ENJOYMENT],
  [RankField.EASE]: [SortBy.EASE, SortBy.PRIORITY, SortBy.ENJOYMENT],
  [RankField.ENJOYMENT]: [SortBy.ENJOYMENT, SortBy.PRIORITY, SortBy.EASE],
  [RankField.TIME]: [SortBy.TIME, SortBy.PRIORITY, SortBy.EASE],
} as const satisfies { [K in RankField]: [K, ...SortBy[]] }

export const sortTaskTree = (
  tasks: TaskWithSubtasks[],
  { sortMode, fieldSortOrder, manualOrder = [] }: TaskSortArgsComplete,
): TaskWithSubtasks[] => {
  const withSortedChildren = tasks.map(({ subtasks, ...task }) => ({
    ...task,
    subtasks: sortTaskTree(subtasks, {
      sortMode: task.subtaskSortMode,
      fieldSortOrder,
      manualOrder: task.subtaskOrder,
    }),
  }))

  return sortTasksByMode(withSortedChildren, {
    sortMode,
    fieldSortOrder,
    manualOrder,
  })
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
): TaskWithSubtasks[] => {
  const childOrder = childFieldSortOrder ?? fieldSortOrder
  // Sort the full tree with childOrder (correctly handles all MANUAL subtask
  // modes at every level). Then re-sort just the root level with fieldSortOrder
  // when a different root order was requested.
  const sorted = sortTaskTree(filterTaskTree(tasks, searchTerm), {
    sortMode: SubtaskSortMode.INHERIT,
    fieldSortOrder: childOrder,
    manualOrder: [],
  })
  return childOrder === fieldSortOrder
    ? sorted
    : sortTasksByMode(sorted, {
        sortMode: SubtaskSortMode.INHERIT, // at root, no manual order
        fieldSortOrder,
        manualOrder: [], // irrelevant whe sortMode is INHERIT
      })
}

// *****************************************************************************
// Hiding
// *****************************************************************************

/**
 * true iff `task` should be hidden: either its parent has `autoHideCompleted`
 * and the task is COMPLETED, or its `schedule.hideUntil` date is in the future.
 */
export const shouldBeHidden = (
  task: Pick<Task, 'status' | 'parentId' | 'schedule'>,
  taskById: Map<number, Task>,
  now: Date = new Date(),
): boolean => {
  const parent = task.parentId != null ? taskById.get(task.parentId) : undefined
  if (parent?.autoHideCompleted && task.status === TaskStatus.COMPLETED)
    return true
  const hideUntil = task.schedule?.hideUntil
  if (
    task.status !== TaskStatus.COMPLETED &&
    hideUntil != null &&
    now < hideUntil
  )
    return true
  return false
}
