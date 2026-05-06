/**
 * @fileoverview Local-first user settings with localStorage persistence.
 * Pending changes are tracked as a single coalesced partial-update pointer
 * (not a queue, since settings updates are idempotent merges). SyncProvider
 * drains it. Independent of TasksProvider.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { pickBy, toMerged } from 'es-toolkit'

import { debugLog } from '@/lib/debug-logger'
import { getStorageKeys, type StorageMode, storage } from '@/lib/storage'
import {
  DEFAULT_FIELD_CONFIG,
  SortOption,
  sanitizeSettings,
  type UserSettings,
} from '~/shared/schema'

const DEFAULT_SETTINGS = {
  userId: '',
  autoPinNewTasks: true,
  enableInProgressStatus: true,
  alwaysSortPinnedByPriority: true,
  sortBy: SortOption.PRIORITY,
  fieldConfig: DEFAULT_FIELD_CONFIG,
} as const satisfies UserSettings

/** Normalize incoming settings: fill missing fields from defaults and enforce
 *  the fieldConfig invariant (`required` is false whenever `visible` is
 *  false). Applied at every write boundary (initial load, server push,
 *  user updates) so consumers can trust `settings` without re-checking. */
const normalizeSettings = (raw: Partial<UserSettings>): UserSettings =>
  sanitizeSettings(toMerged(DEFAULT_SETTINGS, raw))

interface SettingsContextValue {
  settings: UserSettings
  isInitialized: boolean
  updateSettings: (updates: Partial<UserSettings>) => void

  // Server sync bridge (used by SyncProvider)
  /** Coalesced pending settings update to push to the server, or null if no
   *  unsynced changes. Settings updates are idempotent partials, so we merge
   *  rather than queue. Persisted to localStorage so unsynced changes survive
   *  a tab close. */
  pendingSettingsSync: Partial<UserSettings> | null
  /** Drop fields from pending that match what was just synced. Fields the user
   *  changed mid-flight (different value, or new key) are retained. */
  acknowledgeSettingsSync: (synced: Partial<UserSettings>) => void
  setSettingsFromServer: (settings: UserSettings) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

type SettingsProviderProps = React.PropsWithChildren<{
  shouldSync: boolean
  storageMode: StorageMode
}>

export const SettingsProvider = ({
  children,
  shouldSync,
  storageMode,
}: SettingsProviderProps) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [pendingSettingsSync, setPendingSettingsSync] =
    useState<Partial<UserSettings> | null>(null)

  const storageKeys = useMemo(() => getStorageKeys(storageMode), [storageMode])
  const pendingSyncStorageKey = `${storageKeys.settings}-pending-sync`

  useEffect(() => {
    const loaded = normalizeSettings(
      storage.get<UserSettings>(storageKeys.settings, DEFAULT_SETTINGS),
    )
    setSettings(loaded)
    setPendingSettingsSync(
      storage.get<Partial<UserSettings> | null>(pendingSyncStorageKey, null),
    )
    setIsInitialized(true)
  }, [storageKeys, pendingSyncStorageKey])

  useEffect(() => {
    if (isInitialized) {
      storage.set(storageKeys.settings, settings)
    }
  }, [settings, isInitialized, storageKeys])

  useEffect(() => {
    if (!isInitialized) return
    if (pendingSettingsSync === null) {
      storage.remove(pendingSyncStorageKey)
    } else {
      storage.set(pendingSyncStorageKey, pendingSettingsSync)
    }
  }, [pendingSettingsSync, isInitialized, pendingSyncStorageKey])

  const updateSettings = useCallback(
    (updates: Partial<UserSettings>) => {
      const sanitized = sanitizeSettings(updates)
      setSettings((prev) => normalizeSettings({ ...prev, ...sanitized }))
      if (shouldSync) {
        setPendingSettingsSync((prev) =>
          prev ? { ...prev, ...sanitized } : sanitized,
        )
      }
      debugLog.log('settings', 'update', sanitized)
    },
    [shouldSync],
  )

  const acknowledgeSettingsSync = useCallback(
    (synced: Partial<UserSettings>) => {
      setPendingSettingsSync((current) => {
        // Fast path: nothing changed during flight, drop everything.
        if (current === null || current === synced) return null
        // Otherwise keep keys the user changed mid-flight (new keys, or keys
        // whose value diverged from what we just synced).
        const remaining = pickBy(
          current,
          (v, key) => !(key in synced) || v !== synced[key],
        )
        return Object.keys(remaining).length > 0 ? remaining : null
      })
    },
    [],
  )

  const setSettingsFromServer = useCallback((serverSettings: UserSettings) => {
    const normalized = normalizeSettings(serverSettings)
    setSettings(normalized)
    debugLog.log('sync', 'setSettingsFromServer', normalized)
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      isInitialized,
      updateSettings,
      pendingSettingsSync,
      acknowledgeSettingsSync,
      setSettingsFromServer,
    }),
    [
      settings,
      isInitialized,
      updateSettings,
      pendingSettingsSync,
      acknowledgeSettingsSync,
      setSettingsFromServer,
    ],
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext)
  if (!ctx)
    throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
