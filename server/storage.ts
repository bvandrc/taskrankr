/**
 * @fileoverview Database access layer implementing the IStorage interface.
 *
 * Provides CRUD operations for tasks and user settings using Drizzle ORM.
 * Handles task status transitions including in-progress time tracking,
 * cascading status changes to subtasks, and recursive task deletion.
 */

import { and, eq } from 'drizzle-orm'
import { without } from 'es-toolkit'

import {
  type InsertTask,
  sanitizeSettings,
  type Task,
  TaskStatus,
  tasks,
  type UpdateTask,
  type UserSettings,
  userSettings,
} from '~/shared/schema'
import {
  getHasIncomplete,
  mapById,
  statusToStatusPatch,
} from '~/shared/utils/task-utils'
import { ERRORS } from './constants'
import { db } from './db'

type UpdateTaskArg = Omit<UpdateTask, 'id'>

export interface IStorage {
  getTasks(userId: string): Promise<Task[]>
  getTask(id: number, userId: string): Promise<Task | undefined>
  getSubtasks(parentId: number, userId: string): Promise<Task[]>
  createTask(task: InsertTask): Promise<Task>
  updateTask(id: number, userId: string, updates: UpdateTaskArg): Promise<Task>
  deleteTask(id: number, userId: string): Promise<void>
  reorderSubtasks(
    parentId: number,
    userId: string,
    orderedIds: number[],
  ): Promise<void>
  getSettings(userId: string): Promise<UserSettings>
  updateSettings(
    userId: string,
    updates: Partial<UserSettings>,
  ): Promise<UserSettings>
}

export class DatabaseStorage implements IStorage {
  /**
   * Loads all tasks for `userId`, opportunistically self-healing legacy data.
   */
  async getTasks(userId: string): Promise<Task[]> {
    const result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(tasks.id)

    const byId = mapById(result)
    const fixes: (
      | { id: number; subtaskOrder: number[] }
      | { id: number; parentId: null }
    )[] = []

    for (const task of result) {
      if (task.parentId == null) continue
      const parent = byId.get(task.parentId)
      if (!parent) {
        task.parentId = null
        fixes.push({ id: task.id, parentId: null })
        continue
      }
      if (!parent.subtaskOrder.includes(task.id)) {
        parent.subtaskOrder = [...parent.subtaskOrder, task.id]
        fixes.push({ id: parent.id, subtaskOrder: parent.subtaskOrder })
      }
    }

    if (fixes.length > 0) {
      await Promise.all(
        fixes.map((fix) =>
          db
            .update(tasks)
            .set(
              'subtaskOrder' in fix
                ? { subtaskOrder: fix.subtaskOrder }
                : { parentId: fix.parentId },
            )
            .where(and(eq(tasks.id, fix.id), eq(tasks.userId, userId))),
        ),
      )
    }

    return result
  }

  async getTask(id: number, userId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    return task
  }

