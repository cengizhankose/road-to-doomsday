import { neon } from "@neondatabase/serverless"

import { hashToken, readSessionToken } from "./auth.js"
import type { VercelRequest } from "./types.js"

export interface SessionContext {
  householdId: string
  memberId: string
  memberName: string
  sessionHash: string
}

type SessionIdentity = Omit<SessionContext, "sessionHash">
type SessionLookup = (sessionHash: string) => Promise<SessionIdentity | null>

async function lookupSession(
  sessionHash: string
): Promise<SessionIdentity | null> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured")

  const sql = neon(databaseUrl)
  const rows = await sql`
    select
      sessions.household_id,
      sessions.member_id,
      members.display_name
    from sessions
    inner join members
      on members.id = sessions.member_id
      and members.household_id = sessions.household_id
    where sessions.session_hash = ${sessionHash}
      and sessions.expires_at > now()
    limit 1
  `
  const row = rows[0]
  return typeof row?.household_id === "string" &&
    typeof row.member_id === "string" &&
    typeof row.display_name === "string"
    ? {
        householdId: row.household_id,
        memberId: row.member_id,
        memberName: row.display_name,
      }
    : null
}

export function createSessionAuthorizer(lookup: SessionLookup = lookupSession) {
  return async function authorizeSession(
    req: VercelRequest
  ): Promise<SessionContext | null> {
    const token = readSessionToken(req)
    if (!token) return null

    const sessionHash = hashToken(token)
    const identity = await lookup(sessionHash)
    return identity ? { ...identity, sessionHash } : null
  }
}

export const authorizeSession = createSessionAuthorizer()
