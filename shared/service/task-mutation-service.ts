/**
 * @fileoverview Validates rules and computes side-effects for task mutations.
 *
 * `TaskMutationService` is the single source of truth for every business rule,
 * guard, and cascade triggered by create/update/delete. Server (`routes.ts`)
 * and client (`TasksProvider.tsx`) each instantiate it with an I/O adapter so
 * they share identical logic:
 *  - server adapter: async DB calls via `storage`
 *  - client adapter: sync reads from `tasksRef.current`, wrapped in Promises
 *
 * Every public method returns a `ServicePlan` — the validated set of patches
 * to apply. Callers persist them however they wish (DB write vs React state
 * update + sync queue enqueue). The service itself never writes.
 */

import { type AppError, ERRORS } from '../constants'
import type { InsertTask, Task, UserSettings } from '../schema'
import { TaskStatus } from '../schema'
import { getHasIncomplete } from '../utils/task-utils'

const getChildrenLatestCompletedAt = (children: Task[]): Date | null =>
  children.reduce<Date | null>((latest, c) => {
    const completedAt = c.completedAt ? new Date(c.completedAt) : null
    if (!completedAt) return latest
    if (!latest) return completedAt
    return completedAt > latest ? completedAt : latest
  }, null)

/**
 * Patch to auto-complete a parent with `inheritCompletionState` enabled, or
 * null if any child is still incomplete. `completedAt` reflects the latest
 * child completion so the parent inherits its meaningful "done" timestamp.
 *
 * Pass `treatAsCompleted` to count a specific child id as completed regardless
 * of its current status — useful when computing from a snapshot taken before
 * the child's write commits.
 */
const autoCompleteParentPatch = (
  children: Task[],
  options: { treatAsCompleted?: number } = {},
): Partial<Task> | null => {
  const allComplete = children.every(
    (c) =>
      c.id === options.treatAsCompleted || c.status === TaskStatus.COMPLETED,
  )
  if (!allComplete) return null
  return {
    status: TaskStatus.COMPLETED,
    completedAt: getChildrenLatestCompletedAt(children) ?? new Date(),
    inProgressStartedAt: null,
  }
}

const isTimeSpentSatisfied = (
  timeSpentMs: number,
  settings: Pick<UserSettings, 'fieldConfig'>,
): boolean => !settings.fieldConfig.timeSpent.required || timeSpentMs > 0

/** Stored timeSpent plus any active IN_PROGRESS session up to `now` (ms epoch). */
const accumulatedTimeSpent = (
  task: Pick<Task, 'timeSpent' | 'inProgressStartedAt'>,
  now: number,
): number =>
  task.timeSpent +
  (task.inProgressStartedAt ? now - task.inProgressStartedAt.getTime() : 0)

/** Reverts a task to OPEN and clears all status-related timestamps. */
const REVERT_COMPLETION_PATCH = {
  status: TaskStatus.OPEN,
  completedAt: null,
  inProgressStartedAt: null,
} as const satisfies Partial<Task>

export type MaybePromise<T> = T | Promise<T>

export interface MutationPatch {
  id: number
  patch: Partial<Task>
}

export type ServicePlan<T = void> =
  | { ok: false; error: AppError }
  | (T extends void
      ? { ok: true; mutations: MutationPatch[] }
      : { ok: true; mutations: MutationPatch[] } & T)

export type CreatePayload = Omit<InsertTask, 'userId' | 'id'>

/**
 * Buffers patches accumulated during a single planning pass and lets cascade
 * walks read tasks "as if" the buffered patches had been applied — without
 * requiring the I/O adapter to commit between steps.
 */
class MutationBuffer {
  private readonly patches = new Map<number, Partial<Task>>()

  add(id: number, patch: Partial<Task>): void {
    const existing = this.patches.get(id)
    this.patches.set(id, existing ? { ...existing, ...patch } : { ...patch })
  }

  /** Returns `task` overlaid with any buffered patch for it. */
  overlay<T extends Pick<Task, 'id'>>(task: T): T {
    const patch = this.patches.get(task.id)
    return patch ? { ...task, ...patch } : task
  }

