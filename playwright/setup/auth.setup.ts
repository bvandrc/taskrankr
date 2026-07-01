import path from 'node:path'
import { test as setup } from '@playwright/test'

import { Routes } from '~/client/lib/constants'
import { Selectors } from '@test/support/constants/selectors'
import {
  createCustomToken,
  firebaseClientConfig,
} from '@test/support/utils/auth'

const authFile = path.join(import.meta.dirname, '../.auth/user.json')

// Local Firebase compat UMD bundles — injected into the page to sign in without
// relying on an external CDN. They expose a global `firebase` object.
const firebaseAppCompat = path.join(
  process.cwd(),
  'node_modules/firebase/firebase-app-compat.js',
)
const firebaseAuthCompat = path.join(
  process.cwd(),
  'node_modules/firebase/firebase-auth-compat.js',
)

setup('authenticate as test user', async ({ page }) => {
  const customToken = await createCustomToken()

  await page.goto(Routes.HOME)
  await page.addScriptTag({ path: firebaseAppCompat })
  await page.addScriptTag({ path: firebaseAuthCompat })

  // Sign in via the compat SDK. Persistence is keyed by apiKey + the default app
  // name, so the session lands in the same IndexedDB the app's modular SDK reads.
  await page.evaluate(
    async ({ config, token }) => {
      type FirebaseCompat = {
        initializeApp: (config: typeof firebaseClientConfig) => void
        auth: () => {
          signInWithCustomToken: (token: string) => Promise<unknown>
          onAuthStateChanged: (cb: (user: unknown) => void) => () => void
        }
      }
      const firebase = (window as unknown as { firebase: FirebaseCompat })
        .firebase
      firebase.initializeApp(config)
      await firebase.auth().signInWithCustomToken(token)
      await new Promise<void>((resolve) => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            unsubscribe()
            resolve()
          }
        })
      })
    },
    { config: firebaseClientConfig, token: customToken },
  )

  // Reload so the app's own SDK restores the session from IndexedDB.
  await page.reload()
  await page.locator(Selectors.Pages.HOME).waitFor({ state: 'visible' })

  // Keep only the Firebase session (IndexedDB) in the saved state. The app seeds
  // demo tasks (negative ids) into localStorage on first load; baking those into
  // storageState makes every test re-enqueue them as creates on init, so with a
  // shared backend the parallel workers pile up duplicate-named demo tasks.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('taskrankr-')) localStorage.removeItem(key)
    }
  })

  await page.context().storageState({ path: authFile, indexedDB: true })
})
