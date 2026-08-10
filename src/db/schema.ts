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
} from "drizzle-orm/pg-core"

export const households = pgTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
})

export const invites = pgTable("invites", {
  tokenHash: text("token_hash").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
})

export const sessions = pgTable("sessions", {
  sessionHash: text("session_hash").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
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
    check("route_selections_route_check", sql`${table.route} in ('movies', 'series')`),
  ],
)

export const titleProgress = pgTable(
  "title_progress",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    catalogId: text("catalog_id").notNull(),
    status: text("status").notNull(),
    cengizhanScore: smallint("cengizhan_score"),
    sinemScore: smallint("sinem_score"),
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
      sql`${table.status} in ('not_started', 'planned', 'watching', 'watched', 'skipped')`,
    ),
    check(
      "title_progress_cengizhan_score_check",
      sql`${table.cengizhanScore} is null or ${table.cengizhanScore} between 0 and 10`,
    ),
    check(
      "title_progress_sinem_score_check",
      sql`${table.sinemScore} is null or ${table.sinemScore} between 0 and 10`,
    ),
    check(
      "title_progress_position_check",
      sql`(${table.currentSeason} is null or ${table.currentSeason} > 0) and (${table.currentEpisode} is null or ${table.currentEpisode} > 0)`,
    ),
    check(
      "title_progress_note_length_check",
      sql`${table.note} is null or char_length(${table.note}) <= 2000`,
    ),
    check("title_progress_revision_check", sql`${table.revision} >= 1`),
  ],
)
