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
