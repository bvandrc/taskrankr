/**
 * @fileoverview Fetches server-reported auth capabilities.
 * Tells the client whether Replit OIDC and the test login backdoor are available,
 * so the landing page can adapt its login button without build-time assumptions.
 */

import { useQuery } from '@tanstack/react-query'

import type { AuthConfig } from '~/server/replit_integrations/auth/routes'
import { AuthPaths } from '~/shared/constants'

async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(AuthPaths.CONFIG)
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`)
  return res.json()
}

export function useAuthConfig() {
  const { data } = useQuery<AuthConfig>({
    queryKey: [AuthPaths.CONFIG],
    queryFn: fetchAuthConfig,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  return {
    replitAuthEnabled: data?.replitAuthEnabled ?? true,
    testLoginEnabled: data?.testLoginEnabled ?? false,
  }
}
