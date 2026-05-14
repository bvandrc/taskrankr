/**
 * @fileoverview Local-first task state with localStorage persistence. Every
 * mutation also pushes an op onto `TaskSyncQueueProvider` (which must wrap
 * this provider) for `SyncProvider` to drain in the background.
 *
 * Two contexts for re-render isolation:
 *   - `useTasks()` — reactive view: `tasks`, `hasDemoData`.
 *   - `useTaskMutations()` — stable callbacks + `isInitialized`. Components
 *     that only fire mutations subscribe here and never re-render on task
 *     list changes.
 *
 * Mutators here are strictly real-only and draft-unaware. The TaskForm
 * dialog's in-memory drafts live in `DraftSessionProvider` further down
 * the tree.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { omit } from 'es-toolkit'

import { toast } from '@/hooks/useToast'
import { debugLog } from '@/lib/debug-logger'
import { createDemoTasks } from '@/lib/demo-tasks'
import { getStorageKeys, type StorageMode, storage } from '@/lib/storage'
import {
  buildLocalTask,
  clientKeyMap,
  withClientKeys,
} from '@/lib/task-provider-utils'
import {
  collectDescendantIds,
  getById,
  getChildrenLatestCompletedAt,
  getDirectSubtasks,
  getHasIncompleteSubtasks,
  mapById,
  removeIds,
  statusToStatusPatch,
  updateItem,
} from '@/lib/task-tree-utils'
import { useSettings } from '@/providers/SettingsProvider'
import {
  type SyncOperation,
  SyncOperationType,
  useTaskSyncQueue,
} from '@/providers/TaskSyncQueueProvider'
import type { LocalTask } from '@/types'
import { ERRORS } from '~/shared/constants'
import {
  type CreateTask,
  SubtaskSortMode,
  type Task,
  TaskStatus,
  taskSchema,
  type UpdateTask,
} from '~/shared/schema'

export type CreateTaskContent = Omit<CreateTask, 'userId' | 'id'> & {
  /** Preserved across draft → real promotion. */
  clientKey?: string
}
export type UpdateTaskContent = Omit<UpdateTask, 'id'>
export type MutateTaskContent = CreateTaskContent | UpdateTaskContent
export type DeleteTaskArgs = Pick<Task, 'id' | 'name'>

/**
 * Walks the tree until fixed point, auto-completing parents with
 * `inheritCompletionState` once all their children are completed and
 * auto-reverting them when any child is not completed. Returns the
 * reconciled tasks plus the list of status corrections so callers can
 * enqueue sync ops.
 */
function reconcileInheritCompletionState<T extends Task>(
  tasks: T[],
): {
  tasks: T[]
  corrections: { id: number; status: TaskStatus }[]
} {
  const corrections: { id: number; status: TaskStatus }[] = []
  let updated = tasks
  let changed = true

  while (changed) {
    changed = false
    const parents = updated.filter((t) => t.inheritCompletionState)
    for (const parent of parents) {
      const children = getDirectSubtasks(updated, parent.id)
      if (children.length === 0) continue

      const allChildrenCompleted = children.every(
        (c) => c.status === TaskStatus.COMPLETED,
      )

      if (allChildrenCompleted && parent.status !== TaskStatus.COMPLETED) {
        const latestCompletedAt = getChildrenLatestCompletedAt(children)

        updated = updateItem(updated, parent.id, (t) => ({
          ...t,
          status: TaskStatus.COMPLETED,
          completedAt: latestCompletedAt ?? new Date(),
          inProgressStartedAt: null,
        }))

        corrections.push({ id: parent.id, status: TaskStatus.COMPLETED })
        changed = true
      } else if (
        !allChildrenCompleted &&
        parent.status === TaskStatus.COMPLETED
      ) {
        updated = updateItem(updated, parent.id, (t) => ({
          ...t,
          status: TaskStatus.OPEN,
          completedAt: null,
          inProgressStartedAt: null,
        }))
        corrections.push({ id: parent.id, status: TaskStatus.OPEN })
        changed = true
      }
    }
  }

  return { tasks: updated, corrections }
}

