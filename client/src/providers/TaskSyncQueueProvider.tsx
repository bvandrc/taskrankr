/**
 * @fileoverview Append-only log of task operations bound for the server.
 * Owns its own context so queue churn (every task mutation + every flush tick)
 * doesn't re-render task consumers.
 *
 * Contract:
 *   - `TasksProvider` pushes via `enqueue` / `enqueueMany`.
 *   - `SyncProvider` drains via `syncQueue` + `removeProcessedOperations`.
 *   - After a CREATE_TASK succeeds, tempIds in the queue get rewritten to
 *     real ids via `replaceTempIdInQueue`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { getStorageKeys, type StorageMode, storage } from '@/lib/storage'
import type { CreateTaskContent, UpdateTaskContent } from './TasksProvider'

export enum SyncOperationType {
  CREATE_TASK = 'create_task',
  UPDATE_TASK = 'update_task',
  DELETE_TASK = 'delete_task',
}

export type SyncOperation =
  | {
      type: SyncOperationType.CREATE_TASK
      tempId: number
      data: CreateTaskContent
    }
  | { type: SyncOperationType.UPDATE_TASK; id: number; data: UpdateTaskContent }
  | { type: SyncOperationType.DELETE_TASK; id: number }

interface TaskSyncQueueContextValue {
  syncQueue: SyncOperation[]
  enqueue: (op: SyncOperation) => void
  enqueueMany: (ops: SyncOperation[]) => void
  clearSyncQueue: () => void
  removeProcessedOperations: (count: number) => void
  replaceTempIdInQueue: (tempId: number, realId: number) => void
}

const TaskSyncQueueContext = createContext<TaskSyncQueueContextValue | null>(
  null,
)

type TaskSyncQueueProviderProps = React.PropsWithChildren<{
  shouldSync: boolean
  storageMode: StorageMode
}>

export const TaskSyncQueueProvider = ({
  children,
  shouldSync,
  storageMode,
}: TaskSyncQueueProviderProps) => {
  const storageKeys = useMemo(() => getStorageKeys(storageMode), [storageMode])

  // Synchronous load so the queue is populated before any consumer (including
  // TasksProvider's init effect running recovery) observes it.
  const [syncQueue, setSyncQueue] = useState<SyncOperation[]>(() =>
    storage.get<SyncOperation[]>(storageKeys.syncQueue, []),
  )

  useEffect(() => {
    storage.set(storageKeys.syncQueue, syncQueue)
  }, [syncQueue, storageKeys])

  const enqueue = useCallback(
    (op: SyncOperation) => {
      if (!shouldSync) return
      setSyncQueue((prev) => [...prev, op])
    },
    [shouldSync],
  )

  const enqueueMany = useCallback(
    (ops: SyncOperation[]) => {
      if (!shouldSync || ops.length === 0) return
      setSyncQueue((prev) => [...prev, ...ops])
    },
    [shouldSync],
  )

  const clearSyncQueue = useCallback(() => {
    setSyncQueue([])
  }, [])

  const removeProcessedOperations = useCallback((count: number) => {
    if (count <= 0) return
    setSyncQueue((prev) => prev.slice(count))
  }, [])

  const replaceTempIdInQueue = useCallback((tempId: number, realId: number) => {
    setSyncQueue((prev) =>
      prev.map((op) => {
        if (op.type === SyncOperationType.CREATE_TASK) {
          if (op.tempId === tempId) return { ...op, tempId: realId }
          if (op.data.parentId === tempId)
            return { ...op, data: { ...op.data, parentId: realId } }
          return op
        }
        if ('id' in op && op.id === tempId) {
          return { ...op, id: realId }
        }
        if (
          op.type === SyncOperationType.UPDATE_TASK &&
          op.data.subtaskOrder?.includes(tempId)
        ) {
          return {
            ...op,
            data: {
              ...op.data,
              subtaskOrder: op.data.subtaskOrder.map((oid) =>
                oid === tempId ? realId : oid,
              ),
            },
          }
        }
        return op
      }),
    )
  }, [])

  const value = useMemo<TaskSyncQueueContextValue>(
    () => ({
      syncQueue,
      enqueue,
      enqueueMany,
      clearSyncQueue,
      removeProcessedOperations,
      replaceTempIdInQueue,
    }),
    [
      syncQueue,
      enqueue,
      enqueueMany,
      clearSyncQueue,
      removeProcessedOperations,
      replaceTempIdInQueue,
    ],
  )

  return (
    <TaskSyncQueueContext.Provider value={value}>
      {children}
    </TaskSyncQueueContext.Provider>
  )
}

export const useTaskSyncQueue = () => {
  const ctx = useContext(TaskSyncQueueContext)
  if (!ctx)
    throw new Error(
      'useTaskSyncQueue must be used within a TaskSyncQueueProvider',
    )
  return ctx
}