  async getSubtasks(parentId: number, userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.parentId, parentId), eq(tasks.userId, userId)))
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning()
    const created = task

    if (created.parentId && created.status !== TaskStatus.COMPLETED) {
      await this.revertParentIfInheritCompletionState(
        created.parentId,
        created.userId,
      )
    }

    return created
  }

  /**
   * Rolls a parent up to COMPLETED when its last incomplete child finishes, if
   * `parentId` opted into `inheritCompletionState`.
   */
  private async checkInheritCompletionState(
    parentId: number,
    userId: string,
    justCompletedChildId: number,
  ): Promise<void> {
    const parent = await this.getTask(parentId, userId)
    if (
      !parent ||
      !parent.inheritCompletionState ||
      parent.status === TaskStatus.COMPLETED
    ) {
      return
    }

    const children = await this.getSubtasks(parentId, userId)

    const allCompleted = children.every(
      (t) => t.id === justCompletedChildId || t.status === TaskStatus.COMPLETED,
    )

    if (allCompleted) {
      const completionUpdate: Partial<InsertTask> & {
        completedAt?: Date | null
      } = {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        inProgressStartedAt: null,
      }

      await db.update(tasks).set(completionUpdate).where(eq(tasks.id, parentId))

      if (parent.parentId) {
        await this.checkInheritCompletionState(
          parent.parentId,
          userId,
          parentId,
        )
      }
    }
  }

  /**
   * Counterpart to `checkInheritCompletionState`: if a previously-rolled-up
   * parent gains a non-completed child (via create or reparent), reopen it.
   */
  private async revertParentIfInheritCompletionState(
    parentId: number,
    userId: string,
  ): Promise<void> {
    const parent = await this.getTask(parentId, userId)
    if (
      !parent ||
      !parent.inheritCompletionState ||
      parent.status !== TaskStatus.COMPLETED
    ) {
      return
    }

    await db
      .update(tasks)
      .set({
        status: TaskStatus.OPEN,
        completedAt: null,
        inProgressStartedAt: null,
      })
      .where(eq(tasks.id, parentId))
  }

  async updateTask(
    id: number,
    userId: string,
    updates: UpdateTaskArg,
  ): Promise<Task> {
    const currentTask = await this.getTask(id, userId)
    if (!currentTask) {
      throw Object.assign(new Error(ERRORS.TASK_NOT_FOUND.body.message), {
        status: ERRORS.TASK_NOT_FOUND.status,
      })
    }

    const oldStatus = currentTask.status
    const newStatus = updates.status
    const isStatusChange = newStatus !== undefined && newStatus !== oldStatus

    const dbUpdates: Partial<InsertTask> & { completedAt?: Date | null } = {
      ...updates,
    }

    if (dbUpdates.parentId === null) {
      dbUpdates.hidden = false
    }

    if (isStatusChange) {
      // Apply timestamp side-effects of the transition (sets/clears
      // `inProgressStartedAt` and `completedAt`) consistently with the
      // client.
      // biome-ignore lint/style/noNonNullAssertion: isStatusChange implies newStatus is defined
      Object.assign(dbUpdates, statusToStatusPatch(newStatus!))

      if (newStatus === TaskStatus.IN_PROGRESS) {
        // Entering IN_PROGRESS: demote any existing in-progress task,
        // flushing its accumulated time into timeSpent.
        const allTasks = await this.getTasks(userId)
        const currentInProgress = allTasks.find(
          (t) => t.status === TaskStatus.IN_PROGRESS && t.id !== id,
        )
        if (currentInProgress) {
          const elapsed = currentInProgress.inProgressStartedAt
            ? Date.now() - currentInProgress.inProgressStartedAt.getTime()
            : 0
          await db
            .update(tasks)
            .set({
              status: TaskStatus.PINNED,
              timeSpent: currentInProgress.timeSpent + elapsed,
              inProgressStartedAt: null,
            })
            .where(eq(tasks.id, currentInProgress.id))
        }
      } else if (currentTask.inProgressStartedAt) {
        // Leaving IN_PROGRESS: flush accumulated time into timeSpent.
        const elapsed = Date.now() - currentTask.inProgressStartedAt.getTime()
        dbUpdates.timeSpent =
          (dbUpdates.timeSpent ?? currentTask.timeSpent) + elapsed
      }
    }

    const [task] = await db
      .update(tasks)
      .set(dbUpdates)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning()

    const updated = task

    // inheritCompletionState turned on while task is already completed:
    // revert if it still has incomplete children
    if (
      dbUpdates.inheritCompletionState &&
      updated.status === TaskStatus.COMPLETED
    ) {
      const children = await this.getSubtasks(id, userId)
      if (getHasIncomplete(children)) {
        const [reverted] = await db
          .update(tasks)
          .set({
            status: TaskStatus.OPEN,
            completedAt: null,
            inProgressStartedAt: null,
          })
          .where(eq(tasks.id, id))
          .returning()
        return reverted
      }
    }

    // Reparenting to a non-null parent: revert parent if it was auto-completed
    if (dbUpdates.parentId != null && updated.status !== TaskStatus.COMPLETED) {
      await this.revertParentIfInheritCompletionState(
        dbUpdates.parentId,
        userId,
      )
    }

    if (isStatusChange) {
      // Cascade status to children for completed/restored
      if (
        newStatus === TaskStatus.COMPLETED ||
        (oldStatus === TaskStatus.COMPLETED && newStatus === TaskStatus.OPEN)
      ) {
        const childTasks = await this.getSubtasks(id, userId)
        for (const child of childTasks) {
          await this.updateTask(child.id, userId, { status: newStatus })
        }
      }

      // Auto-complete parent if all siblings are now done
      if (newStatus === TaskStatus.COMPLETED && currentTask.parentId) {
        await this.checkInheritCompletionState(currentTask.parentId, userId, id)
      }
    }

    return updated
  }

  /** Sum of `timeSpent` across the task itself, and its full descendant subtree. */
  private async getTotalTimeForTask(
    id: number,
    userId: string,
  ): Promise<number> {
    const task = await this.getTask(id, userId)
    if (!task) return 0

    let total = task.timeSpent

    const childTasks = await this.getSubtasks(id, userId)

    for (const child of childTasks) {
      total += await this.getTotalTimeForTask(child.id, userId)
    }

    return total
  }

  /**
   * Deletes a task and its entire subtree.
   */
  async deleteTask(id: number, userId: string): Promise<void> {
    const taskToDelete = await this.getTask(id, userId)
    if (!taskToDelete) return

    if (taskToDelete.parentId) {
      const parent = await this.getTask(taskToDelete.parentId, userId)
      if (parent) {
        const timeToAccumulate = await this.getTotalTimeForTask(id, userId)
        const updates: Partial<InsertTask> = {
          subtaskOrder: without(parent.subtaskOrder, id),
        }
        if (timeToAccumulate > 0) {
          updates.timeSpent = parent.timeSpent + timeToAccumulate
        }
        await db
          .update(tasks)
          .set(updates)
          .where(
            and(eq(tasks.id, taskToDelete.parentId), eq(tasks.userId, userId)),
          )
      }
    }

    const childTasks = await this.getSubtasks(id, userId)
    for (const child of childTasks) {
      await this.deleteTaskWithoutTimeAccumulation(child.id, userId)
    }

    await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
  }

  private async deleteTaskWithoutTimeAccumulation(
    id: number,
    userId: string,
  ): Promise<void> {
    const childTasks = await this.getSubtasks(id, userId)
    for (const child of childTasks) {
      await this.deleteTaskWithoutTimeAccumulation(child.id, userId)
    }

    await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
  }

  async reorderSubtasks(
    parentId: number,
    userId: string,
    orderedIds: number[],
  ): Promise<void> {
    await db
      .update(tasks)
      .set({ subtaskOrder: orderedIds })
      .where(and(eq(tasks.id, parentId), eq(tasks.userId, userId)))
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
    if (settings) {
      return sanitizeSettings(settings)
    }
    // Create default settings for new user
    const [newSettings] = await db
      .insert(userSettings)
      .values({ userId })
      .returning()
    return newSettings
  }

  async updateSettings(
    userId: string,
    updates: Partial<UserSettings>,
  ): Promise<UserSettings> {
    // Ensure settings exist first
    await this.getSettings(userId)

    const { userId: _, ...updateData } = sanitizeSettings(updates)
    const [settings] = await db
      .update(userSettings)
      .set(updateData)
      .where(eq(userSettings.userId, userId))
      .returning()
    return sanitizeSettings(settings)
  }
}

export const storage = new DatabaseStorage()
