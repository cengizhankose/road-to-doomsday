import { afterEach, describe, expect, it, vi } from "vitest"

import { createJoinHandler } from "../../api/join"
import type { VercelRequest, VercelResponse } from "../../api/_lib/types"

function request(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: "POST",
    headers: {
      origin: "https://road-to-doomsday.example",
      "content-type": "application/json",
      "content-length": "60",
    },
    query: {},
    body: { token: "0123456789abcdef0123456789abcdef" },
    ...overrides,
  }
}

function response() {
  const headers = new Map<string, string | string[]>()
  let statusCode = 200
  let body: unknown
  const res: VercelResponse = {
    setHeader(name, value) {
      headers.set(name, value)
      return this
    },
    status(code) {
      statusCode = code
      return this
    },
    json(value) {
      body = value
      return this
    },
    redirect() {
      throw new Error("join must not redirect with a credential in the URL")
    },
    end() {
      return this
    },
  }
  return { res, headers, getStatus: () => statusCode, getBody: () => body }
}

describe("POST /api/join", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("exchanges a single-use invite for an independent strict session cookie", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const exchangeInvite = vi.fn().mockResolvedValue("opaque-session-token")
    const handler = createJoinHandler(exchangeInvite)
    const result = response()

    await handler(request(), result.res)

    expect(exchangeInvite).toHaveBeenCalledWith(
      "0123456789abcdef0123456789abcdef"
    )
    expect(result.getStatus()).toBe(204)
    expect(result.headers.get("Set-Cookie")).toContain(
      "__Host-rtd_session=opaque-session-token"
    )
    expect(result.headers.get("Set-Cookie")).not.toContain(
      "0123456789abcdef0123456789abcdef"
    )
  })

  it.each([
    ["wrong method", request({ method: "GET" }), 405],
    [
      "missing origin",
      request({ headers: { "content-type": "application/json" } }),
      403,
    ],
    [
      "wrong content type",
      request({
        headers: {
          origin: "https://road-to-doomsday.example",
          "content-type": "text/plain",
        },
      }),
      415,
    ],
    [
      "oversized body",
      request({
        headers: {
          origin: "https://road-to-doomsday.example",
          "content-type": "application/json",
          "content-length": "10001",
        },
      }),
      413,
    ],
    ["short token", request({ body: { token: "short" } }), 400],
  ])("rejects %s", async (_name, req, status) => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const exchangeInvite = vi.fn()
    const handler = createJoinHandler(exchangeInvite)
    const result = response()

    await handler(req as VercelRequest, result.res)

    expect(result.getStatus()).toBe(status)
    expect(exchangeInvite).not.toHaveBeenCalled()
  })
})
