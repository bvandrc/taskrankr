/**
 * @fileoverview Cross-platform task mutation orchestrator.
 *
 * Owns every guard, side-effect, and cascade for task mutations so that the
 * server (`routes.ts` + `storage.ts`) and the client (`TasksProvider.tsx`)
 * share the *exact* same business logic. Each side instantiates the service
 * with an I/O adapter:
 *  - server adapter: async DB calls via `storage`
 *  - client adapter: sync reads from `tasksRef.current`, wrapped in Promises
 *
 * The service is read-only: every method returns a `ServicePlan` describing
 * the validated mutations. Callers persist them however they wish (DB write
 * vs React state update + sync queue enqueue).
 */

import type { AppError } from '../errors'
import { ERRORS } from '../errors'
import type { InsertTask, Task, UserSettings } from '../schema'
import { TaskStatus } from '../schema'
import {
  accumulatedTimeSpent,
  autoCompleteParentPatch,
  getHasIncomplete,
  REVERT_COMPLETION_PATCH,
  statusToStatusPatch,
} from '../utils/task-utils'

export type MaybePromise<T> = T | Promise<T>

/**
 * True if the timeSpent requirement is met, if required by settings.
 */
const isTimeSpentSatisfied = (
  timeSpentMs: number,
  settings: Pick<UserSettings, 'fieldConfig'>,
): boolean => !settings.fieldConfig.timeSpent.required || timeSpentMs > 0

export interface TaskServiceIO {
  getTask(id: number): MaybePromise<Task | null | undefined>
  getDirectSubtasks(parentId: number): MaybePromise<Task[]>
  /** Find any IN_PROGRESS task other than `excludeId`, or null. */
  getCurrentInProgressTask(
    excludeId: number,
  ): MaybePromise<Task | null | undefined>
  getSettings(): MaybePromise<Pick<UserSettings, 'fieldConfig'>>
}

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

export class TaskService {
  constructor(private readonly io: TaskServiceIO) {}

  /**
   * Validates and computes all mutations for an update to `id`. Returns an
   * error if a guard fails (incomplete subtasks, missing timeSpent, missing
   * task), otherwise the primary patch plus every cascade side-effect.
   */
  async planUpdate(id: number, updates: Partial<Task>): Promise<ServicePlan> {
    const buffer = new MutationBuffer()
    const result = await this.planUpdateInto(id, updates, buffer)
    if (!result.ok) return result
    return { ok: true, mutations: buffer.toArray() }
  }

  /**
   * Recursive core: writes patches into the shared `buffer` so cascade walks
   * (ancestor + descendant) all observe one coherent in-flight state.
   */
  private async planUpdateInto(
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
      const statusPatch = statusToStatusPatch(newStatus)
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
    if (
      updates.inheritCompletionState &&
      effective.status === TaskStatus.COMPLETED
    ) {
      const children = (await this.io.getDirectSubtasks(id)).map((c) =>
        buffer.overlay(c),
      )
      if (getHasIncomplete(children)) {
        buffer.add(id, REVERT_COMPLETION_PATCH)
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
        const childResult = await this.planUpdateInto(
          child.id,
          { status: newStatus },
          buffer,
        )
        if (!childResult.ok) return childResult
      }
    }

    if (newStatus === TaskStatus.COMPLETED && current.parentId !== null) {
      await this.walkAutoCompleteParent(current.parentId, id, buffer)
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
   * Validates and computes side-effects for a new task. Does not include
   * the primary insert (the caller already has the data); only returns
   * cascade patches on existing tasks (e.g. parent revert when an
   * inherit-completion parent gains a non-completed child).
   */
  async planCreate(data: CreatePayload): Promise<ServicePlan> {
    if (data.status === TaskStatus.COMPLETED) {
      const settings = await this.io.getSettings()
      if (!isTimeSpentSatisfied(data.timeSpent ?? 0, settings)) {
        return { ok: false, error: ERRORS.TIME_SPENT_REQUIRED }
      }
    }

    const buffer = new MutationBuffer()

    if (data.parentId && data.status !== TaskStatus.COMPLETED) {
      const parent = await this.io.getTask(data.parentId)
      if (
        parent?.inheritCompletionState &&
        parent.status === TaskStatus.COMPLETED
      ) {
        buffer.add(data.parentId, REVERT_COMPLETION_PATCH)
      }
    }

    return { ok: true, mutations: buffer.toArray() }
  }

  /**
   * Computes the full delete plan: every descendant id to remove plus the
   * patch on the parent (time accumulation + subtaskOrder removal).
   */
  async planDelete(id: number): Promise<ServicePlan<{ deletedIds: number[] }>> {
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
    justCompletedChildId: number,
    buffer: MutationBuffer,
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
    return result
  }
}
