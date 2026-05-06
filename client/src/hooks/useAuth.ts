/**
 * @fileoverview react-query-backed session state + logout.
 *
 * Caches the last user in localStorage so offline / network-error reloads can
 * still surface an authenticated UI instead of bouncing through the login
 * screen. A real 401 always wins (clears the cache and returns null).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { minutesToMilliseconds } from 'date-fns'

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

// biome-ignore lint/suspicious/useAwait: involved window.href logging out, allow it.
async function logout(): Promise<void> {
  setCachedUser(null)
  window.location.href = AuthPaths.LOGOUT
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: [AuthPaths.USER],
    queryFn: fetchUser,
    retry: false,
    staleTime: minutesToMilliseconds(5), // 5 minutes
  })

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData([AuthPaths.USER], null)
    },
  })

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  }
}
