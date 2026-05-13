/**
 * @fileoverview Tasks table + status/rank enums, with a Zod-refined insert
 * schema (`insertTaskSchemaRefined`) that enforces user-configured required
 * fields and the "time spent required to complete" rule.
 */

import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  integer,
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

import { getZodSchemaDefaults } from '../utils/zod-utils'
import { RankField } from './common'
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

export const taskStatusPgEnum = createPgEnum('status', TaskStatus)
export const subtaskSortModePgEnum = createPgEnum(
  'subtask_sort_mode',
  SubtaskSortMode,
)
export const priorityPgEnum = createPgEnum('priority', Priority)
export const easePgEnum = createPgEnum('ease', Ease)
export const enjoymentPgEnum = createPgEnum('enjoyment', Enjoyment)
export const timePgEnum = createPgEnum('time', Time)

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
  timeSpent: integer('time_spent').default(0).notNull(), // Cumulative time in milliseconds
  inProgressStartedAt: timestamp('in_progress_started_at'), // When current in-progress session started
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
  subtasksShowNumbers: boolean('subtasks_show_numbers')
    .default(false)
    .notNull(),
  hidden: boolean('hidden').default(false).notNull(),
  autoHideCompleted: boolean('auto_hide_completed').default(false).notNull(),
  inheritCompletionState: boolean('inherit_completion_state')
    .default(false)
    .notNull(),
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
  subtasksShowNumbers: (s) => s.default(false),
  hidden: (s) => s.default(false),
  autoHideCompleted: (s) => s.default(false),
  inheritCompletionState: (s) => s.default(false),
  timeSpent: (s) => s.default(0),
  // not sure the created schema from drizzle-zod performs the coercion,
  // so add here just in case / for safety.
  createdAt: z.coerce.date().default(() => new Date()),
  completedAt: z.coerce.date().nullable().default(null),
  inProgressStartedAt: z.coerce.date().nullable().default(null),
  // apply default of null so can pass `undefined` from client and have it converted to `null` for the database.
  parentId: z.number().int().nullable().default(null),
  description: z.string().nullable().default(null),
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
  const requiredRankFields: RankField[] = RankField.filter(
    (name) => settings.fieldConfig[name].required,
  )

  const timeSpentRequired = settings.fieldConfig.timeSpent.required

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
    if (
      data.status === TaskStatus.COMPLETED &&
      timeSpentRequired &&
      (data.timeSpent ?? 0) <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timeSpent'],
        message: 'Time spent is required when completing a task',
      })
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

export const allRankFieldsNull = {
  priority: null,
  ease: null,
  enjoyment: null,
  time: null,
}
