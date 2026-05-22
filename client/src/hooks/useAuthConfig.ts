/**
 * @fileoverview Build-time auth capability flags and dev login utility.
 *
 * `import.meta.env.DEV` is baked by Vite — true in the dev server, false in
 * all production builds — so no network request is needed to determine whether
 * the test-login backdoor should be offered.
 */

import { TestPaths } from '~/shared/constants'

/**
 * True when the dev login backdoor should be offered instead of Replit OAuth.
 * Only active in the Vite dev server; always false in production builds.
 */
export const devLoginEnabled = import.meta.env.DEV

export async function devLogin(onSuccess?: () => void): Promise<void> {
  const res = await fetch(TestPaths.TEST_LOGIN, { method: 'POST' })
  if (!res.ok) throw new Error(`Test login failed: ${res.status}`)
  onSuccess?.()
}
