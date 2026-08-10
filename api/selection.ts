import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import type { z } from "zod"

import { hasAllowedOrigin } from "./_lib/auth.js"
import { authorizeSession } from "./_lib/session.js"
import type { VercelRequest, VercelResponse } from "./_lib/types.js"
import { selectionPatchSchema } from "../src/api/contracts.js"
import { routeSelections } from "../src/db/schema.js"

type SelectionInput = z.infer<typeof selectionPatchSchema>

interface SelectionDependencies {
  authorize(req: VercelRequest): Promise<string | null>
  save(householdId: string, selection: SelectionInput): Promise<SelectionInput>
}

async function saveSelection(
  householdId: string,
  selection: SelectionInput,
): Promise<SelectionInput> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not configured")
  const db = drizzle(neon(url))
  const [saved] = await db
    .insert(routeSelections)
    .values({
      householdId,
      route: selection.route,
      catalogId: selection.catalogId,
    })
    .onConflictDoUpdate({
      target: [routeSelections.householdId, routeSelections.route],
      set: {
        catalogId: selection.catalogId,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning()

  return { route: saved.route as SelectionInput["route"], catalogId: saved.catalogId }
}

const defaultDependencies: SelectionDependencies = {
  authorize: authorizeSession,
  save: saveSelection,
}

export function createSelectionHandler(
  dependencies: SelectionDependencies = defaultDependencies,
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0")
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Vary", "Cookie")

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "PATCH")
      return res.status(405).json({ error: "Method not allowed" })
    }

    const householdId = await dependencies.authorize(req)
    if (!householdId) {
      return res.status(401).json({ error: "Private link required" })
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
    if (declaredLength > 2_000 || actualLength > 2_000) {
      return res.status(413).json({ error: "Payload too large" })
    }

    const parsed = selectionPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid selection" })
    }

    const saved = await dependencies.save(householdId, parsed.data)
    return res.status(200).json(saved)
  }
}

export default createSelectionHandler()
