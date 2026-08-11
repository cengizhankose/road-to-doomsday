CREATE TABLE "catalog_images" (
	"catalog_id" text PRIMARY KEY NOT NULL,
	"image_uri" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"source_page_uri" text NOT NULL,
	"matched_title" text NOT NULL,
	"matched_year" integer NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_household_display_name_unique" UNIQUE("household_id","display_name")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint_hash" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"member_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "members" ("id", "household_id", "display_name")
SELECT "id" || ':cengizhan', "id", 'Cengizhan' FROM "households";--> statement-breakpoint
INSERT INTO "members" ("id", "household_id", "display_name")
SELECT "id" || ':sinem', "id", 'Sinem' FROM "households";--> statement-breakpoint
DELETE FROM "sessions";--> statement-breakpoint
DELETE FROM "invites";--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "member_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "member_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;