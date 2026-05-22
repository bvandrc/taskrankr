/**
 * @fileoverview Background sync provider for server synchronization.
 * Drains the task sync queue from TasksProvider and the coalesced
 * settings update from SettingsProvider when online and authenticated.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { toastError } from '@/hooks/useToasts'
import { debugLog } from '@/lib/debug-logger'
import { getById } from '@/lib/task-tree-utils'
import { tsr } from '@/lib/ts-rest'
import { TaskStatus } from '~/shared/schema'
import { useSettings } from './SettingsProvider'
import { SyncOperationType, useTaskSyncQueue } from './TaskSyncQueueProvider'
import { useTaskMutations, useTasks } from './TasksProvider'

interface SyncContextValue {
  isSyncing: boolean
  isOnline: boolean
  pendingCount: number
  lastSyncError: string | null
  forceSync: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

type SyncProviderProps = React.PropsWithChildren<{
  isAuthenticated: boolean
}>

export const SyncProvider = ({
  children,
  isAuthenticated,
}: SyncProviderProps) => {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const isSyncingRef = useRef(false)
  const hasLoadedServerData = useRef(false)

  const { tasks } = useTasks()
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  const {
    isInitialized: tasksInitialized,
    replaceTaskId,
    setTasksFromServer,
  } = useTaskMutations()

  const { syncQueue, removeProcessedOperations } = useTaskSyncQueue()

  const {
    pendingSettingsSync,
    acknowledgeSettingsSync,
    setSettingsFromServer,
    isInitialized: settingsInitialized,
  } = useSettings()

  const isInitialized = tasksInitialized && settingsInitialized
  const hasPendingSync = syncQueue.length > 0 || pendingSettingsSync !== null

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadServerData = useCallback(
    async (force = false) => {
      if (!isAuthenticated || !isOnline) return
      if (!force && hasLoadedServerData.current) return
      if (hasPendingSync) {
        debugLog.log('sync', 'loadServerData:skipped', {
          reason: 'pending sync operations',
          pendingTasks: syncQueue.length,
          pendingSettings: pendingSettingsSync !== null,
        })
        return
      }

      try {
        debugLog.log('sync', 'loadServerData:start', { force })
        const [tasksResult, settingsResult] = await Promise.all([
          tsr.tasks.list(),
          tsr.settings.get(),
        ])

        if (tasksResult.status === 200) {
          setTasksFromServer(tasksResult.body)
        }
        if (settingsResult.status === 200) {
          setSettingsFromServer(settingsResult.body)
        }

        hasLoadedServerData.current = true
        debugLog.log('sync', 'loadServerData:complete', {
          tasksStatus: tasksResult.status,
          settingsStatus: settingsResult.status,
        })
      } catch (err) {
        debugLog.log('sync', 'loadServerData:error', { error: String(err) })
        console.error('Failed to load server data:', err)
      }
    },
    [
      isAuthenticated,
      isOnline,
      hasPendingSync,
      syncQueue.length,
      pendingSettingsSync,
      setTasksFromServer,
      setSettingsFromServer,
    ],
  )

  useEffect(() => {
    if (
      isAuthenticated &&
      isOnline &&
      isInitialized &&
      !hasLoadedServerData.current &&
      !hasPendingSync
    ) {
      // biome-ignore lint/nursery/noFloatingPromises: from replit, TODO: investigate
      loadServerData()
    }
  }, [isAuthenticated, isOnline, isInitialized, hasPendingSync, loadServerData])

  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedServerData.current = false
    }
  }, [isAuthenticated])

  const flushQueue = useCallback(async () => {
    if (isSyncingRef.current || !isOnline || !isAuthenticated) return
    if (syncQueue.length === 0 && pendingSettingsSync === null) return

    isSyncingRef.current = true
    setIsSyncing(true)
    setLastSyncError(null)

    const queueSnapshot = [...syncQueue]
    const settingsSnapshot = pendingSettingsSync
    const idMap = new Map<number, number>()

    const resolveId = (id: number): number => idMap.get(id) ?? id

    try {
      debugLog.log('sync', 'flushQueue:start', {
        queueLength: queueSnapshot.length,
      })
      let successCount = 0
      for (const op of queueSnapshot) {
        let success = false
        let err: { message: string; taskName?: string } | undefined

        switch (op.type) {
          case SyncOperationType.CREATE_TASK: {
            const result = await tsr.tasks.create({ body: op.data })
            if (result.status === 201) {
              idMap.set(op.tempId, result.body.id)
              replaceTaskId(op.tempId, result.body.id)
              success = true
            } else {
              err = { ...result.body, taskName: op.data.name }
            }
            break
          }
          case SyncOperationType.UPDATE_TASK: {
            const realId = resolveId(op.id)
            if (realId < 0) {
              success = true
              break
            }
            const localTask = getById(tasksRef.current, realId)
            // RECONCILE: op to COMPLETED may not have timeSpent, but backend
            // may require it and be missing it
            const body = { ...op.data }
            if (
              body.status === TaskStatus.COMPLETED &&
              body.timeSpent === undefined
            ) {
              const localTimeSpent = localTask?.timeSpent
              if (localTimeSpent) body.timeSpent = localTimeSpent
            }
            const result = await tsr.tasks.update({
              params: { id: realId },
              body,
            })
            if (result.status === 200) {
              success = true
            } else if (
              queueSnapshot
                .slice(queueSnapshot.indexOf(op) + 1)
                .some(
                  (o) =>
                    o.type === SyncOperationType.DELETE_TASK &&
                    resolveId(o.id) === realId,
                )
            ) {
              // Update failed but a DELETE for the same task follows — the
              // task will be deleted anyway, so treat this as moot and
              // continue processing the queue.
              success = true
            } else {
              err = { ...result.body, taskName: localTask?.name }
            }
            break
          }
          case SyncOperationType.DELETE_TASK: {
            const realId = resolveId(op.id)
            if (realId < 0) {
              success = true
              break
            }
            const result = await tsr.tasks.delete({
              params: { id: realId },
            })
            if (result.status === 204) {
              success = true
            } else {
              err = {
                ...result.body,
                taskName: getById(tasksRef.current, realId)?.name,
              }
            }
            break
          }
          case SyncOperationType.REORDER_SUBTASKS: {
            const realParentId = resolveId(op.parentId)
            if (realParentId < 0) {
              success = true
              break
            }
            const realOrderedIds = op.orderedIds.map((id) => resolveId(id))
            const result = await tsr.tasks.reorderSubtasks({
              params: { id: realParentId },
              body: { orderedIds: realOrderedIds },
            })
            if (result.status === 200) {
              success = true
            } else {
              err = {
                ...result.body,
                taskName: getById(tasksRef.current, realParentId)?.name,
              }
            }
            break
          }
          default:
            success = true
        }

        if (success) {
          successCount++
        } else {
          const remaining = queueSnapshot.length - successCount
          toastError({
            title: `Sync error${err?.taskName ? `: "${err.taskName}"` : ''}`,
            description: [
              err?.message,
              `${remaining} unsynced action(s) remaining.`,
            ]
              .filter(Boolean)
              .join(' '),
          })
          setLastSyncError(`Failed to sync: ${op.type}`)
          break
        }
      }

      debugLog.log('sync', 'flushQueue:complete', {
        successCount,
        total: queueSnapshot.length,
      })
      // Only remove the operations we actually processed from the front of
      // the queue. Do NOT clear the entire queue — operations may have been
      // appended by the user during the in-flight sync, and clearing would
      // silently drop them.
      removeProcessedOperations(successCount)

      // Settings: send the snapshot captured at flush start, then acknowledge
      // the synced fields. `acknowledgeSettingsSync` retains any fields the
      // user changed mid-flight so we don't clobber concurrent edits.
      if (settingsSnapshot !== null) {
        const result = await tsr.settings.update({
          body: settingsSnapshot,
        })
        if (result.status === 200) {
          acknowledgeSettingsSync(settingsSnapshot)
        } else {
          toastError({
            title: 'Failed to sync: settings',
            description: (result.body as unknown as { message: string })
              .message,
          })
          setLastSyncError('Failed to sync: settings')
        }
      }
    } catch (err) {
      debugLog.log('sync', 'flushQueue:error', { error: String(err) })
      console.error('Sync failed:', err)
      setLastSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      isSyncingRef.current = false
      setIsSyncing(false)
    }
  }, [
    syncQueue,
    pendingSettingsSync,
    isOnline,
    isAuthenticated,
    replaceTaskId,
    removeProcessedOperations,
    acknowledgeSettingsSync,
  ])

  useEffect(() => {
    if (
      isOnline &&
      isAuthenticated &&
      hasPendingSync &&
      !isSyncingRef.current
    ) {
      const timer = setTimeout(flushQueue, 500)
      return () => clearTimeout(timer)
    }
  }, [hasPendingSync, isOnline, isAuthenticated, flushQueue])

  const forceSync = useCallback(async () => {
    await flushQueue()
    await loadServerData(true)
  }, [flushQueue, loadServerData])

  useEffect(() => {
    if (!isAuthenticated) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await forceSync()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, forceSync])

  const pendingCount = syncQueue.length + (pendingSettingsSync !== null ? 1 : 0)

  const value = useMemo(
    () => ({
      isSyncing,
      isOnline,
      pendingCount,
      lastSyncError,
      forceSync,
    }),
    [isSyncing, isOnline, pendingCount, lastSyncError, forceSync],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export const useSync = () => {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}

export const useSyncSafe = () => {
  return useContext(SyncContext)
}
