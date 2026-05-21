/**
 * @fileoverview Fetches server-reported auth capabilities.
 * Tells the client whether Replit OIDC and the test login backdoor are available,
 * and provides `devLogin` to authenticate via the test backdoor when applicable.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { defaults } from 'es-toolkit/compat'

import { AuthPaths, TestPaths } from '~/shared/constants'
import { type AuthConfig, authConfigSchema } from '~/shared/schema'

async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(AuthPaths.CONFIG)
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`)
  return authConfigSchema.parse(await res.json())
}

export function useAuthConfig() {
  const queryClient = useQueryClient()

  const { data } = useQuery<AuthConfig>({
    queryKey: [AuthPaths.CONFIG],
    queryFn: fetchAuthConfig,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  const { replitAuthEnabled, testLoginEnabled } = defaults(data ?? {}, {
    replitAuthEnabled: true,
    testLoginEnabled: false,
  })

  const useDevLogin = !replitAuthEnabled && testLoginEnabled

  const devLogin = async () => {
    await fetch(TestPaths.TEST_LOGIN, { method: 'POST' })
    queryClient.invalidateQueries({ queryKey: [AuthPaths.USER] })
  }

  return { replitAuthEnabled, testLoginEnabled, useDevLogin, devLogin }
}
