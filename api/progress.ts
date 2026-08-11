import { neon } from "@neondatabase/serverless"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"

import { hasAllowedOrigin, pushBindingId } from "./_lib/auth.js"
import { notifyPlan } from "./_lib/push.js"
import { authorizeSession, type SessionContext } from "./_lib/session.js"
import type { VercelRequest, VercelResponse } from "./_lib/types.js"
import { progressPatchSchema } from "../src/api/contracts.js"
import { catalog } from "../src/data/catalog.js"
import type { Route } from "../src/domain/catalog.js"
import { catalogImageSchema, type CatalogImage } from "../src/domain/images.js"
import type {
  HouseholdMember,
  ProgressRecord,
  RouteSelections,
} from "../src/domain/progress.js"
import {
  householdMemberSchema,
  watchStatusSchema,
} from "../src/domain/progress.js"
import { members, routeSelections, titleProgress } from "../src/db/schema.js"

type SaveResult = {
  saved: ProgressRecord | null
  current: ProgressRecord | null
}

interface ProgressDependencies {
  authorize(req: VercelRequest): Promise<SessionContext | null>
  list(householdId: string): Promise<ProgressRecord[]>
  getSelections(householdId: string): Promise<RouteSelections>
  listMembers(householdId: string): Promise<HouseholdMember[]>
  listImages?(): Promise<CatalogImage[]>
  save(householdId: string, input: ProgressRecord): Promise<SaveResult>
  notify?(
    context: SessionContext,
    notice: {
      catalogId: string
      title: string
      route: Route
      plannedAt: string
    }
  ): Promise<void>
}

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not configured")
  return drizzle(neon(url))
}

// Postgres hands back `timestamptz` as `2026-08-14 18:00:00+00`, which is not
// the ISO instant the shared progress contract promises the client.
function isoInstant(value: string | null): string | null {
  if (!value) return null
  const withT = value.replace(" ", "T")
  // `+00` is a legal Postgres offset but not a legal ISO one, and a bare
  // timestamp must be read as UTC rather than as the function's local zone.
  const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(withT)
    ? withT
    : /[+-]\d{2}$/.test(withT)
      ? `${withT}:00`
      : `${withT}Z`
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function serializeProgressRow(
  row: typeof titleProgress.$inferSelect
): ProgressRecord {
  return {
    catalogId: row.catalogId,
    status: watchStatusSchema.parse(row.status),
    memberOneScore: row.memberOneScore,
    memberTwoScore: row.memberTwoScore,
    currentSeason: row.currentSeason,
    currentEpisode: row.currentEpisode,
    plannedAt: isoInstant(row.plannedAt),
    watchedOn: row.watchedOn,
    note: row.note,
    revision: row.revision,
  }
}

async function listProgress(householdId: string): Promise<ProgressRecord[]> {
  const rows = await database()
    .select()
    .from(titleProgress)
    .where(eq(titleProgress.householdId, householdId))
  return rows.map((row) => serializeProgressRow(row))
}

async function getSelections(householdId: string): Promise<RouteSelections> {
  const rows = await database()
    .select()
    .from(routeSelections)
    .where(eq(routeSelections.householdId, householdId))
  const selections: RouteSelections = { movies: null, series: null }
  for (const row of rows) {
    if (row.route === "movies" || row.route === "series") {
      selections[row.route] = row.catalogId
    }
  }
  return selections
}

/**
 * The two display names the UI labels its score fields with. A row that does
 * not fit the two-slot contract is dropped rather than guessed at, so a
 * half-migrated household falls back to neutral labels instead of attributing
 * a score to the wrong person.
 */
async function listMembers(householdId: string): Promise<HouseholdMember[]> {
  const rows = await database()
    .select({
      id: members.id,
      name: members.displayName,
      slot: members.slot,
    })
    .from(members)
    .where(eq(members.householdId, householdId))
    .orderBy(members.slot)

  const household: HouseholdMember[] = []
  for (const row of rows) {
    const parsed = householdMemberSchema.safeParse(row)
    if (parsed.success) household.push(parsed.data)
    else console.error("Skipping unusable member row", row.id)
  }
  return household
}

/**
 * One malformed artwork row must not take the whole tracker offline, so rows
 * are validated individually and anything unexpected is simply left out.
 */
export function toCatalogImages(
  rows: Record<string, unknown>[]
): CatalogImage[] {
  const images: CatalogImage[] = []
  for (const row of rows) {
    const parsed = catalogImageSchema.safeParse({
      catalogId: row.catalog_id,
      imageUri: row.image_uri,
      source: row.source,
      sourceId: row.source_id,
      sourcePageUri: row.source_page_uri,
      matchedTitle: row.matched_title,
      matchedYear: row.matched_year,
      lastVerifiedAt: new Date(String(row.last_verified_at)).toISOString(),
    })
    if (parsed.success) images.push(parsed.data)
    else console.error("Skipping unusable catalog image row", row.catalog_id)
  }
  return images
}

async function listCatalogImages(): Promise<CatalogImage[]> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not configured")
  const rows = await neon(url)`
    select
      catalog_id,
      image_uri,
      source,
      source_id,
      source_page_uri,
      matched_title,
      matched_year,
      last_verified_at
    from catalog_images
    order by catalog_id
  `
  return toCatalogImages(rows)
}

