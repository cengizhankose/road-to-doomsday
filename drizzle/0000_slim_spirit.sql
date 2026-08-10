CREATE TABLE "title_progress" (
	"catalog_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"cengizhan_score" smallint,
	"sinem_score" smallint,
	"current_season" smallint,
	"current_episode" smallint,
	"planned_at" timestamp with time zone,
	"watched_on" date,
	"note" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
