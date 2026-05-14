import type { MutableRefObject } from 'react'

import type { LocalTask } from '@/types'
import { TaskStatus, type UserSettings } from '~/shared/schema'
import { TaskMutationService } from '~/shared/service/task-mutation-service'
import { getById, getDirectSubtasks } from './task-tree-utils'

export const makeTaskService = (
  tasksRef: MutableRefObject<LocalTask[]>,
  settingsRef: MutableRefObject<UserSettings>,
): TaskMutationService =>
  new TaskMutationService({
    getTask: (id) => getById(tasksRef.current, id) ?? null,
    getDirectSubtasks: (parentId) =>
      getDirectSubtasks(tasksRef.current, parentId),
    getCurrentInProgressTask: (excludeId) =>
      tasksRef.current.find(
        (t) => t.status === TaskStatus.IN_PROGRESS && t.id !== excludeId,
      ) ?? null,
    getSettings: () => settingsRef.current,
  })