  toArray(): MutationPatch[] {
    return Array.from(this.patches, ([id, patch]) => ({ id, patch }))
  }
}

export class TaskMutationService {
  constructor(
    private readonly io: {
      getTask(id: number): MaybePromise<Task | null | undefined>
      getDirectSubtasks(parentId: number): MaybePromise<Task[]>
      /** Find any IN_PROGRESS task other than `excludeId`, or null. */
      getCurrentInProgressTask(
        excludeId: number,
      ): MaybePromise<Task | null | undefined>
      getSettings(): MaybePromise<Pick<UserSettings, 'fieldConfig'>>
    },
  ) {}

  /**
   * Fixes up `inheritCompletionState` parents to a fixed point — auto-completing
   * when all children are done, reverting when any child is not. Returns the
   * status corrections so callers can enqueue sync ops.
   */
  static reconcileInheritCompletionState<T extends Task>(
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
      for (const parent of updated) {
        if (!parent.inheritCompletionState) continue
        const children = updated.filter((t) => t.parentId === parent.id)
        if (children.length === 0) continue

        const completePatch = autoCompleteParentPatch(children)
        if (completePatch && parent.status !== TaskStatus.COMPLETED) {
          updated = updated.map((t) =>
            t.id === parent.id ? { ...t, ...completePatch } : t,
          )
          corrections.push({ id: parent.id, status: TaskStatus.COMPLETED })
          changed = true
        } else if (!completePatch && parent.status === TaskStatus.COMPLETED) {
          updated = updated.map((t) =>
            t.id === parent.id ? { ...t, ...REVERT_COMPLETION_PATCH } : t,
          )
          corrections.push({ id: parent.id, status: TaskStatus.OPEN })
          changed = true
        }
      }
    }

