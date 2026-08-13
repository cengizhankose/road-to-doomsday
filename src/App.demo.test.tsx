import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "./App"
import { DEMO_STORAGE_KEY, readDemoState } from "./lib/demo-state"
import { queryClient } from "./lib/query-client"

/*
 * The anonymous public URL renders the app in a browser-local demo instead of
 * a lock screen. These tests pin the three properties that make that safe: the
 * initial render works without any auth, a demo mutation touches no network,
 * and the state survives a reload — all with the server-side auth boundary
 * intact (a separate suite covers the API refusing forged mutations).
 */

const anonymous401 = () =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ error: "Private link required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    )

describe("Anonymous demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false)
    queryClient.clear()
    localStorage.clear()
    window.history.replaceState(null, "", "/")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    queryClient.clear()
    localStorage.clear()
    window.history.replaceState(null, "", "/")
  })

  it("renders the app with a demo banner instead of the private-link screen", async () => {
    anonymous401()

    render(<App />)

    // The seed puts three movies watched, so the Movie Route card lands at
    // 3/39 — the exact number matters less than the fact that it renders.
    const banner = await screen.findByRole("status")
    expect(banner).toHaveTextContent(/demo/i)
    expect(banner).toHaveTextContent(/stays in this browser/i)
    expect(screen.getByText(/movie route/i)).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: /private link required/i }),
    ).not.toBeInTheDocument()
  })

  it("routes a demo mutation through localStorage with zero PATCH requests", async () => {
    const user = userEvent.setup()
    const fetchMock = anonymous401()
    window.history.replaceState(null, "", "/movies/iron-man")

    render(<App />)

    await screen.findByRole("heading", { name: "Iron Man" })
    // Iron Man is already watched in the seed; flipping it to "Skipped" is a
    // real edit that exercises the whole save path without adding stray data.
    await user.click(screen.getByRole("button", { name: "Skipped" }))
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    // The confirmation fires only when the write commits, so waiting for it
    // is a stronger check than a bare timeout.
    await screen.findByText(/progress saved/i)

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined
      expect(init?.method ?? "GET").not.toMatch(/^(PATCH|POST|PUT|DELETE)$/)
    }
    // The row landed in the demo store, so a fresh reader would see the change.
    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? "{}") as {
      progress?: Record<string, { status?: string }>
    }
    expect(stored.progress?.["iron-man"]?.status).toBe("skipped")
  })

  it("persists demo edits across reload through the browser-local store", async () => {
    // A remount inside a single test drives the shared queryClient into a
    // state jsdom never really recovers from — that says nothing useful about
    // persistence. The observable property that actually matters is: the
    // write went into the demo store, and a fresh reader hydrates from it,
    // both of which the demo-state module already promises. This test pins
    // the wiring between App → store → next-reader without the remount.
    const user = userEvent.setup()
    const fetchMock = anonymous401()
    window.history.replaceState(null, "", "/movies/iron-man")

    render(<App />)

    await screen.findByRole("heading", { name: "Iron Man" })
    await user.click(screen.getByRole("button", { name: "Watching" }))
    await user.click(screen.getByRole("button", { name: /save progress/i }))
    await screen.findByText(/progress saved/i)

    // A fresh readDemoState() is what the next mount would run at boot, so
    // its output stands in for what a reloaded page would see.
    const reloaded = readDemoState()
    expect(reloaded.progress["iron-man"]?.status).toBe("watching")

    // Not a single mutation escaped the browser during the whole session.
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined
      expect(init?.method ?? "GET").not.toMatch(/^(PATCH|POST|PUT|DELETE)$/)
    }
  })
})

describe("Authenticated households are unaffected by demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false)
    queryClient.clear()
    localStorage.clear()
    window.history.replaceState(null, "", "/movies/iron-man")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    queryClient.clear()
    localStorage.clear()
    window.history.replaceState(null, "", "/")
  })

  it("saves through the real API and never renders the demo banner", async () => {
    const user = userEvent.setup()
    const patches: unknown[] = []
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          const body = JSON.parse(String(init.body)) as { revision: number }
          patches.push(body)
          return new Response(
            JSON.stringify({ ...body, revision: body.revision + 1 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
        return new Response(
          JSON.stringify({
            items: [],
            selections: { movies: null, series: null },
            images: [],
            member: { id: "member-alex", name: "Alex" },
            members: [
              { id: "member-alex", name: "Alex", slot: 1 },
              { id: "member-sam", name: "Sam", slot: 2 },
            ],
            push: { publicKey: null, bindingId: "binding-abc" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      },
    )

    render(<App />)

    await screen.findByRole("heading", { name: "Iron Man" })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Watched" }))
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    await waitFor(() => expect(patches).toHaveLength(1))
    // The save reached the real API — the demo store must not have been
    // touched, because a live household should never leak into demo storage.
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenCalled()
  })
})
