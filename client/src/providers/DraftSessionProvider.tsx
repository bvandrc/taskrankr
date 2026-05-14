/**
 * @fileoverview In-memory draft session for the TaskForm dialog. Lets users
 * add subtasks, reassign parents, and reorder children mid-edit and have it
 * all commit atomically on Save or vanish on Cancel.
 *
 * Three layers are parked during an open session:
 *   - `draftTasks` — new tasks with negative ids; never persisted, never
 *     enqueued for sync.
 *   - `draftAssignedParents` — real-task id → draft parent id.
 *   - `draftSubtaskOrderOverrides` — real-parent id → subtaskOrder containing
 *     draft ids, kept out of the sync queue until commit.
 *
 * `tasksWithDrafts` overlays all three on top of `TasksProvider.tasks` so
 * the dialog subtree renders the in-progress tree like normal.
 *
 * Two contexts mirror the `TasksProvider` split:
 *   - `useDraftSession()` — reactive view (`tasksWithDrafts`, `draftTaskIds`,
 *     `draftAssignmentCount`, `hasDraftSession`, `isDraftId`).
 *   - `useDraftSessionMutations()` — stable draft-aware callbacks. They read
 *     draft state through refs so consumers that only fire mutations don't
 *     re-render on keystrokes that mutate `tasksWithDrafts`.
 *
 * Draft-aware mutators route by id: drafts stay in the layers above, real
 * ids fall through to the underlying `TasksProvider` mutators. Only the
 * dialog subtree sees these; everything else uses `useTaskMutations()`
 * directly and never knows drafts exist.
 *
 * On Save, `commitDraftSession` promotes drafts in dependency order — minting
 * real ids via `createTask`, then applying reorders and parent reassignments
 * through the real (draft-unaware) `TasksProvider` mutators. On Cancel,
 * `discardDraftSession` drops all three layers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { omit } from 'es-toolkit'
import type { EmptyObject } from 'type-fest'

import { toast } from '@/hooks/useToast'
import { debugLog } from '@/lib/debug-logger'
import { buildLocalTask } from '@/lib/task-provider-utils'
import {
  collectDescendantIds,
  getById,
  getDirectSubtasks,
  removeIds,
} from '@/lib/task-tree-utils'
import { useSettings } from '@/providers/SettingsProvider'
import {
  type CreateTaskContent,
  type UpdateTaskContent,
  useTaskMutations,
  useTasks,
} from '@/providers/TasksProvider'
import type { LocalTask } from '@/types'
import { SubtaskSortMode, type Task, TaskStatus } from '~/shared/schema'
import { type MutationPatch, TaskService } from '~/shared/service/task-service'

/**
 * Returns a new Map by applying `rewrite` to each entry:
 *   - returning the same value reference keeps the entry unchanged
 *   - returning a different value replaces it
 *   - returning `null` drops the entry
 * Returns the original map reference if nothing changed, so a setState call
 * with no actual changes doesn't trigger a re-render.
 */
const rewriteMap = <K, V>(
  map: Map<K, V>,
  rewrite: (value: V, key: K) => V | null,
): Map<K, V> => {
  if (map.size === 0) return map
  let changed = false
  const next = new Map(map)
  map.forEach((value, key) => {
    const replaced = rewrite(value, key)
    if (replaced === null) {
      next.delete(key)
      changed = true
    } else if (replaced !== value) {
      next.set(key, replaced)
      changed = true
    }
  })
  return changed ? next : map
}

interface DraftSessionStateValue {
  /** `TasksProvider.tasks` merged with the in-memory draft overlay. */
  tasksWithDrafts: LocalTask[]
  draftTaskIds: Set<number>
  /** Number of real tasks reassigned to a draft parent during the session. */
  draftAssignmentCount: number
  hasDraftSession: boolean
  isDraftId: (id: number) => boolean
}