    return { tasks: updated, corrections }
  }

  /**
   * Validates update rules (incomplete subtasks, timeSpent) and computes all
   * side-effects: status timestamps, IN_PROGRESS demotion, completion cascades
   * to children and ancestors, and parent revert on re-parent.
   */
  async resolveUpdate(
    id: number,
    updates: Partial<Task>,
  ): Promise<ServicePlan> {
    const buffer = new MutationBuffer()
    const result = await this.resolveUpdateInto(id, updates, buffer)
    if (!result.ok) return result
    return { ok: true, mutations: buffer.toArray() }
  }

  /** Recursive core used by `resolveUpdate`; shares a buffer so all cascade steps observe one coherent in-flight state. */
  private async resolveUpdateInto(
    id: number,
    updates: Partial<Task>,
    buffer: MutationBuffer,
  ): Promise<{ ok: true } | { ok: false; error: AppError }> {
    const current = await this.io.getTask(id)
    if (!current) return { ok: false, error: ERRORS.TASK_NOT_FOUND }

    const now = Date.now()
    const newStatus = updates.status
    const isStatusChange =
      newStatus !== undefined && newStatus !== current.status

    if (newStatus === TaskStatus.COMPLETED && isStatusChange) {
      const subtasks = await this.io.getDirectSubtasks(id)
      if (getHasIncomplete(subtasks.map((s) => buffer.overlay(s)))) {
        return { ok: false, error: ERRORS.INCOMPLETE_SUBTASKS }
      }
      const settings = await this.io.getSettings()
      const effective = { ...current, ...updates }
      if (
        !isTimeSpentSatisfied(accumulatedTimeSpent(effective, now), settings)
      ) {
        return { ok: false, error: ERRORS.TIME_SPENT_REQUIRED }
      }
    }

    const primary: Partial<Task> = { ...updates }
    if (primary.parentId === null) primary.hidden = false

    if (newStatus !== undefined && isStatusChange) {
      const isCompleting = newStatus === TaskStatus.COMPLETED
      const isStarting = newStatus === TaskStatus.IN_PROGRESS
      const statusPatch: Partial<Task> = {
        status: newStatus,
        inProgressStartedAt: isStarting ? new Date() : null,
        completedAt: isCompleting ? new Date() : null,
      }
      if (
        current.status === TaskStatus.IN_PROGRESS &&
        newStatus !== TaskStatus.IN_PROGRESS &&
        current.inProgressStartedAt
      ) {
        Object.assign(primary, {
          ...statusPatch,
          timeSpent: accumulatedTimeSpent(current, now),
        })
      } else {
        Object.assign(primary, statusPatch)
      }
    }
    buffer.add(id, primary)

    if (newStatus === TaskStatus.IN_PROGRESS) {
      const otherInProgress = await this.io.getCurrentInProgressTask(id)
      if (otherInProgress) {
        buffer.add(otherInProgress.id, {
          status: TaskStatus.PINNED,
          timeSpent: accumulatedTimeSpent(otherInProgress, now),
          inProgressStartedAt: null,
        })
      }
    }

    const effective = buffer.overlay(current)
    if (updates.inheritCompletionState) {
      if (effective.status === TaskStatus.COMPLETED) {
        const children = (await this.io.getDirectSubtasks(id)).map((c) =>
          buffer.overlay(c),
        )
        if (getHasIncomplete(children)) {
          buffer.add(id, REVERT_COMPLETION_PATCH)
        }
      } else {
        // Flag flipped on while not yet COMPLETED: auto-complete this task
        // (and walk up) if all children are already done. Skip leaves —
        // an empty children list would otherwise vacuously "complete" the
        // task, matching `reconcileInheritCompletionState`'s skip rule.
        const children = await this.io.getDirectSubtasks(id)
        if (children.length > 0) {
          await this.walkAutoCompleteParent(id, buffer)
        }
      }
    }

    if (
      updates.parentId != null &&
      buffer.overlay(current).status !== TaskStatus.COMPLETED
    ) {
      const newParentRaw = await this.io.getTask(updates.parentId)
      const newParent = newParentRaw ? buffer.overlay(newParentRaw) : undefined
      if (
        newParent?.inheritCompletionState &&
        newParent.status === TaskStatus.COMPLETED
      ) {
        buffer.add(updates.parentId, REVERT_COMPLETION_PATCH)
      }
    }

    if (
      isStatusChange &&
      (newStatus === TaskStatus.COMPLETED ||
        (current.status === TaskStatus.COMPLETED &&
          newStatus === TaskStatus.OPEN))
    ) {
      const children = (await this.io.getDirectSubtasks(id)).map((c) =>
        buffer.overlay(c),
      )
      for (const child of children) {
        if (child.status === newStatus) continue
        const childResult = await this.resolveUpdateInto(
          child.id,
          { status: newStatus },
          buffer,
        )
        if (!childResult.ok) return childResult
      }
    }

    if (newStatus === TaskStatus.COMPLETED && current.parentId !== null) {
      await this.walkAutoCompleteParent(current.parentId, buffer, id)
    }

    if (
      isStatusChange &&
      current.status === TaskStatus.COMPLETED &&
      newStatus !== TaskStatus.COMPLETED &&
      current.parentId !== null
    ) {
      await this.walkAutoRevertParent(current.parentId, buffer)
    }

    return { ok: true }
  }

  /**
   * Validates creation rules (timeSpent) and computes side-effects: IN_PROGRESS
   * demotion, parent revert, or parent auto-complete walk. Does not include the
   * primary insert — only patches to existing tasks.
   */
  async resolveCreate(data: CreatePayload): Promise<ServicePlan> {
    if (data.status === TaskStatus.COMPLETED) {
      const settings = await this.io.getSettings()
      if (!isTimeSpentSatisfied(data.timeSpent ?? 0, settings)) {
        return { ok: false, error: ERRORS.TIME_SPENT_REQUIRED }
      }
    }

    const buffer = new MutationBuffer()

    if (data.status === TaskStatus.IN_PROGRESS) {
      // Pass 0 as excludeId — no DB task has id 0, and the new task has no id yet.
      const now = Date.now()
      const otherInProgress = await this.io.getCurrentInProgressTask(0)
      if (otherInProgress) {
        buffer.add(otherInProgress.id, {
          status: TaskStatus.PINNED,
          timeSpent: accumulatedTimeSpent(otherInProgress, now),
          inProgressStartedAt: null,
        })
      }
    }

    if (data.parentId) {
      if (data.status !== TaskStatus.COMPLETED) {
        const parent = await this.io.getTask(data.parentId)
        if (
          parent?.inheritCompletionState &&
          parent.status === TaskStatus.COMPLETED
        ) {
          buffer.add(data.parentId, REVERT_COMPLETION_PATCH)
        }
      } else {
        // No justCompletedChildId: the new task isn't in the I/O layer yet,
        // so getDirectSubtasks won't include it — equivalent to completed.
        await this.walkAutoCompleteParent(data.parentId, buffer)
      }
    }

    return { ok: true, mutations: buffer.toArray() }
  }

  /**
   * Computes delete side-effects: the full descendant id set (leaves-first) and
   * the patch on the parent (time accumulation + subtaskOrder removal).
   */
  async resolveDelete(
    id: number,
  ): Promise<ServicePlan<{ deletedIds: number[] }>> {
    const target = await this.io.getTask(id)
    if (!target) return { ok: false, error: ERRORS.TASK_NOT_FOUND }

    const deletedIds = await this.collectDescendants(id)
    let totalTime = 0
    for (const did of deletedIds) {
      const t = did === id ? target : await this.io.getTask(did)
      if (t) totalTime += t.timeSpent
    }

    const buffer = new MutationBuffer()

    if (target.parentId != null) {
      const parent = await this.io.getTask(target.parentId)
      if (parent) {
        const patch: Partial<Task> = {
          subtaskOrder: parent.subtaskOrder.filter(
            (sid) => !deletedIds.includes(sid),
          ),
        }
        if (totalTime > 0) patch.timeSpent = parent.timeSpent + totalTime
        buffer.add(target.parentId, patch)
      }
    }

    return { ok: true, mutations: buffer.toArray(), deletedIds }
  }

  private async walkAutoCompleteParent(
    parentId: number,
    buffer: MutationBuffer,
    justCompletedChildId?: number,
  ): Promise<void> {
    let currentParentId: number | null = parentId
    let lastCompletedChildId = justCompletedChildId
    while (currentParentId !== null) {
      const parentRaw = await this.io.getTask(currentParentId)
      if (!parentRaw) break
      const parent = buffer.overlay(parentRaw)
      if (!parent.inheritCompletionState) break
      if (parent.status === TaskStatus.COMPLETED) break

      const siblings = (await this.io.getDirectSubtasks(parent.id)).map((s) =>
        buffer.overlay(s),
      )
      const completePatch = autoCompleteParentPatch(siblings, {
        treatAsCompleted: lastCompletedChildId,
      })
      if (!completePatch) break

      buffer.add(parent.id, completePatch)
      lastCompletedChildId = parent.id
      currentParentId = parent.parentId
    }
  }

  private async walkAutoRevertParent(
    parentId: number,
    buffer: MutationBuffer,
  ): Promise<void> {
    let currentParentId: number | null = parentId
    while (currentParentId !== null) {
      const parentRaw = await this.io.getTask(currentParentId)
      if (!parentRaw) break
      const parent = buffer.overlay(parentRaw)
      if (!parent.inheritCompletionState) break
      if (parent.status !== TaskStatus.COMPLETED) break

      buffer.add(parent.id, REVERT_COMPLETION_PATCH)
      currentParentId = parent.parentId
    }
  }

  /** Leaves-first so callers can delete by iterating without dangling-parent windows. */
  private async collectDescendants(rootId: number): Promise<number[]> {
    const result: number[] = [rootId]
    const queue: number[] = [rootId]
    while (queue.length > 0) {
      const id = queue.shift() as number
      const children = await this.io.getDirectSubtasks(id)
      for (const child of children) {
        result.push(child.id)
        queue.push(child.id)
      }
    }
    return result.reverse()
  }
}
