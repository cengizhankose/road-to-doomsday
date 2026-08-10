import { neon } from "@neondatabase/serverless"

import { hashToken, readSessionToken } from "./auth.js"
import type { VercelRequest } from "./types.js"

type SessionLookup = (sessionHash: string) => Promise<string | null>

async function lookupSession(sessionHash: string): Promise<string | null> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured")

  const sql = neon(databaseUrl)
  const rows = await sql`
    select household_id
    from sessions
    where session_hash = ${sessionHash}
      and expires_at > now()
    limit 1
  `
  const householdId = rows[0]?.household_id
  return typeof householdId === "string" ? householdId : null
}

export function createSessionAuthorizer(lookup: SessionLookup = lookupSession) {
  return async function authorizeSession(req: VercelRequest): Promise<string | null> {
    const token = readSessionToken(req)
    return token ? lookup(hashToken(token)) : null
  }
}

export const authorizeSession = createSessionAuthorizer()
