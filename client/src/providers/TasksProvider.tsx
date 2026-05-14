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
import { makeTaskService } from '@/lib/task-service-adapter'
import { getById, mapById, removeIds, updateItem } from '@/lib/task-tree-utils'
import { useSettings } from '@/providers/SettingsProvider'
import {
  type SyncOperation,
  SyncOperationType,
  useTaskSyncQueue,
} from '@/providers/TaskSyncQueueProvider'
import type { LocalTask } from '@/types'
import {
  type CreateTask,
  SubtaskSortMode,
  type Task,
  TaskStatus,
  taskSchema,
  type UpdateTask,
} from '~/shared/schema'
import {
  type MutationPatch,
  TaskMutationService,
} from '~/shared/service/task-mutation-service'

export type CreateTaskContent = Omit<CreateTask, 'userId' | 'id'> & {
  /** Preserved across draft → real promotion. */
  clientKey?: string
}
export type UpdateTaskContent = Omit<UpdateTask, 'id'>
export type MutateTaskContent = CreateTaskContent | UpdateTaskContent
export type DeleteTaskArgs = Pick<Task, 'id' | 'name'>

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
  // Task mutations. All return Promises because the shared `TaskMutationService`
  // they delegate to is async (its I/O contract is `MaybePromise`); on the
  // client every adapter callback is sync, so resolution lands in the
  // current microtask in practice.
  createTask: (data: CreateTaskContent) => Promise<LocalTask>
  updateTask: (id: number, updates: UpdateTaskContent) => Promise<LocalTask>
  setTaskStatus: (id: number, status: TaskStatus) => Promise<LocalTask>
  deleteTask: (id: number) => Promise<void>
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
        TaskMutationService.reconcileInheritCompletionState(incomingTasks)
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

  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  /**
   * Stable `TaskMutationService` instance whose I/O adapter always sees the
   * freshest in-memory state.
   */
  const service = useMemo(() => makeTaskService(tasksRef, settingsRef), [])

  /**
   * Applies the service's mutations atomically and eagerly syncs `tasksRef`
   * so a follow-on mutation in the same async sequence sees the latest
   * state without waiting for React's next render.
   */
  const applyMutations = useCallback((mutations: MutationPatch[]) => {
    if (mutations.length === 0) return
    const byId = new Map(mutations.map((m) => [m.id, m.patch]))
    setTasks((prev) => {
      const next = prev.map(
        (t): LocalTask =>
          byId.has(t.id)
            ? // biome-ignore lint/style/noNonNullAssertion: presence checked above
              { ...t, ...byId.get(t.id)! }
            : t,
      )
      tasksRef.current = next
      return next
    })
  }, [])

  /**
   * Enqueues a sync op for each cascade mutation. Sends only the user-intent
   * (`status` for status-changes; the full patch otherwise) — computed
   * fields (`completedAt`, `timeSpent` flush, etc.) are re-derived by the
   * server's `TaskMutationService` so omitting them avoids stale-clock drift.
   */
  const enqueueCascadeOps = useCallback(
    (
      mutations: MutationPatch[],
      primary?: { id: number; userUpdates: Partial<Task> },
    ) => {
      for (const m of mutations) {
        if (m.id === primary?.id) {
          // Service buffered an auto-cascade on the primary id (e.g. parent
          // auto-completes when `inheritCompletionState` flips on). User-intent
          // already shipped via the primary enqueue; emit a follow-up PUT only
          // for the derived status (where the buffered status differs from
          // anything the user explicitly set).
          if (
            m.patch.status !== undefined &&
            m.patch.status !== primary.userUpdates.status
          ) {
            enqueue({
              type: SyncOperationType.UPDATE_TASK,
              id: m.id,
              data: { status: m.patch.status },
            })
          }
          continue
        }
        const data: Partial<Task> =
          m.patch.status !== undefined ? { status: m.patch.status } : m.patch
        enqueue({ type: SyncOperationType.UPDATE_TASK, id: m.id, data })
      }
    },
    [enqueue],
  )

  const createTask = useCallback(
    async (data: CreateTaskContent): Promise<LocalTask> => {
      const tempId = nextIdRef.current--
      storage.set(storageKeys.nextId, nextIdRef.current)

      const newStatus = (() => {
        if (data.status && data.status !== TaskStatus.OPEN) return data.status
        const pinNew = settings.autoPinNewTasks && !data.parentId
        return pinNew ? TaskStatus.PINNED : TaskStatus.OPEN
      })()

      const newTask = buildLocalTask({ ...data, id: tempId, status: newStatus })

      const result = await service.resolveCreate({
        ...omit(data, ['clientKey']),
        parentId: data.parentId ?? null,
        status: newStatus,
        timeSpent: data.timeSpent ?? 0,
        inProgressStartedAt: null,
        completedAt: null,
        createdAt: new Date(),
      })

      if (!result.ok) {
        toast({
          title: 'Cannot create task',
          description: result.error.message,
          variant: 'destructive',
        })
        nextIdRef.current++
        storage.set(storageKeys.nextId, nextIdRef.current)
        throw new Error(result.error.message)
      }

      const cascadeById = new Map(result.mutations.map((m) => [m.id, m.patch]))
      setTasks((prev) => {
        let next: LocalTask[] = [...prev, newTask]
        if (data.parentId) {
          next = next.map((t): LocalTask => {
            if (t.id !== data.parentId) return t
            const changes: Partial<Task> = {}
            if (t.subtaskSortMode === SubtaskSortMode.MANUAL) {
              changes.subtaskOrder = [...t.subtaskOrder, tempId]
            }
            const cascade = cascadeById.get(t.id)
            if (cascade) Object.assign(changes, cascade)
            return { ...t, ...changes }
          })
        }
        for (const [id, patch] of cascadeById) {
          if (id === data.parentId) continue
          next = updateItem(next, id, (t) => ({ ...t, ...patch }))
        }
        tasksRef.current = next
        return next
      })

      enqueue({
        type: SyncOperationType.CREATE_TASK,
        tempId,
        data: { ...omit(data, ['clientKey']), status: newStatus },
      })
      enqueueCascadeOps(result.mutations)
      debugLog.log('task', 'create', {
        tempId,
        name: data.name,
        parentId: data.parentId,
      })

      return newTask
    },
    [
      settings.autoPinNewTasks,
      enqueue,
      enqueueCascadeOps,
      service,
      storageKeys,
    ],
  )

  const runUpdate = useCallback(
    async (
      id: number,
      updates: Partial<Task>,
      enqueuePrimary: Partial<Task>,
      errorTitle: string,
    ): Promise<LocalTask> => {
      const result = await service.resolveUpdate(id, updates)

      if (!result.ok) {
        toast({
          title: errorTitle,
          description: result.error.message,
          variant: 'destructive',
        })
        // Throw (not return-fallback) so awaiting callers can keep dialogs
        // open / abort follow-on work. Mirrors `createTask`.
        throw new Error(result.error.message)
      }

      applyMutations(result.mutations)
      enqueue({
        type: SyncOperationType.UPDATE_TASK,
        id,
        data: enqueuePrimary,
      })
      enqueueCascadeOps(result.mutations, { id, userUpdates: enqueuePrimary })

      // `applyMutations` already wrote to `tasksRef`, so the looked-up task
      // already reflects the primary patch.
      // biome-ignore lint/style/noNonNullAssertion: resolveUpdate succeeded ⇒ id exists
      return getById(tasksRef.current, id)!
    },
    [applyMutations, enqueue, enqueueCascadeOps, service],
  )

  const updateTask = useCallback(
    (id: number, updates: UpdateTaskContent) => {
      debugLog.log('task', 'update', { id, updates })
      return runUpdate(id, updates, updates, 'Cannot update task')
    },
    [runUpdate],
  )

  const setTaskStatus = useCallback(
    (id: number, status: TaskStatus) => {
      debugLog.log('task', 'setStatus', { id, status })
      return runUpdate(id, { status }, { status }, 'Cannot complete task')
    },
    [runUpdate],
  )

  const deleteTask = useCallback(
    async (id: number) => {
      const result = await service.resolveDelete(id)
      if (!result.ok) return
      const deleted = new Set(result.deletedIds)
      const cascadeById = new Map(result.mutations.map((m) => [m.id, m.patch]))
      setTasks((prev) => {
        const next = removeIds(prev, deleted).map(
          (t): LocalTask =>
            cascadeById.has(t.id)
              ? // biome-ignore lint/style/noNonNullAssertion: presence checked above
                { ...t, ...cascadeById.get(t.id)! }
              : t,
        )
        tasksRef.current = next
        return next
      })
      enqueue({ type: SyncOperationType.DELETE_TASK, id })
      debugLog.log('task', 'delete', { id })
    },
    [enqueue, service],
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
