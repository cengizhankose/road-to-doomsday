import { neon } from "@neondatabase/serverless"
import { z } from "zod"

import {
  createSessionToken,
  hasAllowedOrigin,
  hashToken,
  sessionCookie,
} from "./_lib/auth.js"
import type { VercelRequest, VercelResponse } from "./_lib/types.js"

const inviteSchema = z.object({ token: z.string().min(22).max(256) }).strict()

type ExchangeInvite = (inviteToken: string) => Promise<string | null>

async function exchangeInvite(inviteToken: string): Promise<string | null> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured")

  const sessionToken = createSessionToken()
  const sessionHash = hashToken(sessionToken)
  const inviteHash = hashToken(inviteToken)
  const sql = neon(databaseUrl)
  const rows = await sql`
    with consumed as (
      delete from invites
      where token_hash = ${inviteHash}
        and expires_at > now()
      returning household_id
    )
    insert into sessions (session_hash, household_id, expires_at)
    select ${sessionHash}, household_id, now() + interval '30 days'
    from consumed
    returning session_hash
  `

  return rows.length === 1 ? sessionToken : null
}

export function createJoinHandler(exchange: ExchangeInvite = exchangeInvite) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0")
    res.setHeader("Referrer-Policy", "no-referrer")
    res.setHeader("Vary", "Cookie")

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST")
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

    const parsed = inviteSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" })
    }

    const sessionToken = await exchange(parsed.data.token)
    if (!sessionToken) {
      return res.status(401).json({ error: "Invite unavailable" })
    }

    res.setHeader("Set-Cookie", sessionCookie(sessionToken))
    return res.status(204).end()
  }
}

export default createJoinHandler()
