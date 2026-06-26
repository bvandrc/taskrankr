/**
 * @fileoverview Firebase Admin SDK setup and Express middleware for verifying Bearer tokens.
 */

import type { AppRoute, AppRouter } from '@ts-rest/core'
import type { TsRestRequest } from '@ts-rest/express'
import type { NextFunction, Response } from 'express'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

import { createEnvSchema } from '~/shared/schema'

const envParsed = createEnvSchema(['FIREBASE_SERVICE_ACCOUNT_JSON']).parse(
  process.env,
)

if (getApps().length === 0) {
  initializeApp({
    credential: cert(JSON.parse(envParsed.FIREBASE_SERVICE_ACCOUNT_JSON)),
  })
}

/** Reads the Firebase UID set by `isAuthenticated` middleware. */
export function getSessionUserId(res: Response): string {
  const uid = res.locals.firebaseUid as string | undefined
  if (!uid) throw new Error('User ID not found in session')
  return uid
}

export async function isAuthenticated<T extends AppRoute | AppRouter>(
  req: TsRestRequest<T>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
  try {
    const decoded = await getAuth().verifyIdToken(token)
    res.locals.firebaseUid = decoded.uid
    next()
  } catch {
    res.status(401).json({ message: 'Unauthorized' })
  }
}
