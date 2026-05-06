import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

import { tasks } from './tasks.zod'

export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  r2Key: text('r2_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const attachmentSchema = createSelectSchema(attachments, {
  createdAt: z.coerce.date(),
})

export type Attachment = z.infer<typeof attachmentSchema>

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
})

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>

export const uploadUrlBodySchema = insertAttachmentSchema.omit({
  userId: true,
  r2Key: true,
})

export const createAttachmentBodySchema = insertAttachmentSchema.omit({
  userId: true,
})

export const attachmentWithTaskSchema = attachmentSchema.extend({
  taskName: z.string(),
  taskStatus: z.string(),
  taskCompletedAt: z.coerce.date().nullable(),
})

export type AttachmentWithTask = z.infer<typeof attachmentWithTaskSchema>