interface DraftSessionMutationsValue {
  // Draft-aware mutators: route to the draft layer if the id is a draft,
  // otherwise fall through to the real TasksProvider mutator.
  updateTask: (id: number, updates: UpdateTaskContent) => Promise<LocalTask>
  deleteTask: (id: number) => Promise<void>
  reorderSubtasks: (parentId: number, orderedIds: number[]) => void
  setTaskStatus: (id: number, status: TaskStatus) => Promise<LocalTask>

  // Session lifecycle
  createDraftTask: (data: CreateTaskContent) => LocalTask
  assignDraftSubtask: (realTaskId: number, draftParentId: number) => void
  commitDraftSession: () => Promise<void>
  discardDraftSession: () => void
}

const DraftSessionStateContext = createContext<DraftSessionStateValue | null>(
  null,
)
const DraftSessionMutationsContext =
  createContext<DraftSessionMutationsValue | null>(null)

export const DraftSessionProvider = ({
  children,
}: React.PropsWithChildren<EmptyObject>) => {
  const { tasks } = useTasks()
  const { settings } = useSettings()
  const {
    createTask,
    updateTask: realUpdateTask,
    deleteTask: realDeleteTask,
    reorderSubtasks: realReorderSubtasks,
    setTaskStatus: realSetTaskStatus,
  } = useTaskMutations()
  // Keep refs to all reactive state read inside mutator callbacks so the
  // callbacks themselves can have empty deps and stay referentially stable
  // across draft churn. Mirrors `TasksProvider`'s tasksRef pattern.
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const [draftTasks, setDraftTasks] = useState<LocalTask[]>([])
  // realTaskId -> draft parent id for the duration of the session.
  const [draftAssignedParents, setDraftAssignedParents] = useState<
    Map<number, number>
  >(new Map())
  // realParentId -> overridden subtaskOrder for the session
  const [draftSubtaskOrderOverrides, setDraftSubtaskOrderOverrides] = useState<
    Map<number, number[]>
  >(new Map())
  // Dedicated id ref for drafts so we don't burn or persist the real nextIdRef.
  // Drafts use very-negative IDs to avoid colliding with sync-pending temp ids.
  const draftIdRef = useRef(-100_000_000)

  const draftTasksRef = useRef(draftTasks)
  draftTasksRef.current = draftTasks
  const draftAssignedParentsRef = useRef(draftAssignedParents)
  draftAssignedParentsRef.current = draftAssignedParents
  const draftSubtaskOrderOverridesRef = useRef(draftSubtaskOrderOverrides)
  draftSubtaskOrderOverridesRef.current = draftSubtaskOrderOverrides

  const draftTaskIds = useMemo(
    () => new Set(draftTasks.map((t) => t.id)),
    [draftTasks],
  )
  const draftTaskIdsRef = useRef(draftTaskIds)
  draftTaskIdsRef.current = draftTaskIds
  /** Stable predicate that always reads the latest draft id set via ref. */
  const isDraftIdStable = useCallback(
    (id: number) => draftTaskIdsRef.current.has(id),
    [],
  )
  /** Reactive predicate exposed to state consumers (re-renders with set). */
  const isDraftId = useCallback(
    (id: number) => draftTaskIds.has(id),
    [draftTaskIds],
  )
  const hasDraftSession =
    draftTasks.length > 0 ||
    draftAssignedParents.size > 0 ||
    draftSubtaskOrderOverrides.size > 0

  const tasksWithDrafts = useMemo<LocalTask[]>(() => {
    if (!hasDraftSession) return tasks

    // Index draft children by real parent so we can append them when no
    // explicit override is present.
    const draftChildrenByRealParent = new Map<number, number[]>()
    for (const d of draftTasks) {
      if (d.parentId != null && d.parentId >= 0) {
        const arr = draftChildrenByRealParent.get(d.parentId) ?? []
        arr.push(d.id)
        draftChildrenByRealParent.set(d.parentId, arr)
      }
    }

    // Single pass: apply assignment + order override + draft-children append.
    const merged = tasks.map((t) => {
      const newParentId = draftAssignedParents.get(t.id)
      const orderOverride = draftSubtaskOrderOverrides.get(t.id)
      const draftChildren = draftChildrenByRealParent.get(t.id)
      const shouldAppendDrafts =
        draftChildren != null &&
        orderOverride == null &&
        t.subtaskSortMode === SubtaskSortMode.MANUAL

      if (newParentId == null && orderOverride == null && !shouldAppendDrafts) {
        return t
      }
      return {
        ...t,
        ...(newParentId != null ? { parentId: newParentId } : {}),
        ...(orderOverride
          ? { subtaskOrder: orderOverride }
          : shouldAppendDrafts
            ? { subtaskOrder: [...t.subtaskOrder, ...draftChildren] }
            : {}),
      }
    })

    return [...merged, ...draftTasks]
  }, [
    hasDraftSession,
    tasks,
    draftTasks,
    draftAssignedParents,
    draftSubtaskOrderOverrides,
  ])

  // Ref so the draft service adapter (created once) can always read the
  // freshest merged view without re-instantiating.
  const tasksWithDraftsRef = useRef(tasksWithDrafts)
  tasksWithDraftsRef.current = tasksWithDrafts

  // Draft-scoped `TaskService`: reads from the merged real+draft view so its
  // guards (INCOMPLETE_SUBTASKS, TIME_SPENT_REQUIRED) and intra-draft
  // cascades (auto-complete walk among drafts, IN_PROGRESS demotion of
  // sibling drafts) work correctly during the dialog session. Mutations
  // emitted on real tasks are dropped — see `applyDraftMutations`.
  const draftService = useMemo(
    () =>
      new TaskService({
        getTask: (id) => getById(tasksWithDraftsRef.current, id) ?? null,
        getDirectSubtasks: (parentId) =>
          getDirectSubtasks(tasksWithDraftsRef.current, parentId),
        getCurrentInProgressTask: (excludeId) =>
          tasksWithDraftsRef.current.find(
            (t) => t.status === TaskStatus.IN_PROGRESS && t.id !== excludeId,
          ) ?? null,
        getSettings: () => settingsRef.current,
      }),
    [],
  )

  /**
   * Writes the planned mutations to draft state. Returns `false` if the plan
   * touches any real task — applying just the draft-side patches would leave
   * a partial cascade (e.g. draft child marked completed but its real
   * inheritCompletionState ancestor not auto-completed). Callers fall back to
   * writing only the user-intent patch in that case. Real-task cascades
   * cannot leak out of an uncommitted dialog session by design;
   * full-fidelity replay-on-commit is an explicit follow-up.
   */
  const applyDraftMutations = useCallback(
    (mutations: MutationPatch[]): boolean => {
      const draftIds = draftTaskIdsRef.current
      const draftPatches = new Map<number, Partial<Task>>()
      for (const m of mutations) {
        if (!draftIds.has(m.id)) return false
        draftPatches.set(m.id, m.patch)
      }
      if (draftPatches.size === 0) return true
      setDraftTasks((prev) =>
        prev.map(
          (t): LocalTask =>
            draftPatches.has(t.id)
              ? // biome-ignore lint/style/noNonNullAssertion: presence checked above
                { ...t, ...draftPatches.get(t.id)! }
              : t,
        ),
      )
      return true
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Draft-layer primitives. All callbacks below have empty / stable-only deps
  // and read reactive draft state through refs, so the mutations context
  // value is stable across draft churn.
  // ---------------------------------------------------------------------------

  const createDraftTask = useCallback((data: CreateTaskContent): LocalTask => {
    const tempId = draftIdRef.current--
    const newTask = buildLocalTask({
      ...data,
      id: tempId,
      status: data.status ?? TaskStatus.OPEN,
    })

    setDraftTasks((prev) => {
      let updated = [...prev, newTask]
      if (data.parentId != null) {
        // If parent is itself a draft and MANUAL, append to its
        // subtaskOrder.
        updated = updated.map((t) => {
          if (t.id !== data.parentId) return t
          if (t.subtaskSortMode === SubtaskSortMode.MANUAL) {
            return { ...t, subtaskOrder: [...t.subtaskOrder, tempId] }
          }
          return t
        })
      }
      return updated
    })
    debugLog.log('task', 'createDraft', {
      tempId,
      name: data.name,
      parentId: data.parentId,
    })
    return newTask
  }, [])

  const updateDraftTask = useCallback(
    (id: number, updates: UpdateTaskContent): LocalTask => {
      let updated: LocalTask | undefined
      setDraftTasks((prev) =>
        prev.map((t): LocalTask => {
          if (t.id !== id) return t
          updated = { ...t, ...updates }
          return updated
        }),
      )
      // biome-ignore lint/style/noNonNullAssertion: id was verified by caller as a draft
      return updated!
    },
    [],
  )

  const deleteDraftTask = useCallback((id: number) => {
    setDraftTasks((prev) => {
      const idsToDelete = collectDescendantIds(prev, [id], {
        includeRoots: true,
      })

      // Drop any assignment overrides whose new parent is being deleted.
      setDraftAssignedParents((prevAssigned) =>
        rewriteMap(prevAssigned, (newParentId) =>
          idsToDelete.has(newParentId) ? null : newParentId,
        ),
      )

      // Drop overrides whose key (real parent) is being deleted, AND strip
      // deleted draft ids out of any remaining overrides whose key is still
      // alive (otherwise stale negative ids leak into commit and sync).
      setDraftSubtaskOrderOverrides((prevOverrides) =>
        rewriteMap(prevOverrides, (order, pid) => {
          if (idsToDelete.has(pid)) return null
          const filtered = order.filter((sid) => !idsToDelete.has(sid))
          return filtered.length !== order.length ? filtered : order
        }),
      )

      return removeIds(prev, idsToDelete).map((t) => ({
        ...t,
        subtaskOrder: t.subtaskOrder.filter((sid) => !idsToDelete.has(sid)),
      }))
    })
    debugLog.log('task', 'deleteDraft', { id })
  }, [])

  const reorderDraftSubtasks = useCallback(
    (parentId: number, orderedIds: number[]) => {
      setDraftTasks((prev) =>
        prev.map((t) =>
          t.id === parentId ? { ...t, subtaskOrder: orderedIds } : t,
        ),
      )
    },
    [],
  )

  const assignDraftSubtask = useCallback(
    (realTaskId: number, draftParentId: number) => {
      setDraftAssignedParents((prev) => {
        const next = new Map(prev)
        next.set(realTaskId, draftParentId)
        return next
      })
      // If the draft parent is MANUAL, append the assigned task to its order.
      setDraftTasks((prev) =>
        prev.map((t) => {
          if (t.id !== draftParentId) return t
          if (t.subtaskSortMode !== SubtaskSortMode.MANUAL) return t
          if (t.subtaskOrder.includes(realTaskId)) return t
          return { ...t, subtaskOrder: [...t.subtaskOrder, realTaskId] }
        }),
      )
      debugLog.log('task', 'assignDraftSubtask', {
        realTaskId,
        draftParentId,
      })
    },
    [],
  )

  const discardDraftSession = useCallback(() => {
    setDraftTasks([])
    setDraftAssignedParents(new Map())
    setDraftSubtaskOrderOverrides(new Map())
    draftIdRef.current = -100_000_000
    debugLog.log('task', 'discardDraftSession', {})
  }, [])

  // ---------------------------------------------------------------------------
  // Draft-aware mutators exposed to dialog consumers. Route to the draft
  // layer if `id` is a draft, otherwise fall through to the underlying
  // TasksProvider mutator. All callbacks read draft state via refs so they
  // remain referentially stable across draft churn.
  // ---------------------------------------------------------------------------

  /**
   * Validates `updates` for a draft target via the draft-scoped TaskService,
   * then writes the resulting plan to draft state. On guard failure (e.g.
   * INCOMPLETE_SUBTASKS, TIME_SPENT_REQUIRED), surfaces a toast and throws so
   * awaiting callers can keep dialogs open. Mirrors the real `runUpdate` in
   * `TasksProvider`.
   */
  const runDraftUpdate = useCallback(
    async (
      id: number,
      updates: UpdateTaskContent,
      errorTitle: string,
    ): Promise<LocalTask> => {
      const result = await draftService.planUpdate(id, updates)
      if (!result.ok) {
        toast({
          title: errorTitle,
          description: result.error.message,
          variant: 'destructive',
        })
        throw new Error(result.error.message)
      }
      // Apply the planned mutations atomically; fall back to writing just the
      // user-intent patch when the plan would partially cascade onto real
      // tasks (see `applyDraftMutations`). The guard check above has already
      // run, so the fallback is safe — only cascades are forfeited, not
      // validation.
      const applied = applyDraftMutations(result.mutations)
      if (!applied) updateDraftTask(id, updates)
      return getById(draftTasksRef.current, id) ?? ({ ...updates } as LocalTask)
    },
    [draftService, applyDraftMutations, updateDraftTask],
  )

  const updateTask = useCallback(
    (id: number, updates: UpdateTaskContent): Promise<LocalTask> => {
      if (isDraftIdStable(id))
        return runDraftUpdate(id, updates, 'Cannot update task')
      return realUpdateTask(id, updates)
    },
    [isDraftIdStable, runDraftUpdate, realUpdateTask],
  )

  const deleteTask = useCallback(
    async (id: number): Promise<void> => {
      if (isDraftIdStable(id)) {
        deleteDraftTask(id)
        return
      }

      // A real delete cascades to descendants. Collect the full id set from
      // the current task's snapshot so we can purge any draft assignments /
      // order overrides for the descendants too.
      const deletedIds = collectDescendantIds(tasksRef.current, [id], {
        includeRoots: true,
      })

      setDraftAssignedParents((prev) =>
        rewriteMap(prev, (newParentId, taskId) =>
          deletedIds.has(taskId) ? null : newParentId,
        ),
      )
      setDraftSubtaskOrderOverrides((prev) =>
        rewriteMap(prev, (order, pid) => {
          if (deletedIds.has(pid)) return null
          const filtered = order.filter((sid) => !deletedIds.has(sid))
          return filtered.length !== order.length ? filtered : order
        }),
      )

      await realDeleteTask(id)
    },
    [isDraftIdStable, deleteDraftTask, realDeleteTask],
  )

  const reorderSubtasks = useCallback(
    (parentId: number, orderedIds: number[]) => {
      if (isDraftIdStable(parentId)) {
        reorderDraftSubtasks(parentId, orderedIds)
        return
      }
      // Real parent: if any draft children/assignments are involved (i.e. we
      // are inside a draft session), park the new order in the override map
      // so it is not persisted/synced until commit. Otherwise, reorder
      // normally via the real mutator.
      const assigned = draftAssignedParentsRef.current
      const overrides = draftSubtaskOrderOverridesRef.current
      const drafts = draftTasksRef.current
      const inSession =
        drafts.length > 0 || assigned.size > 0 || overrides.size > 0
      if (
        inSession &&
        orderedIds.some((id) => isDraftIdStable(id) || assigned.has(id))
      ) {
        setDraftSubtaskOrderOverrides((prev) => {
          const next = new Map(prev)
          next.set(parentId, orderedIds)
          return next
        })
        debugLog.log('task', 'reorderSubtasks:draftOverride', {
          parentId,
          orderedIds,
        })
        return
      }
      realReorderSubtasks(parentId, orderedIds)
    },
    [isDraftIdStable, reorderDraftSubtasks, realReorderSubtasks],
  )

  const setTaskStatus = useCallback(
    (id: number, status: TaskStatus): Promise<LocalTask> => {
      if (isDraftIdStable(id))
        return runDraftUpdate(id, { status }, 'Cannot complete task')
      return realSetTaskStatus(id, status)
    },
    [isDraftIdStable, runDraftUpdate, realSetTaskStatus],
  )

  // ---------------------------------------------------------------------------
  // commitDraftSession: promote all in-memory drafts to real tasks.
  //
  // `draftTasks` is already in topological order by construction: a draft
  // child cannot exist until its draft parent has been created (you have to
  // navigate into the parent draft to add a subtask). We replay through
  // `createTask`, mapping draft.id -> real.id so children resolve their
  // parentId from the freshly minted real id. Reorders and assignments then
  // go through the *real* mutators from TasksProvider — which are now
  // draft-unaware after the draft split — so no re-parking into the draft
  // layer is possible.
  //
  // Reads draft state via refs so the callback stays stable across draft
  // churn (consumers of `useDraftSessionMutations` don't re-render).
  // ---------------------------------------------------------------------------
  const commitDraftSession = useCallback(async () => {
    const drafts = draftTasksRef.current
    const assignments = draftAssignedParentsRef.current
    const overrides = draftSubtaskOrderOverridesRef.current

    if (drafts.length === 0 && assignments.size === 0 && overrides.size === 0) {
      return
    }

    debugLog.log('task', 'commitDraftSession:start', {
      draftCount: drafts.length,
      assignmentCount: assignments.size,
      overrideCount: overrides.size,
    })

    const idMap = new Map<number, number>()
    const resolve = (id: number) => idMap.get(id) ?? id

    for (const draft of drafts) {
      const created = await createTask({
        ...omit(draft, ['id', 'userId']),
        parentId: draft.parentId != null ? resolve(draft.parentId) : null,
      })
      idMap.set(draft.id, created.id)
    }

    // For MANUAL draft parents whose user-defined order differs from the
    // append-order produced by sequential createTask calls, lock in the order.
    for (const draft of drafts) {
      if (draft.subtaskSortMode !== SubtaskSortMode.MANUAL) continue
      if (draft.subtaskOrder.length === 0) continue
      const realId = resolve(draft.id)
      const resolvedOrder = draft.subtaskOrder.map(resolve)
      realReorderSubtasks(realId, resolvedOrder)
    }

    // Apply assignments: real task -> resolved (draft) parent.
    for (const [realTaskId, newParentId] of assignments) {
      await realUpdateTask(realTaskId, { parentId: resolve(newParentId) })
    }

    // Apply real-parent subtaskOrder overrides (resolving any draft ids).
    for (const [realParentId, order] of overrides) {
      realReorderSubtasks(realParentId, order.map(resolve))
    }

    discardDraftSession()
    debugLog.log('task', 'commitDraftSession:complete', { mapped: idMap.size })
  }, [createTask, realUpdateTask, realReorderSubtasks, discardDraftSession])

  const stateValue = useMemo<DraftSessionStateValue>(
    () => ({
      tasksWithDrafts,
      draftTaskIds,
      draftAssignmentCount: draftAssignedParents.size,
      hasDraftSession,
      isDraftId,
    }),
    [
      tasksWithDrafts,
      draftTaskIds,
      draftAssignedParents.size,
      hasDraftSession,
      isDraftId,
    ],
  )

  const mutationsValue = useMemo<DraftSessionMutationsValue>(
    () => ({
      updateTask,
      deleteTask,
      reorderSubtasks,
      setTaskStatus,
      createDraftTask,
      assignDraftSubtask,
      commitDraftSession,
      discardDraftSession,
    }),
    [
      updateTask,
      deleteTask,
      reorderSubtasks,
      setTaskStatus,
      createDraftTask,
      assignDraftSubtask,
      commitDraftSession,
      discardDraftSession,
    ],
  )

  return (
    <DraftSessionMutationsContext.Provider value={mutationsValue}>
      <DraftSessionStateContext.Provider value={stateValue}>
        {children}
      </DraftSessionStateContext.Provider>
    </DraftSessionMutationsContext.Provider>
  )
}

export const useDraftSession = () => {
  const ctx = useContext(DraftSessionStateContext)
  if (!ctx)
    throw new Error(
      'useDraftSession must be used within a DraftSessionProvider',
    )
  return ctx
}

export const useDraftSessionMutations = () => {
  const ctx = useContext(DraftSessionMutationsContext)
  if (!ctx)
    throw new Error(
      'useDraftSessionMutations must be used within a DraftSessionProvider',
    )
  return ctx
}
