--> This migration finishes the move from a two-person private tracker to a
--> generic two-member one. Both halves are written to be no-ops on a database
--> that is already generic, so a clean install and an upgrade converge on the
--> same schema.

--> The first deployments named the two score columns after the two people who
--> used them. Rename them in place: the data is the same, only the identifier
--> stops being personal. A database created from the current migration set
--> already has the generic names and skips every branch below. Postgres
--> rewrites a CHECK expression when its column is renamed, so only the
--> constraint *names* need a separate rename.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'title_progress' AND column_name = 'cengizhan_score'
	) THEN
		ALTER TABLE "title_progress" RENAME COLUMN "cengizhan_score" TO "member_one_score";
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'title_progress' AND column_name = 'sinem_score'
	) THEN
		ALTER TABLE "title_progress" RENAME COLUMN "sinem_score" TO "member_two_score";
	END IF;

	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'title_progress_cengizhan_score_check'
			AND conrelid = 'title_progress'::regclass
	) THEN
		ALTER TABLE "title_progress" RENAME CONSTRAINT "title_progress_cengizhan_score_check" TO "title_progress_member_one_score_check";
	END IF;

	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'title_progress_sinem_score_check'
			AND conrelid = 'title_progress'::regclass
	) THEN
		ALTER TABLE "title_progress" RENAME CONSTRAINT "title_progress_sinem_score_check" TO "title_progress_member_two_score_check";
	END IF;
END $$;--> statement-breakpoint

--> `slot` is what ties a member to one of those two score columns. Existing
--> members are numbered by creation order, which is the order the seed in
--> `0001` inserted them and therefore the order the score columns already
--> followed. The column is added nullable, backfilled, and only then made NOT
--> NULL, so a household that already has members survives the add.
ALTER TABLE "members" ADD COLUMN "slot" smallint;--> statement-breakpoint
UPDATE "members" SET "slot" = "ranked"."rank"
FROM (
	SELECT "id", row_number() OVER (
		PARTITION BY "household_id" ORDER BY "created_at", "id"
	) AS "rank"
	FROM "members"
) AS "ranked"
WHERE "members"."id" = "ranked"."id" AND "members"."slot" IS NULL;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "slot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_slot_unique" UNIQUE("household_id","slot");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_slot_check" CHECK ("members"."slot" in (1, 2));
