import { describe, expect, it, vi } from "vitest"

import {
  createPushSubscriptionHandler,
  createSubscriptionSaver,
} from "../../api/push-subscription"

const session = {
  householdId: "household-rtd",
  memberId: "member-alex",
  memberName: "Alex",
  sessionHash: "session-hash",
}

function request(
  origin = "https://road-to-doomsday.example",
  endpoint = "https://web.push.apple.com/subscription/1"
) {
  return {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: {
      endpoint,
      expirationTime: null,
      keys: { p256dh: "public-key", auth: "auth-secret" },
    },
  } as never
}

function response() {
  let statusCode = 200
  let body: unknown
  const res = {
    setHeader: vi.fn(),
    status(code: number) {
      statusCode = code
      return this
    },
    json(value: unknown) {
      body = value
      return this
    },
    end() {
      return this
    },
  }
  return { res: res as never, status: () => statusCode, body: () => body }
}

describe("/api/push-subscription", () => {
  it("stores the subscription under the member resolved from the magic-link session", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const save = vi.fn().mockResolvedValue(undefined)
    const handler = createPushSubscriptionHandler({
      authorize: vi.fn().mockResolvedValue(session),
      save,
    })
    const result = response()

    await handler(request(), result.res)

    expect(save).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        endpoint: "https://web.push.apple.com/subscription/1",
      })
    )
    expect(result.status()).toBe(201)
  })

  it("does not write without a member session", async () => {
    const save = vi.fn()
    const handler = createPushSubscriptionHandler({
      authorize: vi.fn().mockResolvedValue(null),
      save,
    })
    const result = response()

    await handler(request(), result.res)

    expect(result.status()).toBe(401)
    expect(save).not.toHaveBeenCalled()
  })

  it("rejects cross-origin subscription attempts", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const save = vi.fn()
    const handler = createPushSubscriptionHandler({
      authorize: vi.fn().mockResolvedValue(session),
      save,
    })
    const result = response()

    await handler(request("https://evil.example"), result.res)

    expect(result.status()).toBe(403)
    expect(save).not.toHaveBeenCalled()
  })

  it.each([
    ["Apple Web Push", "https://web.push.apple.com/subscription/1"],
    ["Firebase Cloud Messaging", "https://fcm.googleapis.com/fcm/send/abc123"],
    ["legacy GCM", "https://android.googleapis.com/gcm/send/abc123"],
    ["Mozilla autopush", "https://updates.push.services.mozilla.com/wpush/v2/abc"],
    ["Mozilla apex", "https://push.services.mozilla.com/wpush/v2/abc"],
    ["Windows Notification Service", "https://db5p.notify.windows.com/w/?token=abc"],
  ])("stores a %s endpoint", async (_name, endpoint) => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const save = vi.fn().mockResolvedValue(undefined)
    const handler = createPushSubscriptionHandler({
      authorize: vi.fn().mockResolvedValue(session),
      save,
    })
    const result = response()

    await handler(
      request("https://road-to-doomsday.example", endpoint),
      result.res
    )

    expect(result.status()).toBe(201)
    expect(save).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ endpoint })
    )
  })

  it.each([
    ["an arbitrary HTTPS host", "https://example.com/not-a-push-service"],
    ["a plaintext provider URL", "http://web.push.apple.com/subscription/1"],
    ["IPv4 loopback", "https://127.0.0.1/push"],
    ["IPv6 loopback", "https://[::1]/push"],
    ["an RFC1918 address", "https://192.168.1.10/push"],
    ["link-local cloud metadata", "https://169.254.169.254/latest/meta-data/"],
    ["an internal hostname", "https://localhost/push"],
    ["a provider-lookalike suffix", "https://web.push.apple.com.evil.example/x"],
    ["a provider-lookalike prefix", "https://evil.example/web.push.apple.com"],
    ["credentials smuggled before an allowed host", "https://web.push.apple.com@evil.example/x"],
    ["credentials attached to an allowed host", "https://user:pass@web.push.apple.com/x"],
    ["a non-standard port on an allowed host", "https://web.push.apple.com:8443/x"],
    ["a non-HTTP scheme", "file:///etc/passwd"],
    ["a data URI", "data:text/plain,hello"],
    ["a malformed URL", "https://"],
    ["a bare token", "not-a-url-at-all"],
    ["an empty endpoint", ""],
  ])("rejects %s before storing anything", async (_name, endpoint) => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const save = vi.fn()
    const handler = createPushSubscriptionHandler({
      authorize: vi.fn().mockResolvedValue(session),
      save,
    })
    const result = response()

    await handler(
      request("https://road-to-doomsday.example", endpoint),
      result.res
    )

    expect(result.status()).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })

  it("records the session that registered the subscription", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const sql = async (
      strings: TemplateStringsArray,
      ...params: unknown[]
    ): Promise<Record<string, unknown>[]> => {
      calls.push({
        sql: strings.join("?").replace(/\s+/g, " ").trim().toLowerCase(),
        params,
      })
      return []
    }

    await createSubscriptionSaver(sql)(session, {
      endpoint: "https://web.push.apple.com/subscription/1",
      expirationTime: null,
      keys: { p256dh: "public-key", auth: "auth-secret" },
    })

    const insert = calls[0]
    expect(insert.sql).toContain("session_hash")
    // Assert position, not mere presence: a column/value misalignment that put
    // the session hash in `endpoint` would satisfy a `toContain`.
    expect(insert.params).toEqual([
      expect.any(String), // endpoint_hash
      "household-rtd",
      "member-alex",
      "session-hash",
      "https://web.push.apple.com/subscription/1",
      "public-key",
      "auth-secret",
    ])
    // The session binding must be refreshed when a device re-registers, or a
    // re-subscribe would leave the row pointing at a dead session.
    expect(insert.sql).toMatch(/session_hash\s*=\s*excluded\.session_hash/)
  })

  it("cannot capture a subscription belonging to another household", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const sql = async (
      strings: TemplateStringsArray,
      ...params: unknown[]
    ): Promise<Record<string, unknown>[]> => {
      calls.push({
        sql: strings.join("?").replace(/\s+/g, " ").trim().toLowerCase(),
        params,
      })
      return []
    }

    await createSubscriptionSaver(sql)(session, {
      endpoint: "https://web.push.apple.com/subscription/1",
      expirationTime: null,
      keys: { p256dh: "public-key", auth: "auth-secret" },
    })

    // Knowing another household's endpoint URL must not be enough to move its
    // row into yours — that would redirect their device to your plans.
    expect(calls[0].sql).toMatch(
      /where push_subscriptions\.household_id\s*=\s*excluded\.household_id/
    )
  })

  it("rejects a non-string endpoint without throwing", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const save = vi.fn()
    const handler = createPushSubscriptionHandler({
      authorize: vi.fn().mockResolvedValue(session),
      save,
    })
    const result = response()
    const req = request()
    ;(req as { body: { endpoint: unknown } }).body.endpoint = { href: "x" }

    await handler(req, result.res)

    expect(result.status()).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })
})
