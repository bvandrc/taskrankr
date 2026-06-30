/**
 * @fileoverview Firebase test-user authentication for Playwright.
 *
 * Mirrors the old `cypress-firebase` `cy.login(uid)` flow: the Admin SDK mints a
 * custom token for the test user, which is either signed in on the page (to seed
 * the browser's Firebase session) or exchanged for an ID token used as a Bearer
 * token on authenticated API requests.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

import {
  createEnvSchema,
  firebaseClientEnvSchema,
} from '~/shared/schema/env.zod'

const env = firebaseClientEnvSchema
  .extend(
    createEnvSchema([
      'FIREBASE_SERVICE_ACCOUNT_JSON',
      'PLAYWRIGHT_TEST_USER_ID',
    ]).shape,
  )
  .parse(process.env)

/** UID of the Firebase user the authenticated suite runs as. */
export const TEST_USER_ID = env.PLAYWRIGHT_TEST_USER_ID

/** Firebase client config — used to initialize the SDK in the browser. */
export const firebaseClientConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
}

function adminAuth() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    })
  }
  return getAuth()
}

/** Mints a Firebase custom token for the test user. */
export function createCustomToken(uid: string = TEST_USER_ID): Promise<string> {
  return adminAuth().createCustomToken(uid)
}

let cachedIdToken: { token: string; expiresAt: number } | undefined

/**
 * Returns a Firebase ID token for the test user, for use as a `Bearer` token on
 * authenticated API requests. Cached per worker and refreshed before expiry.
 */
export async function getIdToken(): Promise<string> {
  if (cachedIdToken && Date.now() < cachedIdToken.expiresAt - 60_000) {
    return cachedIdToken.token
  }

  const customToken = await createCustomToken()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  if (!res.ok) {
    throw new Error(
      `ID token exchange failed: ${res.status} ${await res.text()}`,
    )
  }

  const { idToken, expiresIn } = (await res.json()) as {
    idToken: string
    expiresIn: string
  }
  cachedIdToken = {
    token: idToken,
    expiresAt: Date.now() + Number(expiresIn) * 1000,
  }
  return idToken
}
