import path from 'node:path'
import { test as setup } from '@playwright/test'

import { Routes } from '~/client/lib/constants'
import { Selectors } from '@test/support/constants/selectors'

const authFile = path.join(import.meta.dirname, '../.auth/user.json')

setup('authenticate as test user', async ({ page }) => {
  await page.goto(Routes.HOME)

  // In dev mode, the Log In button auto-authenticates as the built-in test user
  const loginBtn = page.getByRole('button', { name: /log in/i })
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn.click()
  }

  await page.locator(Selectors.Pages.HOME).waitFor({ state: 'visible' })
  await page.context().storageState({ path: authFile })
})
