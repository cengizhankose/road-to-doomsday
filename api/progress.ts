import { neon } from "@neondatabase/serverless"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"

import { hasAllowedOrigin } from "./_lib/auth.js"
import { authorizeSession } from "./_lib/session.js"
import type { VercelRequest, VercelResponse } from "./_lib/types.js"
import { progressPatchSchema } from "../src/api/contracts.js"
import type { ProgressRecord, RouteSelections } from "../src/domain/progress.js"
import { watchStatusSchema } from "../src/domain/progress.js"
import { routeSelections, titleProgress } from "../src/db/schema.js"

type SaveResult = {
  saved: ProgressRecord | null
  current: ProgressRecord | null
}

interface ProgressDependencies {
  authorize(req: VercelRequest): Promise<string | null>
  list(householdId: string): Promise<ProgressRecord[]>
  getSelections(householdId: string): Promise<RouteSelections>
  save(householdId: string, input: ProgressRecord): Promise<SaveResult>
}

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not configured")
  return drizzle(neon(url))
}

function serialize(row: typeof titleProgress.$inferSelect): ProgressRecord {
  return {
    catalogId: row.catalogId,
    status: watchStatusSchema.parse(row.status),
    cengizhanScore: row.cengizhanScore,
    sinemScore: row.sinemScore,
    currentSeason: row.currentSeason,
    currentEpisode: row.currentEpisode,
    plannedAt: row.plannedAt,
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
  return rows.map(serialize)
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

async function saveProgress(
  householdId: string,
  input: ProgressRecord,
): Promise<SaveResult> {
  const db = database()
  const values = {
    status: input.status,
    cengizhanScore: input.cengizhanScore ?? null,
    sinemScore: input.sinemScore ?? null,
    currentSeason: input.currentSeason ?? null,
    currentEpisode: input.currentEpisode ?? null,
    plannedAt: input.plannedAt || null,
    watchedOn: input.watchedOn || null,
    note: input.note || null,
    updatedAt: new Date().toISOString(),
  }

  const rows = input.revision === 0
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
            eq(titleProgress.revision, input.revision),
          ),
        )
        .returning()

  if (rows[0]) return { saved: serialize(rows[0]), current: null }

  const [current] = await db
    .select()
    .from(titleProgress)
    .where(
      and(
        eq(titleProgress.householdId, householdId),
        eq(titleProgress.catalogId, input.catalogId),
      ),
    )
    .limit(1)

  return { saved: null, current: current ? serialize(current) : null }
}

const defaultDependencies: ProgressDependencies = {
  authorize: authorizeSession,
  list: listProgress,
  getSelections,
  save: saveProgress,
}

export function createProgressHandler(
  dependencies: ProgressDependencies = defaultDependencies,
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0")
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Vary", "Cookie")

    const householdId = await dependencies.authorize(req)
    if (!householdId) {
      return res.status(401).json({ error: "Private link required" })
    }

    if (req.method === "GET") {
      const [items, selections] = await Promise.all([
        dependencies.list(householdId),
        dependencies.getSelections(householdId),
      ])
      return res.status(200).json({ items, selections })
    }

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, PATCH")
      return res.status(405).json({ error: "Method not allowed" })
    }

    if (!hasAllowedOrigin(req)) {
      return res.status(403).json({ error: "Origin rejected" })
    }

    const contentType = req.headers["content-type"]
    if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/json")) {
      return res.status(415).json({ error: "JSON required" })
    }

    const declaredLength = Number(req.headers["content-length"] ?? 0)
    const actualLength = Buffer.byteLength(JSON.stringify(req.body ?? null), "utf8")
    if (declaredLength > 10_000 || actualLength > 10_000) {
      return res.status(413).json({ error: "Payload too large" })
    }

    const parsed = progressPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid progress" })
    }

    const result = await dependencies.save(
      householdId,
      parsed.data,
    )
    if (!result.saved) {
      return res.status(409).json({
        error: "revision_conflict",
        current: result.current,
      })
    }

    return res.status(200).json(result.saved)
  }
}

export default createProgressHandler()
