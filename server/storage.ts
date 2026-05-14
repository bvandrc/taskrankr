/**
 * @fileoverview Database access layer implementing the IStorage interface.
 *
 * Does not handle any business logic or side-effects; just basic CRUD and queries.
 * All logic lives in `TaskService` and is orchestrated by the route handlers.
 */

import { and, eq, ne } from 'drizzle-orm'

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
import { mapById } from '~/shared/utils/task-utils'
import { db } from './db'

type UpdateTaskArg = Omit<UpdateTask, 'id'>

const taskByIdAndUser = (id: number, userId: string) =>
  and(eq(tasks.id, id), eq(tasks.userId, userId))

export interface IStorage {
  getTasks(userId: string): Promise<Task[]>
  getTask(id: number, userId: string): Promise<Task | undefined>
  getSubtasks(parentId: number, userId: string): Promise<Task[]>
  findInProgressTask(
    userId: string,
    excludeId: number,
  ): Promise<Task | undefined>
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
            .where(taskByIdAndUser(fix.id, userId)),
        ),
      )
    }

    return result
  }

  async getTask(id: number, userId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(taskByIdAndUser(id, userId))
    return task
  }

  async getSubtasks(parentId: number, userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.parentId, parentId), eq(tasks.userId, userId)))
  }

  async findInProgressTask(
    userId: string,
    excludeId: number,
  ): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, TaskStatus.IN_PROGRESS),
          ne(tasks.id, excludeId),
        ),
      )
      .limit(1)
    return task
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning()
    return task
  }

  async updateTask(
    id: number,
    userId: string,
    updates: UpdateTaskArg,
  ): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(taskByIdAndUser(id, userId))
      .returning()
    return task
  }

  async deleteTask(id: number, userId: string): Promise<void> {
    await db.delete(tasks).where(taskByIdAndUser(id, userId))
  }

  async reorderSubtasks(
    parentId: number,
    userId: string,
    orderedIds: number[],
  ): Promise<void> {
    await db
      .update(tasks)
      .set({ subtaskOrder: orderedIds })
      .where(taskByIdAndUser(parentId, userId))
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
    if (settings) {
      return sanitizeSettings(settings)
    }
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
