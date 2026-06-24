import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

import { firebaseClientEnvSchema } from '~/shared/schema/env.zod'

const env = firebaseClientEnvSchema.parse(import.meta.env)

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
})

export const firebaseAuth = getAuth(app)
