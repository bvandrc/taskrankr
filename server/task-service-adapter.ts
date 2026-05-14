/**
 * Server-side adapter that wires `TaskMutationService` to the database `storage`
 * layer for a specific user.
 */

import { TaskMutationService } from '~/shared/service/task-mutation-service'
import { storage } from './storage'

export const makeTaskService = (userId: string): TaskMutationService =>
  new TaskMutationService({
    getTask: async (id) => (await storage.getTask(id, userId)) ?? null,
    getDirectSubtasks: (parentId) => storage.getSubtasks(parentId, userId),
    getCurrentInProgressTask: async (excludeId) =>
      (await storage.findInProgressTask(userId, excludeId)) ?? null,
    getSettings: () => storage.getSettings(userId),
  })
