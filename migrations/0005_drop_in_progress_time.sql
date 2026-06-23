ALTER TABLE "tasks" DROP COLUMN "in_progress_started_at";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "time_spent";--> statement-breakpoint
UPDATE "user_settings" SET "field_config" = "field_config" - 'timeSpent' WHERE "field_config" ? 'timeSpent';