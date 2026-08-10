import { describe, expect, it, vi } from "vitest"

import { createProgressClient } from "@/lib/progress-client"

describe("progress client", () => {
  it("loads all shared progress with one GET", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
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
})
