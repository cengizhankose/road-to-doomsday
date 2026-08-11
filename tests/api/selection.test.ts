import { afterEach, describe, expect, it, vi } from "vitest"

import { createSelectionHandler } from "../../api/selection"
import type { VercelRequest, VercelResponse } from "../../api/_lib/types"

const session = {
  householdId: "household-rtd",
  memberId: "member-alex",
  memberName: "Alex",
  sessionHash: "session-hash",
}

function response() {
  let statusCode = 200
  let body: unknown
  const res: VercelResponse = {
    setHeader() {
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
      return this
    },
    end() {
      return this
    },
  }
  return { res, status: () => statusCode, body: () => body }
}

function request(): VercelRequest {
  return {
    method: "PATCH",
    headers: {
      origin: "https://road-to-doomsday.example",
      "content-type": "application/json",
    },
    query: {},
    body: { route: "movies", catalogId: "iron-man" },
  }
}

describe("PATCH /api/selection", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("upserts the manual route choice inside the session household", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const authorize = vi.fn().mockResolvedValue(session)
    const save = vi
      .fn()
      .mockResolvedValue({ route: "movies", catalogId: "iron-man" })
    const handler = createSelectionHandler({ authorize, save })
    const result = response()

    await handler(request(), result.res)

    expect(save).toHaveBeenCalledWith("household-rtd", {
      route: "movies",
      catalogId: "iron-man",
    })
    expect(result.status()).toBe(200)
    expect(result.body()).toEqual({ route: "movies", catalogId: "iron-man" })
  })

  it("rejects route mismatches before touching storage", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.example")
    const save = vi.fn()
    const handler = createSelectionHandler({
      authorize: vi.fn().mockResolvedValue(session),
      save,
    })
    const result = response()
    const req = request()
    req.body = { route: "series", catalogId: "iron-man" }

    await handler(req, result.res)

    expect(result.status()).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })
})
