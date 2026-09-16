ALTER TABLE "children" ADD COLUMN "submission_key" text;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_submission_key_unique" UNIQUE("submission_key");