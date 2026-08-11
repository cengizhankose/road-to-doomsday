import { createHash } from "node:crypto"

import { neon } from "@neondatabase/serverless"
import { z } from "zod"

import { hasAllowedOrigin } from "./_lib/auth.js"
import { authorizeSession, type SessionContext } from "./_lib/session.js"
import type { VercelRequest, VercelResponse } from "./_lib/types.js"

// A push endpoint is a URL this server later makes outbound requests to, so it
// is only ever accepted when it belongs to a real Web Push provider. Anything
// else — private ranges, cloud metadata, lookalike hosts — is a stored SSRF.
const pushProviderHosts = new Set([
  "web.push.apple.com",
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
])

const pushProviderSuffixes = [
  ".push.services.mozilla.com",
  ".notify.windows.com",
]

function isAllowedPushEndpoint(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (url.protocol !== "https:") return false
  // Credentials in the authority are only ever there to confuse a reader about
  // which host is really being contacted.
  if (url.username || url.password) return false
  if (url.port) return false

  const host = url.hostname.toLowerCase()
  return (
    pushProviderHosts.has(host) ||
    pushProviderSuffixes.some((suffix) => host.endsWith(suffix))
  )
}

const pushSubscriptionSchema = z
  .object({
    endpoint: z.string().max(2_048).refine(isAllowedPushEndpoint),
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().min(1).max(512),
        auth: z.string().min(1).max(512),
      })
      .strict(),
  })
  .strict()

type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

interface PushSubscriptionDependencies {
  authorize(req: VercelRequest): Promise<SessionContext | null>
  save(context: SessionContext, input: PushSubscriptionInput): Promise<void>
}

async function saveSubscription(
  context: SessionContext,
  input: PushSubscriptionInput
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured")
  const endpointHash = createHash("sha256").update(input.endpoint).digest("hex")
  const sql = neon(databaseUrl)
  await sql`
    insert into push_subscriptions (
      endpoint_hash,
      household_id,
      member_id,
      endpoint,
      p256dh,
      auth,
      updated_at
    ) values (
      ${endpointHash},
      ${context.householdId},
      ${context.memberId},
      ${input.endpoint},
      ${input.keys.p256dh},
      ${input.keys.auth},
      now()
    )
    on conflict (endpoint_hash) do update set
      household_id = excluded.household_id,
      member_id = excluded.member_id,
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = now()
  `
}

const defaultDependencies: PushSubscriptionDependencies = {
  authorize: authorizeSession,
  save: saveSubscription,
}

export function createPushSubscriptionHandler(
  dependencies: PushSubscriptionDependencies = defaultDependencies
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0")
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Vary", "Cookie")

    const context = await dependencies.authorize(req)
    if (!context)
      return res.status(401).json({ error: "Private link required" })

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST")
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

    const parsed = pushSubscriptionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid push subscription" })
    }

    await dependencies.save(context, parsed.data)
    return res.status(201).json({ ok: true })
  }
}

export default createPushSubscriptionHandler()
