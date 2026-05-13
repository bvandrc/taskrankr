/**
 * @fileoverview User settings Drizzle schema, Zod validation, and types.
 * Includes per-field visibility/required config (fieldConfig JSONB column).
 */

import { boolean, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { mapValues } from 'es-toolkit'
import { z } from 'zod'

import { type RankField, SortOption } from './common'
import { createPgEnum, type DrizzleZodDefaultRefine } from './drizzle-utils'

export const fieldFlagsSchema = z.object({
  visible: z.boolean(),
  required: z.boolean(),
})

export type FieldFlags = z.infer<typeof fieldFlagsSchema>

const rankFieldConfigSchema = z.object({
  priority: fieldFlagsSchema,
  ease: fieldFlagsSchema,
  enjoyment: fieldFlagsSchema,
  time: fieldFlagsSchema,
} satisfies Record<RankField, typeof fieldFlagsSchema>)

export const fieldConfigSchema = rankFieldConfigSchema.extend({
  timeSpent: fieldFlagsSchema,
})

export type FieldConfig = z.infer<typeof fieldConfigSchema>

export const DEFAULT_FIELD_CONFIG = {
  priority: { visible: true, required: true },
  ease: { visible: true, required: true },
  enjoyment: { visible: true, required: true },
  time: { visible: true, required: true },
  timeSpent: { visible: true, required: false },
} as const satisfies FieldConfig

/** Ensures `required` is always false whenever `visible` is false. */
export const sanitizeSettings = <T extends Partial<UserSettings>>(
  settings: T,
): T => {
  if (settings.fieldConfig) {
    return {
      ...settings,
      fieldConfig: mapValues(settings.fieldConfig, ({ visible, required }) => ({
        visible,
        required: visible ? required : false,
      })),
    }
  }
  return settings
}

export const sortByPgEnum = createPgEnum('sort_by', SortOption)

export const userSettings = pgTable('user_settings', {
  userId: varchar('user_id').primaryKey(),
  autoPinNewTasks: boolean('auto_pin_new_tasks').default(true).notNull(),
  enableInProgressStatus: boolean('enable_in_progress_status')
    .default(true)
    .notNull(),
  alwaysSortPinnedByPriority: boolean('always_sort_pinned_by_priority')
    .default(true)
    .notNull(),
  sortBy: sortByPgEnum('sort_by').default(SortOption.DATE_CREATED).notNull(),
  fieldConfig: jsonb('field_config')
    .$type<FieldConfig>()
    .default(DEFAULT_FIELD_CONFIG)
    .notNull(),
})

const userSettingsSchemaRefine = {
  // created schema from drizzle-zod does not apply zod default values.
  // https://github.com/drizzle-team/drizzle-orm/issues/5384
  autoPinNewTasks: (s) => s.default(true),
  enableInProgressStatus: (s) => s.default(true),
  alwaysSortPinnedByPriority: (s) => s.default(true),
  sortBy: (s) => s.default(SortOption.DATE_CREATED),
  fieldConfig: fieldConfigSchema.default(DEFAULT_FIELD_CONFIG),
} satisfies DrizzleZodDefaultRefine<typeof userSettings>

export const userSettingsSchema = createSelectSchema(
  userSettings,
  userSettingsSchemaRefine,
)

export const insertUserSettingsSchema = createInsertSchema(
  userSettings,
  userSettingsSchemaRefine,
)

export type UserSettings = z.infer<typeof userSettingsSchema>
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>
