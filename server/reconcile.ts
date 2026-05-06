/**
 * @fileoverview Orphaned-attachment reconciliation job.
 *
 * Compares every key in the R2 bucket against every r2Key stored in the DB.
 * Any key present in R2 but absent from the DB is an orphan — uploaded via a
 * presigned URL whose subsequent `create` call never completed — and is deleted.
 */

import { hoursToMilliseconds, minutesToMilliseconds } from 'date-fns'

import { log } from './log'
import { deleteR2Object, listAllR2Keys } from './r2'
import { storage } from './storage'

const THREE_WEEKS_MS = hoursToMilliseconds(24 * 7 * 3)

async function reconcile(): Promise<void> {
  log('starting', 'reconcile')
  const [r2Keys, dbKeys] = await Promise.all([
    listAllR2Keys(),
    storage.getAllAttachmentR2Keys(),
  ])
  const dbKeySet = new Set(dbKeys)
  const orphans = r2Keys.filter((key) => !dbKeySet.has(key))

  if (orphans.length === 0) {
    log('no orphans found', 'reconcile')
    return
  }

  log(`found ${orphans.length} orphan(s) — deleting`, 'reconcile')
  const results = await Promise.allSettled(
    orphans.map((key) => deleteR2Object(key)),
  )
  const failed = results.filter((r) => r.status === 'rejected').length
  log(`done: ${orphans.length - failed} deleted, ${failed} failed`, 'reconcile')
}

/** Schedules the reconciliation job: runs once after startup, then every 3 weeks. */
export function scheduleReconciliation(): void {
  setTimeout(() => {
    void reconcile()
    setInterval(() => void reconcile(), THREE_WEEKS_MS)
  }, minutesToMilliseconds(1))
}
