import { describe, expect, it, vi } from "vitest"

import {
  conflictRecord,
  createProgressClient,
  HttpError,
} from "@/lib/progress-client"

describe("progress client", () => {
  it("loads progress and catalog images with one GET", async () => {
    const image = {
      catalogId: "iron-man",
      imageUri: "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg",
      source: "cinemeta",
      sourceId: "tt0371746",
      sourcePageUri: "https://v3-cinemeta.strem.io/meta/movie/tt0371746.json",
      matchedTitle: "Iron Man",
      matchedYear: 2008,
      lastVerifiedAt: "2026-08-10T14:00:00.000Z",
    }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          selections: { movies: null, series: null },
          images: [image],
          member: { id: "member-cengizhan", name: "Cengizhan" },
          push: { publicKey: "vapid-public-key" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )
    const client = createProgressClient(fetcher)

    const state = await client.getAll()

    expect(state.images["iron-man"]).toEqual(image)
    expect(state.member).toEqual({ id: "member-cengizhan", name: "Cengizhan" })
    expect(state.pushPublicKey).toBe("vapid-public-key")

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    )
  })

  it("exposes unauthorized responses without hiding the status", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Private link required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )
    const client = createProgressClient(fetcher)

    const error = await client.getAll().catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 401 })
  })

  it("surfaces a revision conflict with the record that actually won", async () => {
    const current = {
      catalogId: "iron-man",
      status: "watching" as const,
      note: "Sinem: bring snacks",
      revision: 5,
    }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: "revision_conflict", current }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    )
    const client = createProgressClient(fetcher)

    const error = await client
      .save({ catalogId: "iron-man", status: "watched", revision: 4 })
      .catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 409 })
    expect(conflictRecord(error)).toEqual(current)
  })

  it("reports no conflict record for other failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("upstream exploded", { status: 500 }))
    const client = createProgressClient(fetcher)

    const error = await client
      .save({ catalogId: "iron-man", status: "watched", revision: 4 })
      .catch((reason: unknown) => reason)

    expect(error).toMatchObject({ status: 500 })
    expect(conflictRecord(error)).toBeNull()
  })

  it("schedules with one PATCH and the explicit notification signal", async () => {
    const saved = {
      catalogId: "iron-man",
      status: "planned" as const,
      cengizhanScore: null,
      sinemScore: null,
      currentSeason: null,
      currentEpisode: null,
      plannedAt: "2026-08-14T18:00:00.000Z",
      watchedOn: null,
      note: null,
      revision: 2,
    }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(saved), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    const client = createProgressClient(fetcher)

    await client.schedule(saved)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ "X-RTD-Notify-Plan": "1" }),
      })
    )
  })

  it("saves with one PATCH and no follow-up GET", async () => {
    const saved = {
      catalogId: "iron-man",
      status: "watched" as const,
      revision: 1,
    }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(saved), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    const client = createProgressClient(fetcher)

    await client.save(saved)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({ method: "PATCH" })
    )
  })

  it("saves a manual route selection with one PATCH", async () => {
    const saved = { route: "movies" as const, catalogId: "iron-man" }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(saved), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    const client = createProgressClient(fetcher)

    await client.saveSelection(saved)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(
      "/api/selection",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(saved),
      })
    )
  })
})
