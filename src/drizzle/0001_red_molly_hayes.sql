CREATE TABLE "children" (
	"id" serial PRIMARY KEY NOT NULL,
	"english_name" text NOT NULL,
	"age" integer NOT NULL,
	"dream_school" text NOT NULL,
	"interests" text NOT NULL,
	"activities" text NOT NULL,
	"self_description" text NOT NULL,
	"parent_observation" text NOT NULL,
	"dream_career" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
