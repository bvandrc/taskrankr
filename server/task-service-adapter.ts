/**
 * Server-side adapter that wires `TaskService` to the database `storage`
 * layer for a specific user.
 */

import { TaskService, type TaskServiceIO } from '~/shared/service/task-service'
import { storage } from './storage'

export const makeTaskService = (userId: string): TaskService => {
  const io: TaskServiceIO = {
    getTask: async (id) => (await storage.getTask(id, userId)) ?? null,
    getDirectSubtasks: (parentId) => storage.getSubtasks(parentId, userId),
    getCurrentInProgressTask: async (excludeId) =>
      (await storage.findInProgressTask(userId, excludeId)) ?? null,
    getSettings: () => storage.getSettings(userId),
  }
  return new TaskService(io)
}
