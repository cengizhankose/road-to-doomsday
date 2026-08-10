import { describe, expect, it, vi } from "vitest"

import { createProgressClient } from "@/lib/progress-client"

describe("progress client", () => {
  it("loads all shared progress with one GET", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          selections: { movies: null, series: null },
        }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const client = createProgressClient(fetcher)

    await client.getAll()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
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
      }),
    )
    const client = createProgressClient(fetcher)

    await client.save(saved)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({ method: "PATCH" }),
    )
  })

  it("saves a manual route selection with one PATCH", async () => {
    const saved = { route: "movies" as const, catalogId: "iron-man" }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(saved), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const client = createProgressClient(fetcher)

    await client.saveSelection(saved)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(
      "/api/selection",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(saved),
      }),
    )
  })
})
