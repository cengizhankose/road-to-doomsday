import { neon } from "@neondatabase/serverless"
import type { VercelRequest, VercelResponse } from "./_lib/types.js"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"

import { hasSameOrigin, isAuthorized } from "./_lib/auth.js"
import { progressPatchSchema } from "../src/api/contracts.js"
import { titleProgress } from "../src/db/schema.js"

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not configured")
  return drizzle(neon(url))
}

function serialize(row: typeof titleProgress.$inferSelect) {
  return {
    catalogId: row.catalogId,
    status: row.status,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, private")
  res.setHeader("Content-Type", "application/json; charset=utf-8")

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Private link required" })
  }

  const db = database()

  if (req.method === "GET") {
    const rows = await db.select().from(titleProgress)
    return res.status(200).json({ items: rows.map(serialize) })
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH")
    return res.status(405).json({ error: "Method not allowed" })
  }

  if (!hasSameOrigin(req)) {
    return res.status(403).json({ error: "Origin rejected" })
  }

  const contentLength = Number(req.headers["content-length"] ?? 0)
  if (contentLength > 10_000) {
    return res.status(413).json({ error: "Payload too large" })
  }

  const parsed = progressPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid progress", issues: parsed.error.issues })
  }

  const input = parsed.data
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

  let saved: Array<typeof titleProgress.$inferSelect>

  if (input.revision === 0) {
    saved = await db
      .insert(titleProgress)
      .values({ catalogId: input.catalogId, ...values, revision: 1 })
      .onConflictDoNothing()
      .returning()
  } else {
    saved = await db
      .update(titleProgress)
      .set({ ...values, revision: input.revision + 1 })
      .where(
        and(
          eq(titleProgress.catalogId, input.catalogId),
          eq(titleProgress.revision, input.revision),
        ),
      )
      .returning()
  }

  if (saved.length === 0) {
    const [current] = await db
      .select()
      .from(titleProgress)
      .where(eq(titleProgress.catalogId, input.catalogId))
      .limit(1)
    return res.status(409).json({
      error: "Progress changed on another device",
      current: current ? serialize(current) : null,
    })
  }

  return res.status(200).json(serialize(saved[0]))
}
