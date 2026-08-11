import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createProgressHandler,
  serializeProgressRow,
  toCatalogImages,
} from "../../api/progress"
import {
  progressRecordSchema,
  type ProgressRecord,
} from "../../src/domain/progress"
import type { VercelRequest, VercelResponse } from "../../api/_lib/types"
import { pushBindingId } from "../../api/_lib/auth"

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

const session = {
  householdId: "household-rtd",
  memberId: "member-cengizhan",
  memberName: "Cengizhan",
  sessionHash: "session-hash",
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

describe("/api/progress household scope", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("loads only the household resolved from the session", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "vapid-public-key")
    const authorize = vi.fn().mockResolvedValue(session)
    const list = vi.fn().mockResolvedValue([record])
    const getSelections = vi.fn().mockResolvedValue({
      movies: "iron-man",
      series: null,
    })
    const listImages = vi.fn().mockResolvedValue([
      {
        catalogId: "iron-man",
        imageUri: "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg",
        source: "cinemeta",
        sourceId: "tt0371746",
        sourcePageUri: "https://v3-cinemeta.strem.io/meta/movie/tt0371746.json",
        matchedTitle: "Iron Man",
        matchedYear: 2008,
        lastVerifiedAt: "2026-08-10T14:00:00.000Z",
      },
    ])
    const save = vi.fn()
    const handler = createProgressHandler({
      authorize,
      list,
      getSelections,
      listImages,
      save,
    })
    const result = response()

    await handler(request("GET"), result.res)

    expect(list).toHaveBeenCalledWith("household-rtd")
    expect(result.status()).toBe(200)
    expect(result.body()).toEqual({
      items: [record],
      selections: { movies: "iron-man", series: null },
      images: [
        expect.objectContaining({
          catalogId: "iron-man",
          imageUri: "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg",
        }),
      ],
      member: { id: "member-cengizhan", name: "Cengizhan" },
      push: {
        publicKey: "vapid-public-key",
        // Lets a device notice its push row is bound to a previous session and
        // re-register, without spending an extra request to find out.
        bindingId: pushBindingId(session.sessionHash),
      },
    })
    expect(
      JSON.stringify(result.body())
    ).not.toContain(session.sessionHash)
  })

  it("saves atomically inside the session household", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.vercel.app")
    const authorize = vi.fn().mockResolvedValue(session)
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
      expect.objectContaining({ catalogId: "iron-man", revision: 0 })
    )
    expect(result.status()).toBe(200)
  })

  it("notifies the other member after a successful calendar plan", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.vercel.app")
    const planned: ProgressRecord = {
      ...record,
      status: "planned",
      plannedAt: "2026-08-14T18:00:00.000Z",
      watchedOn: null,
      revision: 0,
    }
    const notify = vi.fn().mockResolvedValue(undefined)
    const handler = createProgressHandler({
      authorize: vi.fn().mockResolvedValue(session),
      list: vi.fn(),
      getSelections: vi.fn(),
      save: vi.fn().mockResolvedValue({
        saved: { ...planned, revision: 1 },
        current: null,
      }),
      notify,
    })
    const req = request("PATCH", planned)
    req.headers["x-rtd-notify-plan"] = "1"
    const result = response()

    await handler(req, result.res)

    expect(result.status()).toBe(200)
    expect(notify).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        catalogId: "iron-man",
        title: "Iron Man",
        route: "movies",
        plannedAt: "2026-08-14T18:00:00.000Z",
      })
    )
  })

  it.each([
    ["a floating plannedAt without a timezone", { plannedAt: "2026-08-14T18:00:00" }],
    ["a non-datetime plannedAt", { plannedAt: "tomorrow" }],
    ["a datetime in the watchedOn date column", { watchedOn: "2026-08-14T18:00:00.000Z" }],
    ["an impossible watchedOn", { watchedOn: "2026-02-31" }],
  ])("rejects %s with 400 instead of reaching storage", async (_name, patch) => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.vercel.app")
    const save = vi.fn()
    const handler = createProgressHandler({
      authorize: vi.fn().mockResolvedValue(session),
      list: vi.fn(),
      getSelections: vi.fn(),
      save,
    })
    const result = response()

    await handler(request("PATCH", { ...record, ...patch }), result.res)

    expect(result.status()).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })

  it("accepts a timezone-aware plan expressed with a UTC offset", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.vercel.app")
    const planned = {
      ...record,
      status: "planned" as const,
      plannedAt: "2026-08-14T21:00:00+03:00",
      watchedOn: null,
    }
    const save = vi
      .fn()
      .mockResolvedValue({ saved: { ...planned, revision: 2 }, current: null })
    const handler = createProgressHandler({
      authorize: vi.fn().mockResolvedValue(session),
      list: vi.fn(),
      getSelections: vi.fn(),
      save,
    })
    const result = response()

    await handler(request("PATCH", planned), result.res)

    expect(result.status()).toBe(200)
    expect(save).toHaveBeenCalledWith(
      "household-rtd",
      expect.objectContaining({ plannedAt: "2026-08-14T21:00:00+03:00" }),
    )
  })

  it("serializes Postgres timestamps as ISO instants the client contract accepts", () => {
    const serialized = serializeProgressRow({
      householdId: "household-rtd",
      catalogId: "iron-man",
      status: "planned",
      cengizhanScore: null,
      sinemScore: null,
      currentSeason: null,
      currentEpisode: null,
      plannedAt: "2026-08-14 18:00:00+00",
      watchedOn: "2026-08-10",
      note: null,
      revision: 3,
      updatedAt: "2026-08-14 18:00:00+00",
    })

    expect(serialized.plannedAt).toBe("2026-08-14T18:00:00.000Z")
    expect(progressRecordSchema.safeParse(serialized).success).toBe(true)
  })

  it("answers a stale revision with 409 and the record that actually won", async () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.vercel.app")
    const winner: ProgressRecord = {
      ...record,
      note: "Sinem: bring snacks",
      revision: 5,
    }
    const notify = vi.fn()
    const handler = createProgressHandler({
      authorize: vi.fn().mockResolvedValue(session),
      list: vi.fn(),
      getSelections: vi.fn(),
      save: vi.fn().mockResolvedValue({ saved: null, current: winner }),
      notify,
    })
    const req = request("PATCH", { ...record, revision: 4 })
    req.headers["x-rtd-notify-plan"] = "1"
    const result = response()

    await handler(req, result.res)

    expect(result.status()).toBe(409)
    expect(result.body()).toEqual({
      error: "revision_conflict",
      current: winner,
    })
    // A losing write must not notify the other member.
    expect(notify).not.toHaveBeenCalled()
  })

  it("drops an unusable artwork row instead of failing the whole load", () => {
    const usable = {
      catalog_id: "iron-man",
      image_uri: "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg",
      source: "cinemeta",
      source_id: "tt0371746",
      source_page_uri: "https://v3-cinemeta.strem.io/meta/movie/tt0371746.json",
      matched_title: "Iron Man",
      matched_year: 2008,
      last_verified_at: "2026-08-11 14:00:00+00",
    }

    const images = toCatalogImages([
      { ...usable, catalog_id: "poisoned", image_uri: "https://evil.example/x.jpg" },
      usable,
    ])

    expect(images.map((image) => image.catalogId)).toEqual(["iron-man"])
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
