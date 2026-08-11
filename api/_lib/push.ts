import { neon } from "@neondatabase/serverless"
import webpush from "web-push"

import type { Route } from "../../src/domain/catalog.js"
import type { SessionContext } from "./session.js"

interface PushRecipient {
  endpointHash: string
  endpoint: string
  p256dh: string
  auth: string
}

interface PlanNotice {
  catalogId: string
  title: string
  route: Route
  plannedAt: string
}

interface PlanNotifierDependencies {
  listRecipients(
    householdId: string,
    excludedMemberId: string
  ): Promise<PushRecipient[]>
  deliver(recipient: PushRecipient, payload: string): Promise<unknown>
  remove(endpointHash: string): Promise<void>
}

/** A Neon tagged-template query runner, injectable so queries stay testable. */
export type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>

function databaseUrl() {
  const value = process.env.DATABASE_URL
  if (!value) throw new Error("DATABASE_URL is not configured")
  return value
}

/**
 * A push subscription is only ever a delivery address for one live session.
 *
 * Joining the session it was registered under means a revoked session (row
 * deleted, cascading the subscription away) and an expired one (row still
 * present, `expires_at` in the past) both stop being notified, without any
 * cleanup job standing between de-authorisation and effect.
 */
export function createRecipientLister(sql: SqlExecutor) {
  return async function listRecipients(
    householdId: string,
    excludedMemberId: string
  ): Promise<PushRecipient[]> {
    const rows = await sql`
      select
        push_subscriptions.endpoint_hash,
        push_subscriptions.endpoint,
        push_subscriptions.p256dh,
        push_subscriptions.auth
      from push_subscriptions
      join sessions
        on sessions.session_hash = push_subscriptions.session_hash
        and sessions.household_id = push_subscriptions.household_id
        and sessions.member_id = push_subscriptions.member_id
      where push_subscriptions.household_id = ${householdId}
        and push_subscriptions.member_id <> ${excludedMemberId}
        and sessions.expires_at > now()
    `
    return rows.map((row) => ({
      endpointHash: String(row.endpoint_hash),
      endpoint: String(row.endpoint),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
    }))
  }
}

async function deliver(recipient: PushRecipient, payload: string) {
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID configuration is incomplete")
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return webpush.sendNotification(
    {
      endpoint: recipient.endpoint,
      keys: { p256dh: recipient.p256dh, auth: recipient.auth },
    },
    payload
  )
}

async function remove(endpointHash: string): Promise<void> {
  const sql = neon(databaseUrl())
  await sql`delete from push_subscriptions where endpoint_hash = ${endpointHash}`
}

const defaultDependencies: PlanNotifierDependencies = {
  listRecipients: (householdId, excludedMemberId) =>
    createRecipientLister(neon(databaseUrl()) as SqlExecutor)(
      householdId,
      excludedMemberId
    ),
  deliver,
  remove,
}

function statusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error))
    return null
  const value = (error as { statusCode?: unknown }).statusCode
  return typeof value === "number" ? value : null
}

export function createPlanNotifier(
  dependencies: PlanNotifierDependencies = defaultDependencies
) {
  return async function notifyPlan(
    context: SessionContext,
    notice: PlanNotice
  ) {
    const recipients = await dependencies.listRecipients(
      context.householdId,
      context.memberId
    )
    const payload = JSON.stringify({
      title: `${context.memberName} planned ${notice.title}`,
      plannedAt: notice.plannedAt,
      tag: `plan-${notice.catalogId}-${notice.plannedAt}`,
      url: `/${notice.route}/${notice.catalogId}`,
    })

    await Promise.all(
      recipients.map(async (recipient) => {
        try {
          await dependencies.deliver(recipient, payload)
        } catch (error) {
          const status = statusCode(error)
          if (status === 404 || status === 410) {
            await dependencies.remove(recipient.endpointHash)
            return
          }
          // Anything else — a missing VAPID key, a rotated key pair, a
          // provider outage — must not vanish, or notifications simply stop
          // arriving with nothing to explain why.
          console.error("Push delivery failed", {
            endpointHash: recipient.endpointHash,
            statusCode: status,
            reason: error instanceof Error ? error.message : String(error),
          })
        }
      })
    )
  }
}

export const notifyPlan = createPlanNotifier()
