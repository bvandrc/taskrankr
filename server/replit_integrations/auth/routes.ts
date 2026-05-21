/**
 * @fileoverview Auth-specific API routes for user session data.
 */

import type { Express } from 'express'

import { AuthPaths } from '~/shared/constants'
import { isAuthenticated, type UserSession } from './replitAuth'
import { authStorage } from './storage'

export type AuthConfig = {
  /** Replit OIDC is available — the /api/login flow works. */
  replitAuthEnabled: boolean
  /** Dev-only test login endpoint is registered (NODE_ENV !== 'production'). */
  testLoginEnabled: boolean
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  app.get(AuthPaths.CONFIG, (_req, res) => {
    res.json({
      replitAuthEnabled: !!process.env.REPL_ID,
      testLoginEnabled: process.env.NODE_ENV !== 'production',
    } satisfies AuthConfig)
  })

  // Get current authenticated user
  app.get(AuthPaths.USER, isAuthenticated, async (req, res) => {
    try {
      // biome-ignore lint/style/noNonNullAssertion: is always present
      const userId = (req.user as UserSession)!.claims!.sub
      const user = await authStorage.getUser(userId)
      res.json(user)
    } catch (error) {
      console.error('Error fetching user:', error)
      res.status(500).json({ message: 'Failed to fetch user' })
    }
  })
}
