/**
 * @fileoverview Database access layer implementing the IStorage interface.
 *
 * Does not handle any business logic or side-effects; just basic CRUD and queries.
 * All logic lives in `TaskMutationService` and is orchestrated by the route handlers.
 */

import { and, eq, ne, sql } from 'drizzle-orm'

import {
  type Attachment,
  type AttachmentWithTask,
  attachments,
  type InsertAttachment,
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

export type { AttachmentWithTask }

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
  getSettings(userId: string): Promise<UserSettings>
  updateSettings(
    userId: string,
    updates: Partial<UserSettings>,
  ): Promise<UserSettings>
  getAttachments(taskId: number, userId: string): Promise<Attachment[]>
  getAttachment(id: number, userId: string): Promise<Attachment | undefined>
  getAllAttachments(userId: string): Promise<AttachmentWithTask[]>
  getTotalStorageUsed(userId: string): Promise<number>
  createAttachment(attachment: InsertAttachment): Promise<Attachment>
  deleteAttachment(id: number, userId: string): Promise<void>
  /** Recursively collects all R2 keys for a task and every descendant. */
  getAttachmentKeysForTaskTree(id: number, userId: string): Promise<string[]>
  /** Returns every r2Key stored in the attachments table, across all users. */
  getAllAttachmentR2Keys(): Promise<string[]>
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

  async getAttachments(taskId: number, userId: string): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
      .where(
        and(eq(attachments.taskId, taskId), eq(attachments.userId, userId)),
      )
      .orderBy(attachments.createdAt)
  }

  async getAttachment(
    id: number,
    userId: string,
  ): Promise<Attachment | undefined> {
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
    return attachment
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [created] = await db
      .insert(attachments)
      .values(attachment)
      .returning()
    return created
  }

  async deleteAttachment(id: number, userId: string): Promise<void> {
    await db
      .delete(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
  }

  async getAllAttachmentR2Keys(): Promise<string[]> {
    const rows = await db.select({ r2Key: attachments.r2Key }).from(attachments)
    return rows.map((r) => r.r2Key)
  }

  async getAttachmentKeysForTaskTree(
    id: number,
    userId: string,
  ): Promise<string[]> {
    const ownKeys = await db
      .select({ r2Key: attachments.r2Key })
      .from(attachments)
      .where(and(eq(attachments.taskId, id), eq(attachments.userId, userId)))
    const children = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.parentId, id), eq(tasks.userId, userId)))
    const childKeys = await Promise.all(
      children.map((c) => this.getAttachmentKeysForTaskTree(c.id, userId)),
    )
    return [...ownKeys.map((a) => a.r2Key), ...childKeys.flat()]
  }

  async getAllAttachments(userId: string): Promise<AttachmentWithTask[]> {
    return await db
      .select({
        id: attachments.id,
        taskId: attachments.taskId,
        userId: attachments.userId,
        fileName: attachments.fileName,
        fileSize: attachments.fileSize,
        mimeType: attachments.mimeType,
        r2Key: attachments.r2Key,
        createdAt: attachments.createdAt,
        taskName: tasks.name,
        taskStatus: tasks.status,
        taskCompletedAt: tasks.completedAt,
      })
      .from(attachments)
      .innerJoin(tasks, eq(attachments.taskId, tasks.id))
      .where(eq(attachments.userId, userId))
      .orderBy(attachments.createdAt)
  }

  async getTotalStorageUsed(userId: string): Promise<number> {
    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${attachments.fileSize}), 0)`,
      })
      .from(attachments)
      .where(eq(attachments.userId, userId))
    return Number(row?.total ?? 0)
  }
}

export const storage = new DatabaseStorage()
