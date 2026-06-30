/**
 * @fileoverview Tasks table + status/rank enums, with a Zod-refined insert
 * schema (`insertTaskSchemaRefined`) that enforces user-configured required
 * fields.
 */

import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod'
import { z } from 'zod'

import { createObject } from '../utils'
import { getZodSchemaDefaults } from '../utils/zod-utils'
import { type RankField, RankFields } from './common'
import { createPgEnum, type DrizzleZodDefaultRefine } from './drizzle-utils'
import type { UserSettings } from './settings.zod'

// Status constants and types
export enum TaskStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PINNED = 'pinned',
  COMPLETED = 'completed',
}

// Subtask sort mode constants
export enum SubtaskSortMode {
  INHERIT = 'inherit',
  MANUAL = 'manual',
}

// Attribute level constants and types
export enum Priority {
  LOWEST = 'lowest',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  HIGHEST = 'highest',
}

export enum Ease {
  EASIEST = 'easiest',
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  HARDEST = 'hardest',
}

export enum Enjoyment {
  LOWEST = 'lowest',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  HIGHEST = 'highest',
}

export enum Time {
  LOWEST = 'lowest',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  HIGHEST = 'highest',
}

export const SCHEDULE_SEQUENCE = [
  'hideUntil',
  ...Object.values(Priority),
  'dueAt',
] as const

export const taskScheduleSchema = z.object(
  createObject(SCHEDULE_SEQUENCE, () => z.coerce.date().optional()),
)

export type TaskSchedule = z.infer<typeof taskScheduleSchema>

export const taskStatusPgEnum = createPgEnum('status', TaskStatus)
export const subtaskSortModePgEnum = createPgEnum(
  'subtask_sort_mode',
  SubtaskSortMode,
)
export const priorityPgEnum = createPgEnum('priority', Priority)
export const easePgEnum = createPgEnum('ease', Ease)
export const enjoymentPgEnum = createPgEnum('enjoyment', Enjoyment)
export const timePgEnum = createPgEnum('time_rank', Time)

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(), // Owner of the task
  name: text('name').notNull(),
  status: taskStatusPgEnum('status').default(TaskStatus.OPEN).notNull(),
  description: text('description'),
  priority: priorityPgEnum('priority'),
  ease: easePgEnum('ease'),
  enjoyment: enjoymentPgEnum('enjoyment'),
  time: timePgEnum('time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  parentId: integer('parent_id'),
  subtaskSortMode: subtaskSortModePgEnum('subtask_sort_mode')
    .default(SubtaskSortMode.INHERIT)
    .notNull(),
  subtaskOrder: integer('subtask_order')
    .array()
    .default(sql`'{}'::integer[]`)
    .notNull(),
  autoHideCompleted: boolean('auto_hide_completed').default(true).notNull(),
  inheritCompletionState: boolean('inherit_completion_state')
    .default(false)
    .notNull(),
  schedule: jsonb('schedule').$type<TaskSchedule>(),
})

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, {
    relationName: 'subtasks',
  }),
}))

const taskSchemaRefine = {
  // created schema from drizzle-zod does not apply zod default values.
  // https://github.com/drizzle-team/drizzle-orm/issues/5384
  status: (s) => s.default(TaskStatus.OPEN),
  subtaskSortMode: (s) => s.default(SubtaskSortMode.INHERIT),
  subtaskOrder: (s) => s.default([]),
  autoHideCompleted: (s) => s.default(true),
  inheritCompletionState: (s) => s.default(false),
  // not sure the created schema from drizzle-zod performs the coercion,
  // so add here just in case / for safety.
  createdAt: z.coerce.date().default(() => new Date()),
  completedAt: z.coerce.date().nullable().default(null),
  // apply default of null so can pass `undefined` from client and have it converted to `null` for the database.
  parentId: z.number().int().nullable().default(null),
  description: z.string().nullable().default(null),
  schedule: taskScheduleSchema.nullable().default(null),
} satisfies DrizzleZodDefaultRefine<typeof tasks>

export const taskSchema = createSelectSchema(tasks, taskSchemaRefine)

export type Task = z.infer<typeof taskSchema>

/**
 * Resolved default values for every task. Use as single source of truth for
 * defaults across client and server.
 * (see `getZodSchemaDefaults` for the caveat about function-style defaults like
 * `createdAt`).
 */
export const taskSchemaDefaults = getZodSchemaDefaults(taskSchema)

export const insertTaskSchema = createInsertSchema(tasks, {
  ...taskSchemaRefine,
  name: z.string().trim().min(1),
})
  .partial()
  .omit({ id: true })
  .required({
    name: true,
    userId: true,
  })

export const insertTaskSchemaRefined = (
  settings: Pick<UserSettings, 'fieldConfig'>,
) => {
  const requiredRankFields: RankField[] = RankFields.filter(
    (name) => settings.fieldConfig[name].required,
  )

  return insertTaskSchema.omit({ userId: true }).superRefine((data, ctx) => {
    for (const field of requiredRankFields) {
      if (data[field] == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: 'This field is required',
        })
      }
    }

    const s = data.schedule
    if (!s) return
    const sequence = SCHEDULE_SEQUENCE.flatMap((key) => {
      const date = s[key]
      return date ? [{ path: ['schedule', key], date, label: key }] : []
    })
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].date <= sequence[i - 1].date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: sequence[i].path,
          message: `Must be after ${sequence[i - 1].label} date`,
        })
      }
    }
  })
}

export type InsertTask = z.infer<typeof insertTaskSchema>
export type CreateTask = InsertTask

export const updateTaskSchema = createUpdateSchema(tasks, taskSchemaRefine)
  .partial()
  .required({ id: true })
  .omit({ userId: true })

export type UpdateTask = z.infer<typeof updateTaskSchema>

export type MutateTask = CreateTask | UpdateTask

export type TaskSubtaskSettings = Pick<
  Task,
  | 'subtaskSortMode'
  | 'autoHideCompleted'
  | 'inheritCompletionState'
  | 'subtaskOrder'
>

export const allRankFieldsNull = createObject(RankFields, () => null)
