import { type Task, TaskStatus } from '../schema'

export * from './id-list-utils'
export * from './zod-utils'

export const getDirectSubtasks = <T extends Pick<Task, 'parentId'>>(
  allTasks: T[],
  id: number,
): T[] => allTasks.filter((task) => task.parentId === id)

/**
 * Collects every descendant of `rootIds` through the `parentId` graph. Pass
 * `includeRoots: true` to also include the roots themselves.
 */
export const collectDescendantIds = (
  tasks: Task[],
  rootIds: Iterable<number>,
  opts: { includeRoots?: boolean } = {},
): Set<number> => {
  const result = new Set<number>()
  const rootSet = new Set(rootIds)
  if (opts.includeRoots) {
    rootSet.forEach((id) => {
      result.add(id)
    })
  }
  let frontier: Set<number> = rootSet
  while (frontier.size > 0) {
    const next = new Set<number>()
    for (const t of tasks) {
      if (
        t.parentId !== null &&
        frontier.has(t.parentId) &&
        !result.has(t.id)
      ) {
        result.add(t.id)
        next.add(t.id)
      }
    }
    frontier = next
  }
  return result
}

export const getTaskStatuses = (task: Pick<Task, 'status'>) => ({
  isInProgress: task.status === TaskStatus.IN_PROGRESS,
  isPinned: task.status === TaskStatus.PINNED,
  isCompleted: task.status === TaskStatus.COMPLETED,
})

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

/**
 * Additional props to change when changing a task's status, including:
 *  - timestamps that accompany the IN_PROGRESS and COMPLETED transitions
 */
export const statusToStatusPatch = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.IN_PROGRESS:
      return {
        status,
        inProgressStartedAt: new Date(),
        completedAt: null,
      } as const satisfies Partial<Task>
    case TaskStatus.COMPLETED:
      return {
        status,
        completedAt: new Date(),
        inProgressStartedAt: null,
      } as const satisfies Partial<Task>
    case TaskStatus.PINNED:
    case TaskStatus.OPEN:
      return {
        status,
        inProgressStartedAt: null,
        completedAt: null,
      } as const satisfies Partial<Task>
    default:
      throw new Error(`Unhandled status: ${status satisfies never}`)
  }
}

export const getHasIncomplete = (tasks: Task[]): boolean =>
  tasks.some((t) => t.status !== TaskStatus.COMPLETED)

export const getHasIncompleteSubtasks = (
  allTasks: Task[],
  taskId: number,
): boolean => getHasIncomplete(getDirectSubtasks(allTasks, taskId))

export const getChildrenLatestCompletedAt = (children: Task[]): Date | null =>
  children.reduce<Date | null>((latest, c) => {
    const completedAt = c.completedAt ? new Date(c.completedAt) : null
    if (!completedAt) return latest
    if (!latest) return completedAt
    return completedAt > latest ? completedAt : latest
  }, null)

/**
 * Canonical "undo completion" patch: returns a task to OPEN and clears every
 * status-related timestamp.
 */
export const REVERT_COMPLETION_PATCH = {
  status: TaskStatus.OPEN,
  completedAt: null,
  inProgressStartedAt: null,
} as const satisfies Partial<Task>

/** Stored timeSpent plus any active IN_PROGRESS session up to `now` (ms epoch). */
export const accumulatedTimeSpent = (
  task: Pick<Task, 'timeSpent' | 'inProgressStartedAt'>,
  now: number,
): number =>
  task.timeSpent +
  (task.inProgressStartedAt ? now - task.inProgressStartedAt.getTime() : 0)

/**
 * Patch that demotes an IN_PROGRESS task to PINNED, flushing its accumulated
 * time into timeSpent. Used to enforce the single-IN_PROGRESS invariant when
 * another task is being moved to IN_PROGRESS.
 */
export const inProgressDemotionPatch = (
  task: Pick<Task, 'timeSpent' | 'inProgressStartedAt'>,
  now: number,
) =>
  ({
    status: TaskStatus.PINNED,
    timeSpent: accumulatedTimeSpent(task, now),
    inProgressStartedAt: null,
  }) as const satisfies Partial<Task>

/**
 * Full patch for transitioning `currentTask` to `newStatus`: timestamp
 * side-effects from `statusToStatusPatch`, plus a timeSpent flush when
 * leaving IN_PROGRESS.
 */
export const statusChangeSideEffectsPatch = (
  newStatus: TaskStatus,
  currentTask: Pick<Task, 'status' | 'timeSpent' | 'inProgressStartedAt'>,
  now: number,
) => {
  const patch = statusToStatusPatch(newStatus)
  if (
    currentTask.status === TaskStatus.IN_PROGRESS &&
    newStatus !== TaskStatus.IN_PROGRESS &&
    currentTask.inProgressStartedAt
  ) {
    return {
      ...patch,
      timeSpent: accumulatedTimeSpent(currentTask, now),
    } satisfies Partial<Task>
  }
  return patch
}

/**
 * Patch to auto-complete a parent with `inheritCompletionState` enabled, or
 * null if any child is still incomplete. `completedAt` reflects the latest
 * child completion so the parent inherits its meaningful "done" timestamp.
 *
 * Pass `treatAsCompleted` to count a specific child id as completed regardless
 * of its current status — useful when computing from a snapshot taken before
 * the child's write commits.
 */
export const autoCompleteParentPatch = (
  children: Task[],
  options: { treatAsCompleted?: number } = {},
) => {
  const allComplete = children.every(
    (c) =>
      c.id === options.treatAsCompleted || c.status === TaskStatus.COMPLETED,
  )
  if (!allComplete) return null
  return {
    status: TaskStatus.COMPLETED,
    completedAt: getChildrenLatestCompletedAt(children) ?? new Date(),
    inProgressStartedAt: null,
  } as const satisfies Partial<Task>
}