async function saveProgress(
  householdId: string,
  input: ProgressRecord
): Promise<SaveResult> {
  const db = database()
  const values = {
    status: input.status,
    memberOneScore: input.memberOneScore ?? null,
    memberTwoScore: input.memberTwoScore ?? null,
    currentSeason: input.currentSeason ?? null,
    currentEpisode: input.currentEpisode ?? null,
    plannedAt: input.plannedAt || null,
    watchedOn: input.watchedOn || null,
    note: input.note || null,
    updatedAt: new Date().toISOString(),
  }

  const rows =
    input.revision === 0
      ? await db
          .insert(titleProgress)
          .values({
            householdId,
            catalogId: input.catalogId,
            ...values,
            revision: 1,
          })
          .onConflictDoNothing()
          .returning()
      : await db
          .update(titleProgress)
          .set({ ...values, revision: input.revision + 1 })
          .where(
            and(
              eq(titleProgress.householdId, householdId),
              eq(titleProgress.catalogId, input.catalogId),
              eq(titleProgress.revision, input.revision)
            )
          )
          .returning()

  if (rows[0]) return { saved: serializeProgressRow(rows[0]), current: null }

  const [current] = await db
    .select()
    .from(titleProgress)
    .where(
      and(
        eq(titleProgress.householdId, householdId),
        eq(titleProgress.catalogId, input.catalogId)
      )
    )
    .limit(1)

  return { saved: null, current: current ? serializeProgressRow(current) : null }
}

const defaultDependencies: ProgressDependencies = {
  authorize: authorizeSession,
  list: listProgress,
  getSelections,
  listMembers,
  listImages: listCatalogImages,
  save: saveProgress,
  notify: notifyPlan,
}

export function createProgressHandler(
  dependencies: ProgressDependencies = defaultDependencies
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0")
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Vary", "Cookie")

    const context = await dependencies.authorize(req)
    if (!context) {
      return res.status(401).json({ error: "Private link required" })
    }
    const { householdId } = context

    if (req.method === "GET") {
      const [items, selections, householdMembers, images] = await Promise.all([
        dependencies.list(householdId),
        dependencies.getSelections(householdId),
        dependencies.listMembers(householdId),
        dependencies.listImages?.() ?? Promise.resolve([]),
      ])
      return res.status(200).json({
        items,
        selections,
        images,
        member: { id: context.memberId, name: context.memberName },
        members: householdMembers,
        push: {
          publicKey: process.env.VAPID_PUBLIC_KEY || null,
          bindingId: pushBindingId(context.sessionHash),
        },
      })
    }

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, PATCH")
      return res.status(405).json({ error: "Method not allowed" })
    }

    if (!hasAllowedOrigin(req)) {
      return res.status(403).json({ error: "Origin rejected" })
    }

    const contentType = req.headers["content-type"]
    if (
      typeof contentType !== "string" ||
      !contentType.toLowerCase().startsWith("application/json")
    ) {
      return res.status(415).json({ error: "JSON required" })
    }

    const declaredLength = Number(req.headers["content-length"] ?? 0)
    const actualLength = Buffer.byteLength(
      JSON.stringify(req.body ?? null),
      "utf8"
    )
    if (declaredLength > 10_000 || actualLength > 10_000) {
      return res.status(413).json({ error: "Payload too large" })
    }

    const parsed = progressPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid progress" })
    }

    const result = await dependencies.save(householdId, parsed.data)
    if (!result.saved) {
      return res.status(409).json({
        error: "revision_conflict",
        current: result.current,
      })
    }

    if (
      req.headers["x-rtd-notify-plan"] === "1" &&
      result.saved.status === "planned" &&
      result.saved.plannedAt
    ) {
      const item = catalog.find((entry) => entry.id === result.saved?.catalogId)
      if (item && dependencies.notify) {
        try {
          await dependencies.notify(context, {
            catalogId: item.id,
            title: item.title,
            route: item.route,
            plannedAt: result.saved.plannedAt,
          })
        } catch (error) {
          console.error("Plan notification failed", error)
        }
      }
    }

    return res.status(200).json(result.saved)
  }
}

export default createProgressHandler()