/**
 * Topologically orders a set of tasks so that any task with a parent in the
 * same recoverable set appears after that parent. Only traverses to parents
 * that are themselves in `recoverableIds` — never to parents that already
 * have a queued CREATE op (those resolve via the queue's own idMap at flush
 * time). Used when re-enqueuing orphaned negative-id creates.
 */
function topoSortForRecovery<T extends Task>(
  orphaned: T[],
  taskById: Map<number, T>,
  recoverableIds: Set<number>,
): T[] {
  const sorted: T[] = []
  const visited = new Set<number>()
  const visit = (t: T) => {
    if (visited.has(t.id)) return
    visited.add(t.id)
    if (
      t.parentId != null &&
      t.parentId < 0 &&
      recoverableIds.has(t.parentId)
    ) {
      const parent = taskById.get(t.parentId)
      if (parent) visit(parent)
    }
    sorted.push(t)
  }
  for (const t of orphaned) visit(t)
  return sorted
}

/**
 * Tasks state — the pieces that change whenever the task list mutates.
 * Consumers of `useTasks()` re-render on every task change. Use this only
 * from components that actually render task data.
 *
 * NOTE: `isInitialized` lives on the mutations context instead of here so
 * consumers that only need the init flag (e.g. `SyncProvider`) don't
 * subscribe to the task array.
 */
interface TasksContextValue {
  tasks: LocalTask[]
  hasDemoData: boolean
}

/**
 * Task mutations + server bridge — stable values whose identity changes at
 * most once (when `isInitialized` flips false→true at boot). Consumers of
 * `useTaskMutations()` do NOT re-render on task list changes, so click
 * handlers / dialog submitters / list-item buttons / the sync orchestrator
 * can subscribe here without paying the re-render cost of `useTasks()`.
 */
interface TaskMutationsContextValue {
  isInitialized: boolean
  // Task mutations
  createTask: (data: CreateTaskContent) => LocalTask
  updateTask: (id: number, updates: UpdateTaskContent) => LocalTask
  setTaskStatus: (id: number, status: TaskStatus) => LocalTask
  deleteTask: (id: number) => void
  reorderSubtasks: (parentId: number, orderedIds: number[]) => void
  deleteDemoData: () => void
  subscribeToIdReplacement: (
    cb: (tempId: number, realId: number) => void,
  ) => () => void

  // Server sync bridge (used by SyncProvider). The task sync queue itself
  // lives in TaskSyncQueueProvider — these are the tasks-side bridge methods.
  replaceTaskId: (tempId: number, realId: number) => void
  setTasksFromServer: (tasks: Task[]) => void
}

const TasksContext = createContext<TasksContextValue | null>(null)
const TaskMutationsContext = createContext<TaskMutationsContextValue | null>(
  null,
)

// TODO: we haven't stored with subtasks in a while, I think we can remove the flattening.
const loadTasksFromStorage = (key: string): LocalTask[] => {
  type TasksInStorage = (Task & {
    subtasks?: Task[]
    clientKey?: string
  })[]
  try {
    const parsed = storage.get<TasksInStorage>(key, [])
    const flatten = (tasks: TasksInStorage): LocalTask[] => {
      const result: LocalTask[] = []
      for (const t of tasks) {
        result.push({
          ...taskSchema.parse(t),
          clientKey:
            typeof t.clientKey === 'string' ? t.clientKey : crypto.randomUUID(),
        })
        if (t.subtasks?.length) {
          result.push(...flatten(t.subtasks))
        }
      }
      return result
    }
    return flatten(parsed)
  } catch {
    return []
  }
}

type TasksProviderProps = React.PropsWithChildren<{
  shouldSync: boolean
  storageMode: StorageMode
}>

