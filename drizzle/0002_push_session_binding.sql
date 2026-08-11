--> Subscriptions registered before session binding cannot be attributed to a
--> session, so there is no honest value for the new column and no way to know
--> whether the device that owns them is still authorised. They are dropped;
--> each device re-registers silently the next time its owner opens the app.
--> This also makes the NOT NULL column add safe whatever the table holds.
DELETE FROM "push_subscriptions";--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "session_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_session_hash_sessions_session_hash_fk" FOREIGN KEY ("session_hash") REFERENCES "public"."sessions"("session_hash") ON DELETE cascade ON UPDATE no action;
