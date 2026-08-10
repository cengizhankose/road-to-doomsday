import { afterEach, describe, expect, it, vi } from "vitest"

import { createProgressHandler } from "./progress"
import type { ProgressRecord } from "../src/domain/progress"
import type { VercelRequest, VercelResponse } from "./_lib/types"

const record: ProgressRecord = {
  catalogId: "iron-man",
  status: "watched",
  cengizhanScore: 8,
  sinemScore: null,
  currentSeason: null,
  currentEpisode: null,
  plannedAt: null,
  watchedOn: "2026-08-10",
  note: null,
  revision: 1,
}

function request(method: string, body?: unknown): VercelRequest {
  return {
    method,
    headers: {
      origin: "https://road-to-doomsday.vercel.app",
      "content-type": "application/json",
    },
    query: {},
    body,
  }
}

function response() {
  let statusCode = 200
  let body: unknown
  const res: VercelResponse = {
    setHeader() { return this },
    status(code) { statusCode = code; return this },
    json(value) { body = value; return this },
    redirect() { return this },
    end() { return this },
  }
  return { res, status: () => statusCode, body: () => body }
}

describe("/api/progress household scope", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("loads only the household resolved from the session", async () => {
    const authorize = vi.fn().mockResolvedValue("household-rtd")
    const list = vi.fn().mockResolvedValue([record])
    const getSelections = vi.fn().mockResolvedValue({
      movies: "iron-man",
      series: null,
    })
    const save = vi.fn()
    const handler = createProgressHandler({ authorize, list, getSelections, save })
    const result = response()

    await handler(request("GET"), result.res)

    expect(list).toHaveBeenCalledWith("household-rtd")
    expect(result.status()).toBe(200)
    expect(result.body()).toEqual({
      items: [record],
      selections: { movies: "iron-man", series: null },
    })
  })

  it("saves atomically inside the session household", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.vercel.app")
    const authorize = vi.fn().mockResolvedValue("household-rtd")
    const list = vi.fn()
    const save = vi.fn().mockResolvedValue({ saved: record, current: null })
    const handler = createProgressHandler({
      authorize,
      list,
      getSelections: vi.fn(),
      save,
    })
    const result = response()

    await handler(request("PATCH", { ...record, revision: 0 }), result.res)

    expect(save).toHaveBeenCalledWith(
      "household-rtd",
      expect.objectContaining({ catalogId: "iron-man", revision: 0 }),
    )
    expect(result.status()).toBe(200)
  })

  it("does not touch storage without a valid session", async () => {
    const list = vi.fn()
    const save = vi.fn()
    const handler = createProgressHandler({
      authorize: vi.fn().mockResolvedValue(null),
      list,
      getSelections: vi.fn(),
      save,
    })
    const result = response()

    await handler(request("GET"), result.res)

    expect(result.status()).toBe(401)
    expect(list).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
})
