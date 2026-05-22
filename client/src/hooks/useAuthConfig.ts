/**
 * @fileoverview Fetches server-reported auth capabilities.
 * Tells the client whether Replit OIDC and the test login backdoor are available,
 * and provides `devLogin` to authenticate via the test backdoor when applicable.
 */

import { useEffect, useState } from 'react'

import { AuthPaths, TestPaths } from '~/shared/constants'
import { type AuthConfig, authConfigSchema } from '~/shared/schema'

async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(AuthPaths.CONFIG)
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`)
  return authConfigSchema.parse(await res.json())
}

export async function devLogin(onSuccess?: () => void): Promise<void> {
  const res = await fetch(TestPaths.TEST_LOGIN, { method: 'POST' })
  if (!res.ok) throw new Error(`Test login failed: ${res.status}`)
  onSuccess?.()
}

export function useAuthConfig() {
  const [data, setData] = useState<AuthConfig | undefined>(undefined)

  useEffect(() => {
    void fetchAuthConfig()
      .then(setData)
      .catch((err: unknown) => {
        console.error('[useAuthConfig] Failed to fetch auth config:', err)
      })
  }, [])

  const replitAuthEnabled = data?.replitAuthEnabled ?? true
  const testLoginEnabled = data?.testLoginEnabled ?? false
  const useDevLogin = !replitAuthEnabled && testLoginEnabled

  return { replitAuthEnabled, testLoginEnabled, useDevLogin }
}
