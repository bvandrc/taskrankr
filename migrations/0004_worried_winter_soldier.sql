CREATE TYPE "public"."sort_by" AS ENUM('priority', 'ease', 'enjoyment', 'time');--> statement-breakpoint
CREATE TYPE "public"."ease" AS ENUM('easiest', 'easy', 'medium', 'hard', 'hardest');--> statement-breakpoint
CREATE TYPE "public"."enjoyment" AS ENUM('lowest', 'low', 'medium', 'high', 'highest');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('lowest', 'low', 'medium', 'high', 'highest');--> statement-breakpoint
CREATE TYPE "public"."subtask_sort_mode" AS ENUM('inherit', 'manual');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('open', 'in_progress', 'pinned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."time" AS ENUM('lowest', 'low', 'medium', 'high', 'highest');--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "sort_by" SET DEFAULT 'priority'::"public"."sort_by";--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "sort_by" SET DATA TYPE "public"."sort_by" USING "sort_by"::"public"."sort_by";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'open'::"public"."status";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DATA TYPE "public"."status" USING "status"::"public"."status";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "priority" SET DATA TYPE "public"."priority" USING "priority"::"public"."priority";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "ease" SET DATA TYPE "public"."ease" USING "ease"::"public"."ease";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "enjoyment" SET DATA TYPE "public"."enjoyment" USING "enjoyment"::"public"."enjoyment";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "time" SET DATA TYPE "public"."time" USING "time"::"public"."time";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "subtask_sort_mode" SET DEFAULT 'inherit'::"public"."subtask_sort_mode";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "subtask_sort_mode" SET DATA TYPE "public"."subtask_sort_mode" USING "subtask_sort_mode"::"public"."subtask_sort_mode";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "in_progress_started_at";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "time_spent";--> statement-breakpoint
UPDATE "user_settings" SET "field_config" = "field_config" - 'timeSpent' WHERE "field_config" ? 'timeSpent';