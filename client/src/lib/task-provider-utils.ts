/**
 * @fileoverview Utils shared by TaskProvider and DraftSessionProvider.
 */

import type { SetRequired } from 'type-fest'
import type { z } from 'zod'

import type { LocalTask } from '@/types'
import { allRankFieldsNull, type Task, taskSchema } from '~/shared/schema'

/**
 * Parses through `taskSchema` after applying the caller-supplied id and status
 * on top of `allRankFieldsNull` defaults. Assigns a fresh `clientKey` if one
 * isn't supplied.
 */
export const buildLocalTask = (
  data: SetRequired<Partial<z.input<typeof taskSchema>>, 'id' | 'status'> & {
    clientKey?: string
  },
): LocalTask => ({
  ...taskSchema.parse({
    ...allRankFieldsNull,
    ...data,
    userId: 'local',
  }),
  clientKey: data.clientKey ?? crypto.randomUUID(),
})

/**
 * For tasks crossing into client state (storage load, server fetch, demo seed).
 * Reuses the existing key when an id match is provided so re-hydration of the
 * same logical task keeps a stable React identity.
 */
export const withClientKeys = (
  tasks: Task[],
  existing: ReadonlyMap<number, string> = new Map(),
): LocalTask[] =>
  tasks.map((t) => ({
    ...t,
    clientKey: existing.get(t.id) ?? crypto.randomUUID(),
  }))

export const clientKeyMap = (
  tasks: ReadonlyArray<LocalTask>,
): Map<number, string> => new Map(tasks.map((t) => [t.id, t.clientKey]))
