/**
 * @fileoverview Auth context — exposes the current Firebase user, loading state, and logout.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { User } from 'firebase/auth'
import { signOut } from 'firebase/auth'

import { firebaseAuth } from '@/lib/auth-client'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: React.PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(
    () =>
      firebaseAuth.onAuthStateChanged((u) => {
        setUser(u)
        setIsLoading(false)
      }),
    [],
  )

  const logout = useCallback(() => void signOut(firebaseAuth), [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
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