export const TasksProvider = ({
  children,
  shouldSync,
  storageMode,
}: TasksProviderProps) => {
  const { settings } = useSettings()
  const { syncQueue, enqueue, enqueueMany, replaceTempIdInQueue } =
    useTaskSyncQueue()
  const [isInitialized, setIsInitialized] = useState(false)
  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [demoTaskIds, setDemoTaskIds] = useState<number[]>([])
  const nextIdRef = useRef(-1)
  const tasksRef = useRef<LocalTask[]>([])
  // Capture the initial sync queue once so the init effect can scan for
  // orphaned negative-id tasks without re-running when the queue changes.
  const initialQueueRef = useRef(syncQueue)
  const idReplacedCallbacks = useRef<
    Set<(tempId: number, realId: number) => void>
  >(new Set())

  const subscribeToIdReplacement = useCallback(
    (cb: (tempId: number, realId: number) => void) => {
      idReplacedCallbacks.current.add(cb)
      return () => {
        idReplacedCallbacks.current.delete(cb)
      }
    },
    [],
  )

  const storageKeys = useMemo(() => getStorageKeys(storageMode), [storageMode])

  const reconcileAndSetTasks = useCallback(
    (incomingTasks: LocalTask[], source: string) => {
      const { tasks: reconciled, corrections } =
        reconcileInheritCompletionState(incomingTasks)
      setTasks(reconciled)
      if (corrections.length > 0) {
        debugLog.log('reconcile', `inheritCompletionState:${source}`, {
          corrections,
        })
        enqueueMany(
          corrections.map(
            (c) =>
              ({
                type: SyncOperationType.UPDATE_TASK,
                id: c.id,
                data: { status: c.status },
              }) as const,
          ),
        )
      }
    },
    [enqueueMany],
  )

  useEffect(() => {
    const loadedTasks: LocalTask[] = loadTasksFromStorage(storageKeys.tasks)
    const loadedNextId: number = storage.get<number>(storageKeys.nextId, -1)
    const loadedDemoIds: number[] = storage.get<number[]>(
      storageKeys.demoTaskIds,
      [],
    )

    nextIdRef.current = loadedNextId
    setDemoTaskIds(loadedDemoIds)

    // Recovery: any persisted task with a negative id is an unsynced create
    // (drafts are never persisted). If its CREATE_TASK op is missing from the
    // queue (e.g. dropped by a previous version of the sync code), re-enqueue
    // it so the server assigns a real id. Enqueue parents before children so
    // the in-flight idMap can resolve parentId references in order.
    if (shouldSync && loadedTasks.length > 0) {
      const loadedQueue = initialQueueRef.current
      const queuedTempIds = new Set(
        loadedQueue
          .filter((op) => op.type === SyncOperationType.CREATE_TASK)
          .map((op) => (op as { tempId: number }).tempId),
      )
      const taskById = mapById(loadedTasks)
      const orphaned: LocalTask[] = loadedTasks.filter(
        (t) =>
          t.id < 0 &&
          !queuedTempIds.has(t.id) &&
          // "Parent exists" means either no parent, parent is a real task, or
          // parent is another negative-id task we'll also be re-enqueuing.
          !(t.parentId != null && !taskById.has(t.parentId)),
      )
      if (orphaned.length > 0) {
        const recoverableIds = new Set(orphaned.map((t) => t.id))
        const sorted = topoSortForRecovery(orphaned, taskById, recoverableIds)

        const recoveryOps: SyncOperation[] = sorted.map((t) => ({
          type: SyncOperationType.CREATE_TASK,
          tempId: t.id,
          data: omit(t, ['id', 'userId', 'clientKey']),
        }))
        enqueueMany(recoveryOps)
        debugLog.log('sync', 'recoverOrphanedTasks', {
          count: recoveryOps.length,
          tempIds: sorted.map((t) => t.id),
        })
      }
    }

    if (loadedTasks.length === 0) {
      const demoTasks = createDemoTasks(nextIdRef)
      storage.set(storageKeys.nextId, nextIdRef.current)
      storage.remove(getStorageKeys(storageMode).expanded)
      setDemoTaskIds(demoTasks.map((t) => t.id))
      setTasks(withClientKeys(demoTasks))
    } else {
      reconcileAndSetTasks(loadedTasks, 'init')
    }

    setIsInitialized(true)
  }, [storageKeys, storageMode, reconcileAndSetTasks, shouldSync, enqueueMany])

  useEffect(() => {
    if (isInitialized) {
      storage.set(storageKeys.tasks, tasks)
    }
  }, [tasks, isInitialized, storageKeys])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  // Helper to update a task by ID
  const updateTaskById = useCallback(
    (
      id: number,
      updateThisTask: (task: LocalTask) => Partial<Task>,
      updateOtherTasks?: (task: LocalTask) => Partial<Task>,
    ): LocalTask | undefined => {
      let updatedTask: LocalTask | undefined
      setTasks((prev) =>
        prev.map((task): LocalTask => {
          if (task.id === id) {
            updatedTask = { ...task, ...updateThisTask(task) }
            return updatedTask
          }
          if (updateOtherTasks) {
            const otherUpdates = updateOtherTasks(task)
            return { ...task, ...otherUpdates }
          }
          return task
        }),
      )
      return updatedTask
    },
    [],
  )

  const replaceTaskId = useCallback(
    (tempId: number, realId: number) => {
      setTasks((prev) =>
        prev.map(
          (t): LocalTask => ({
            ...(t.id === tempId ? { ...t, id: realId } : t),
            parentId: t.parentId === tempId ? realId : t.parentId,
            subtaskOrder: t.subtaskOrder.map((sid) =>
              sid === tempId ? realId : sid,
            ),
          }),
        ),
      )
      replaceTempIdInQueue(tempId, realId)
      idReplacedCallbacks.current.forEach((cb) => {
        cb(tempId, realId)
      })
    },
    [replaceTempIdInQueue],
  )

  const createTask = useCallback(
    (data: CreateTaskContent): LocalTask => {
      const tempId = nextIdRef.current--
      storage.set(storageKeys.nextId, nextIdRef.current)

      const newStatus = (() => {
        if (data.status && data.status !== TaskStatus.OPEN) return data.status
        const pinNew = settings.autoPinNewTasks && !data.parentId
        return pinNew ? TaskStatus.PINNED : TaskStatus.OPEN
      })()

      const newTask = buildLocalTask({ ...data, id: tempId, status: newStatus })

      setTasks((prev) => {
        let updated = [...prev, newTask]
        if (data.parentId) {
          updated = updated.map((t) => {
            if (t.id !== data.parentId) return t
            const changes: Partial<Task> = {}
            if (t.subtaskSortMode === SubtaskSortMode.MANUAL) {
              changes.subtaskOrder = [...t.subtaskOrder, tempId]
            }
            if (
              t.inheritCompletionState &&
              t.status === TaskStatus.COMPLETED &&
              newTask.status !== TaskStatus.COMPLETED
            ) {
              changes.status = TaskStatus.OPEN
              changes.completedAt = null
              changes.inProgressStartedAt = null
            }
            return { ...t, ...changes }
          })
        }
        return updated
      })
      enqueue({
        type: SyncOperationType.CREATE_TASK,
        tempId,
        data: { ...omit(data, ['clientKey']), status: newStatus },
      })
      debugLog.log('task', 'create', {
        tempId,
        name: data.name,
        parentId: data.parentId,
      })

      return newTask
    },
    [settings.autoPinNewTasks, enqueue, storageKeys],
  )

  const updateTask = useCallback(
    (id: number, updates: UpdateTaskContent): LocalTask => {
      const updatedTask = updateTaskById(id, () => updates)
      enqueue({ type: SyncOperationType.UPDATE_TASK, id, data: updates })
      debugLog.log('task', 'update', { id, updates })

      if (
        updates.inheritCompletionState &&
        updatedTask &&
        updatedTask.status !== TaskStatus.COMPLETED
      ) {
        // Forward: flag just enabled and all subtasks are already done — auto-complete immediately
        const subtasks = getDirectSubtasks(tasksRef.current, id)
        if (
          subtasks.length > 0 &&
          subtasks.every((t) => t.status === TaskStatus.COMPLETED)
        ) {
          const latestCompletedAt = getChildrenLatestCompletedAt(subtasks)
          updateTaskById(id, () => ({
            status: TaskStatus.COMPLETED,
            completedAt: latestCompletedAt ?? new Date(),
            inProgressStartedAt: null,
          }))
          enqueue({
            type: SyncOperationType.UPDATE_TASK,
            id,
            data: { status: TaskStatus.COMPLETED },
          })
          debugLog.log('task', 'inheritCompletion:onUpdate', { id })

          // Propagate to grandparent(s) — same walk as setTaskStatus's upward chain.
          // Patch the just-auto-completed task into the snapshot so ancestors see it.
          if (updatedTask.parentId) {
            let snapshot = tasksRef.current.map((t) =>
              t.id === id
                ? {
                    ...t,
                    ...updates,
                    status: TaskStatus.COMPLETED,
                    completedAt: latestCompletedAt ?? new Date(),
                    inProgressStartedAt: null,
                  }
                : t,
            )
            const autoCompletedParents: number[] = []
            let currentParentId: number | null = updatedTask.parentId

            while (currentParentId !== null) {
              const parent: LocalTask | undefined = getById(
                snapshot,
                currentParentId,
              )
              if (
                !parent?.inheritCompletionState ||
                parent.status === TaskStatus.COMPLETED
              )
                break
              const thisChildren = getDirectSubtasks(snapshot, parent.id)
              if (!thisChildren.every((t) => t.status === TaskStatus.COMPLETED))
                break
              const parentLatestCompletedAt =
                getChildrenLatestCompletedAt(thisChildren)
              snapshot = updateItem(snapshot, parent.id, (t) => ({
                ...t,
                status: TaskStatus.COMPLETED,
                completedAt: parentLatestCompletedAt ?? new Date(),
                inProgressStartedAt: null,
              }))
              autoCompletedParents.push(parent.id)
              currentParentId = parent.parentId
            }

            if (autoCompletedParents.length > 0) {
              setTasks((prev) => {
                let current = prev
                for (const parentId of autoCompletedParents) {
                  const thisChildren = getDirectSubtasks(current, parentId)
                  const parentLatestCompletedAt =
                    getChildrenLatestCompletedAt(thisChildren)
                  current = updateItem(current, parentId, (t) => ({
                    ...t,
                    status: TaskStatus.COMPLETED,
                    completedAt: parentLatestCompletedAt ?? new Date(),
                    inProgressStartedAt: null,
                  }))
                }
                return current
              })
              for (const parentId of autoCompletedParents) {
                enqueue({
                  type: SyncOperationType.UPDATE_TASK,
                  id: parentId,
                  data: { status: TaskStatus.COMPLETED },
                })
                debugLog.log('task', 'inheritCompletion', { parentId })
              }
            }
          }
        }
      }

      if (updates.parentId != null && updatedTask) {
        const parent = getById(tasksRef.current, updates.parentId)
        if (
          parent?.inheritCompletionState &&
          parent.status === TaskStatus.COMPLETED &&
          updatedTask.status !== TaskStatus.COMPLETED
        ) {
          updateTaskById(parent.id, () => ({
            status: TaskStatus.OPEN,
            completedAt: null,
            inProgressStartedAt: null,
          }))
        }
      }

      // biome-ignore lint/style/noNonNullAssertion: from Replit. Maybe we should investigate? Throw an error if not defined?
      return updatedTask!
    },
    [enqueue, updateTaskById],
  )

  const setTaskStatus = useCallback(
    (id: number, status: TaskStatus): LocalTask => {
      if (status === TaskStatus.COMPLETED) {
        const hasIncompleteSubtasks = getHasIncompleteSubtasks(
          tasksRef.current,
          id,
        )
        if (hasIncompleteSubtasks) {
          toast({
            title: 'Cannot complete task',
            description: ERRORS.INCOMPLETE_SUBTASKS.message,
            variant: 'destructive',
          })
          const existing = getById(tasksRef.current, id)
          if (existing) return existing
        }
      }

      const updatedTask = updateTaskById(
        id,
        () => statusToStatusPatch(status),
        // Clear IN_PROGRESS status from other tasks when setting a new task to IN_PROGRESS
        status === TaskStatus.IN_PROGRESS
          ? (t) =>
              t.status === TaskStatus.IN_PROGRESS
                ? {
                    status: TaskStatus.PINNED,
                    inProgressStartedAt: null,
                  }
                : {}
          : undefined,
      )

      enqueue({ type: SyncOperationType.UPDATE_TASK, id, data: { status } })
      debugLog.log('task', 'setStatus', { id, status })

      if (status === TaskStatus.COMPLETED && updatedTask?.parentId) {
        console.log('[AC] enter setTaskStatus auto-complete', {
          id,
          parentId: updatedTask.parentId,
          tasksRefLen: tasksRef.current.length,
          tasksRefIds: tasksRef.current.map((t) => ({
            id: t.id,
            parentId: t.parentId,
            status: t.status,
            inherit: t.inheritCompletionState,
          })),
        })
        // Compute which ancestors to auto-complete synchronously. tasksRef
        // hasn't been flushed yet, so we manually patch in the just-completed
        // task before walking up.
        let snapshot = tasksRef.current.map((t) =>
          t.id === id ? { ...t, ...statusToStatusPatch(status) } : t,
        )
        const autoCompletedParents: number[] = []
        let currentParentId: number | null = updatedTask.parentId

        while (currentParentId !== null) {
          const parent: LocalTask | undefined = getById(
            snapshot,
            currentParentId,
          )
          console.log('[AC] walk', {
            currentParentId,
            parent: parent && {
              id: parent.id,
              status: parent.status,
              inherit: parent.inheritCompletionState,
            },
          })
          if (
            !parent?.inheritCompletionState ||
            parent.status === TaskStatus.COMPLETED
          )
            break

          const thisChildren = getDirectSubtasks(snapshot, parent.id)
          console.log('[AC] children', {
            parentId: parent.id,
            children: thisChildren.map((c) => ({
              id: c.id,
              status: c.status,
            })),
          })
          if (!thisChildren.every((t) => t.status === TaskStatus.COMPLETED))
            break

          const latestCompletedAt = getChildrenLatestCompletedAt(thisChildren)
          snapshot = updateItem(snapshot, parent.id, (t) => ({
            ...t,
            status: TaskStatus.COMPLETED,
            completedAt: latestCompletedAt ?? new Date(),
            inProgressStartedAt: null,
          }))
          autoCompletedParents.push(parent.id)
          currentParentId = parent.parentId
        }

        if (autoCompletedParents.length > 0) {
          setTasks((prev) => {
            let updated = prev
            for (const parentId of autoCompletedParents) {
              const thisChildren = getDirectSubtasks(updated, parentId)
              const latestCompletedAt =
                getChildrenLatestCompletedAt(thisChildren)
              updated = updateItem(updated, parentId, (t) => ({
                ...t,
                status: TaskStatus.COMPLETED,
                completedAt: latestCompletedAt ?? new Date(),
                inProgressStartedAt: null,
              }))
            }
            return updated
          })

          for (const parentId of autoCompletedParents) {
            enqueue({
              type: SyncOperationType.UPDATE_TASK,
              id: parentId,
              data: { status: TaskStatus.COMPLETED },
            })
            debugLog.log('task', 'inheritCompletion', { parentId })
          }
        }
      }

      if (status !== TaskStatus.COMPLETED && updatedTask?.parentId) {
        const autoRevertedParents: number[] = []

        setTasks((prev) => {
          let updated = prev
          let currentParentId: number | null = updatedTask.parentId

          while (currentParentId !== null) {
            const parent = getById(updated, currentParentId)
            if (!parent?.inheritCompletionState) break
            if (parent.status !== TaskStatus.COMPLETED) break

            updated = updateItem(updated, parent.id, (t) => ({
              ...t,
              status: TaskStatus.OPEN,
              completedAt: null,
              inProgressStartedAt: null,
            }))
            autoRevertedParents.push(parent.id)

            currentParentId = parent.parentId
          }

          return updated === prev ? prev : updated
        })

        for (const parentId of autoRevertedParents) {
          enqueue({
            type: SyncOperationType.UPDATE_TASK,
            id: parentId,
            data: { status: TaskStatus.OPEN },
          })
          debugLog.log('task', 'inheritCompletion:revert', { parentId })
        }
      }

      // biome-ignore lint/style/noNonNullAssertion: from Replit. Maybe we should investigate? Throw an error if not defined?
      return updatedTask!
    },
    [enqueue, updateTaskById],
  )

  const deleteTask = useCallback(
    (id: number) => {
      setTasks((prev) => {
        const taskToDelete = getById(prev, id)
        if (!taskToDelete) return prev

        const idsToDelete = collectDescendantIds(prev, [id], {
          includeRoots: true,
        })

        let totalTime = 0
        for (const t of prev) {
          if (idsToDelete.has(t.id)) totalTime += t.timeSpent
        }

        let updated = removeIds(prev, idsToDelete)

        if (taskToDelete.parentId) {
          updated = updateItem(updated, taskToDelete.parentId, (t) => ({
            ...t,
            ...(totalTime > 0
              ? { timeSpent: (t.timeSpent ?? 0) + totalTime }
              : {}),
            subtaskOrder: t.subtaskOrder.filter((sid) => !idsToDelete.has(sid)),
          }))
        }

        return updated
      })
      enqueue({ type: SyncOperationType.DELETE_TASK, id })
      debugLog.log('task', 'delete', { id })
    },
    [enqueue],
  )

  const reorderSubtasks = useCallback(
    (parentId: number, orderedIds: number[]) => {
      updateTaskById(parentId, () => ({ subtaskOrder: orderedIds }))
      enqueue({
        type: SyncOperationType.REORDER_SUBTASKS,
        parentId,
        orderedIds,
      })
      debugLog.log('task', 'reorderSubtasks', { parentId, orderedIds })
    },
    [enqueue, updateTaskById],
  )

  const setTasksFromServer = useCallback(
    (serverTasks: Task[]) => {
      if (serverTasks.length === 0 && demoTaskIds.length > 0) {
        debugLog.log('sync', 'setTasksFromServer:skipped', {
          reason: 'empty server, has demo data',
        })
        return
      }
      if (serverTasks.length > 0) {
        setDemoTaskIds([])
      }

      const validIds = new Set(serverTasks.map((t) => t.id))
      const orphaned: Task[] = []
      const sanitized = serverTasks.map((t) => {
        if (t.parentId !== null && !validIds.has(t.parentId)) {
          orphaned.push(t)
          return { ...t, parentId: null }
        }
        return t
      })

      if (orphaned.length > 0) {
        debugLog.log('sync', 'setTasksFromServer:orphanedParentIds', {
          ids: orphaned.map((t) => t.id),
        })
        enqueueMany(
          orphaned.map(
            (t) =>
              ({
                type: SyncOperationType.UPDATE_TASK,
                id: t.id,
                data: { parentId: null },
              }) as const,
          ),
        )
      }

      const hydrated = withClientKeys(sanitized, clientKeyMap(tasksRef.current))
      reconcileAndSetTasks(hydrated, 'fromServer')
      nextIdRef.current = -1
      storage.set(storageKeys.nextId, -1)
      debugLog.log('sync', 'setTasksFromServer', { count: serverTasks.length })
    },
    [storageKeys, demoTaskIds, reconcileAndSetTasks, enqueueMany],
  )

  useEffect(() => {
    if (isInitialized) {
      storage.set(storageKeys.demoTaskIds, demoTaskIds)
    }
  }, [demoTaskIds, isInitialized, storageKeys])

  const deleteDemoData = useCallback(() => {
    setTasks((prev) => removeIds(prev, demoTaskIds))
    setDemoTaskIds([])
  }, [demoTaskIds])

  const hasDemoData =
    demoTaskIds.length > 0 && tasks.some((t) => demoTaskIds.includes(t.id))

  const tasksValue = useMemo<TasksContextValue>(
    () => ({ tasks, hasDemoData }),
    [tasks, hasDemoData],
  )

  const mutationsValue = useMemo<TaskMutationsContextValue>(
    () => ({
      isInitialized,
      createTask,
      updateTask,
      setTaskStatus,
      deleteTask,
      reorderSubtasks,
      deleteDemoData,
      subscribeToIdReplacement,
      replaceTaskId,
      setTasksFromServer,
    }),
    [
      isInitialized,
      createTask,
      updateTask,
      setTaskStatus,
      deleteTask,
      reorderSubtasks,
      deleteDemoData,
      subscribeToIdReplacement,
      replaceTaskId,
      setTasksFromServer,
    ],
  )

  return (
    <TaskMutationsContext.Provider value={mutationsValue}>
      <TasksContext.Provider value={tasksValue}>
        {children}
      </TasksContext.Provider>
    </TaskMutationsContext.Provider>
  )
}

export const useTasks = () => {
  const ctx = useContext(TasksContext)
  if (!ctx) throw new Error('useTasks must be used within a TasksProvider')
  return ctx
}

export const useTaskMutations = () => {
  const ctx = useContext(TaskMutationsContext)
  if (!ctx)
    throw new Error('useTaskMutations must be used within a TasksProvider')
  return ctx
}
