CREATE TABLE "households" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_selections" (
	"household_id" text NOT NULL,
	"route" text NOT NULL,
	"catalog_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_selections_household_route_pk" PRIMARY KEY("household_id","route"),
	CONSTRAINT "route_selections_route_check" CHECK ("route_selections"."route" in ('movies', 'series'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_hash" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "title_progress" (
	"household_id" text NOT NULL,
	"catalog_id" text NOT NULL,
	"status" text NOT NULL,
	"cengizhan_score" smallint,
	"sinem_score" smallint,
	"current_season" smallint,
	"current_episode" smallint,
	"planned_at" timestamp with time zone,
	"watched_on" date,
	"note" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_progress_household_catalog_pk" PRIMARY KEY("household_id","catalog_id"),
	CONSTRAINT "title_progress_status_check" CHECK ("title_progress"."status" in ('not_started', 'planned', 'watching', 'watched', 'skipped')),
	CONSTRAINT "title_progress_cengizhan_score_check" CHECK ("title_progress"."cengizhan_score" is null or "title_progress"."cengizhan_score" between 0 and 10),
	CONSTRAINT "title_progress_sinem_score_check" CHECK ("title_progress"."sinem_score" is null or "title_progress"."sinem_score" between 0 and 10),
	CONSTRAINT "title_progress_position_check" CHECK (("title_progress"."current_season" is null or "title_progress"."current_season" > 0) and ("title_progress"."current_episode" is null or "title_progress"."current_episode" > 0)),
	CONSTRAINT "title_progress_note_length_check" CHECK ("title_progress"."note" is null or char_length("title_progress"."note") <= 2000),
	CONSTRAINT "title_progress_revision_check" CHECK ("title_progress"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_selections" ADD CONSTRAINT "route_selections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_progress" ADD CONSTRAINT "title_progress_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;