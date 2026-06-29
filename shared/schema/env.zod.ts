/**
 * @fileoverview Zod helpers for validating environment variables at startup.
 * Used by the client, server, and Cypress config.
 */

import { z } from 'zod'

import { createObject } from '../utils'

export const createEnvSchema = <K extends string>(keys: K[]) =>
  z.object(createObject(keys, z.string().min(1)))

/** Firebase client config — required in both the browser bundle and Cypress. */
export const firebaseClientEnvSchema = createEnvSchema([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
])
