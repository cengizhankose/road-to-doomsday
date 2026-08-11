import { describe, expect, it, vi } from "vitest"

import { createPlanNotifier, createRecipientLister } from "../../../api/_lib/push"

/** Captures a Neon tagged-template query so its SQL and parameters can be asserted. */
function capturingSql(rows: Record<string, unknown>[] = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const sql = async (
    strings: TemplateStringsArray,
    ...params: unknown[]
  ): Promise<Record<string, unknown>[]> => {
    calls.push({
      sql: strings.join("?").replace(/\s+/g, " ").trim().toLowerCase(),
      params,
    })
    return rows
  }
  return { sql, calls }
}

const context = {
  householdId: "household-rtd",
  memberId: "member-alex",
  memberName: "Alex",
  sessionHash: "session-hash",
}

const recipient = {
  endpointHash: "endpoint-hash",
  endpoint: "https://push.example.test/sam",
  p256dh: "public-key",
  auth: "auth-secret",
}

describe("plan push notifications", () => {
  it("sends the plan only to subscriptions belonging to the other member", async () => {
    const listRecipients = vi.fn().mockResolvedValue([recipient])
    const deliver = vi.fn().mockResolvedValue(undefined)
    const notifier = createPlanNotifier({
      listRecipients,
      deliver,
      remove: vi.fn(),
    })

    await notifier(context, {
      catalogId: "iron-man",
      title: "Iron Man",
      route: "movies",
      plannedAt: "2026-08-14T18:00:00.000Z",
    })

    expect(listRecipients).toHaveBeenCalledWith(
      "household-rtd",
      "member-alex"
    )
    const payload = JSON.parse(deliver.mock.calls[0][1])
    expect(payload).toEqual({
      title: "Alex planned Iron Man",
      plannedAt: "2026-08-14T18:00:00.000Z",
      tag: "plan-iron-man-2026-08-14T18:00:00.000Z",
      url: "/movies/iron-man",
    })
  })

  it("only considers subscriptions whose registering session is still valid", async () => {
    const { sql, calls } = capturingSql([
      {
        endpoint_hash: "endpoint-hash",
        endpoint: recipient.endpoint,
        p256dh: recipient.p256dh,
        auth: recipient.auth,
      },
    ])

    const recipients = await createRecipientLister(sql)(
      "household-rtd",
      "member-alex"
    )

    expect(recipients).toEqual([recipient])
    const query = calls[0].sql

    // The subscription is only eligible while the exact session that
    // registered it is still present and unexpired.
    expect(query).toMatch(/from push_subscriptions join sessions/)
    expect(query).toMatch(/sessions\.session_hash\s*=\s*push_subscriptions\.session_hash/)

    // An outer join would re-admit subscriptions with no session at all, and
    // would also neutralise an expiry predicate moved into the ON clause —
    // both restore exactly the hole this query exists to close.
    expect(query).not.toMatch(/left\s+join|right\s+join|full\s+join/)
    const [, whereClause = ""] = query.split(/\bwhere\b/)
    expect(whereClause).toMatch(/sessions\.expires_at\s*>\s*now\(\)/)

    // ...and it stays scoped to the household, excluding the sender.
    expect(query).toMatch(/push_subscriptions\.household_id\s*=\s*\?/)
    expect(query).toMatch(/push_subscriptions\.member_id\s*<>\s*\?/)
    expect(calls[0].params).toEqual(["household-rtd", "member-alex"])
  })

  it("does not let a session vouch for another member's or household's subscription", async () => {
    const { sql, calls } = capturingSql()

    await createRecipientLister(sql)("household-rtd", "member-alex")
    const query = calls[0].sql

    expect(query).toMatch(/sessions\.household_id\s*=\s*push_subscriptions\.household_id/)
    expect(query).toMatch(/sessions\.member_id\s*=\s*push_subscriptions\.member_id/)
  })

  it("removes subscriptions rejected as gone", async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const notifier = createPlanNotifier({
      listRecipients: vi.fn().mockResolvedValue([recipient]),
      deliver: vi.fn().mockRejectedValue({ statusCode: 410 }),
      remove,
    })

    await notifier(context, {
      catalogId: "iron-man",
      title: "Iron Man",
      route: "movies",
      plannedAt: "2026-08-14T18:00:00.000Z",
    })

    expect(remove).toHaveBeenCalledWith("endpoint-hash")
  })
})
