/**
 * @fileoverview Auth context — fetches and caches the current session.
 *
 * Caches the last user in localStorage so offline / network-error reloads can
 * still surface an authenticated UI instead of bouncing through the login
 * screen. A real 401 always wins (clears the cache and returns null).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import { storage } from '@/lib/storage'
import { AuthPaths } from '~/shared/constants'
import type { User } from '~/shared/models/auth'

const CACHED_USER_KEY = 'taskrankr-cached-user'

function setCachedUser(user: User | null): void {
  try {
    if (user) {
      storage.set(CACHED_USER_KEY, user)
    } else {
      storage.remove(CACHED_USER_KEY)
    }
  } catch {
    // localStorage may be unavailable
  }
}

async function fetchUser(): Promise<User | null> {
  try {
    const response = await fetch(AuthPaths.USER, {
      credentials: 'include',
    })

    if (response.status === 401) {
      setCachedUser(null)
      return null
    }

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`)
    }

    const user = await response.json()
    setCachedUser(user)
    return user
  } catch (error) {
    if (error instanceof TypeError || !navigator.onLine) {
      const cached = storage.get<User | null>(CACHED_USER_KEY, null)
      if (cached) {
        return cached
      }
    }
    throw error
  }
}

// biome-ignore lint/suspicious/useAwait: involves window.href, allow it.
async function performLogout(): Promise<void> {
  setCachedUser(null)
  window.location.href = AuthPaths.LOGOUT
}

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isLoggingOut: boolean
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: React.PropsWithChildren) => {
  // undefined = not yet fetched (loading), null = fetched but not authenticated
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const refreshUser = useCallback(async () => {
    const result = await fetchUser()
    setUser(result)
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const logout = useCallback(() => {
    setIsLoggingOut(true)
    void performLogout()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading: user === undefined,
        isAuthenticated: !!user,
        isLoggingOut,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
