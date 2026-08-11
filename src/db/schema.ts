import { sql } from "drizzle-orm"
import {
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

export const households = pgTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
})

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    // Which of the two score columns on `title_progress` belongs to this
    // member. Storing it beats deriving it from insertion order: a member who
    // is renamed or recreated must keep the scores they already gave.
    slot: smallint("slot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("members_household_display_name_unique").on(
      table.householdId,
      table.displayName
    ),
    unique("members_household_slot_unique").on(table.householdId, table.slot),
    check("members_slot_check", sql`${table.slot} in (1, 2)`),
  ]
)

export const invites = pgTable("invites", {
  tokenHash: text("token_hash").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
})

export const sessions = pgTable("sessions", {
  sessionHash: text("session_hash").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
})

export const catalogImages = pgTable("catalog_images", {
  catalogId: text("catalog_id").primaryKey(),
  imageUri: text("image_uri").notNull(),
  source: text("source").notNull(),
  sourceId: text("source_id").notNull(),
  sourcePageUri: text("source_page_uri").notNull(),
  matchedTitle: text("matched_title").notNull(),
  matchedYear: integer("matched_year").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
})

export const pushSubscriptions = pgTable("push_subscriptions", {
  endpointHash: text("endpoint_hash").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  // The subscription lives and dies with the session that registered it, so a
  // revoked or expired magic-link session cannot keep receiving notifications.
  // Not unique: a member may hold several sessions, each with its own device.
  sessionHash: text("session_hash")
    .notNull()
    .references(() => sessions.sessionHash, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
})

export const routeSelections = pgTable(
  "route_selections",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    route: text("route").notNull(),
    catalogId: text("catalog_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "route_selections_household_route_pk",
      columns: [table.householdId, table.route],
    }),
    check(
      "route_selections_route_check",
      sql`${table.route} in ('movies', 'series')`
    ),
  ]
)

export const titleProgress = pgTable(
  "title_progress",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    catalogId: text("catalog_id").notNull(),
    status: text("status").notNull(),
    memberOneScore: smallint("member_one_score"),
    memberTwoScore: smallint("member_two_score"),
    currentSeason: smallint("current_season"),
    currentEpisode: smallint("current_episode"),
    plannedAt: timestamp("planned_at", { withTimezone: true, mode: "string" }),
    watchedOn: date("watched_on", { mode: "string" }),
    note: text("note"),
    revision: integer("revision").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "title_progress_household_catalog_pk",
      columns: [table.householdId, table.catalogId],
    }),
    check(
      "title_progress_status_check",
      sql`${table.status} in ('not_started', 'planned', 'watching', 'watched', 'skipped')`
    ),
    check(
      "title_progress_member_one_score_check",
      sql`${table.memberOneScore} is null or ${table.memberOneScore} between 0 and 10`
    ),
    check(
      "title_progress_member_two_score_check",
      sql`${table.memberTwoScore} is null or ${table.memberTwoScore} between 0 and 10`
    ),
    check(
      "title_progress_position_check",
      sql`(${table.currentSeason} is null or ${table.currentSeason} > 0) and (${table.currentEpisode} is null or ${table.currentEpisode} > 0)`
    ),
    check(
      "title_progress_note_length_check",
      sql`${table.note} is null or char_length(${table.note}) <= 2000`
    ),
    check("title_progress_revision_check", sql`${table.revision} >= 1`),
  ]
)
