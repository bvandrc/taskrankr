/**
 * @fileoverview Firebase test-user authentication for Playwright.
 *
 * The Admin SDK mints a custom token for the test user, which is signed in on
 * the page to seed the browser's Firebase session.
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

/** Mints a Firebase custom token for the test user. */
export function createCustomToken(uid: string = TEST_USER_ID): Promise<string> {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    })
  }
  return getAuth().createCustomToken(uid)
}
