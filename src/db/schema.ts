import { sql } from "drizzle-orm"
import {
  check,
  date,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const titleProgress = pgTable(
  "title_progress",
  {
    catalogId: text("catalog_id").primaryKey(),
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
  ],
)
