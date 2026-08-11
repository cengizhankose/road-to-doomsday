import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "./App"
import { queryClient } from "./lib/query-client"

describe("App join route", () => {
  beforeEach(() => {
    queryClient.clear()
    window.history.replaceState(null, "", "/join#private-invite")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    queryClient.clear()
    window.history.replaceState(null, "", "/")
  })

  it("exchanges the fragment without loading progress first", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }))

    render(<App />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/join")
  })
})

const sharedProgressPayload = {
  items: [],
  selections: { movies: null, series: null },
  images: [],
  member: { id: "member-alex", name: "Alex" },
  members: [
    { id: "member-alex", name: "Alex", slot: 1 },
    { id: "member-sam", name: "Sam", slot: 2 },
  ],
  push: { publicKey: null, bindingId: "binding-abc" },
}

describe("App mutation failures", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false)
    queryClient.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    queryClient.clear()
    window.history.replaceState(null, "", "/")
  })

  it("keeps the cached tracker visible and retryable when a detail save fails", async () => {
    const user = userEvent.setup()
    const unhandled = vi.fn()
    window.addEventListener("unhandledrejection", unhandled)
    window.history.replaceState(null, "", "/movies/iron-man")
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) =>
        init?.method === "PATCH"
          ? new Response("save failed", { status: 500 })
          : new Response(JSON.stringify(sharedProgressPayload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
    )

    render(<App />)

    const heading = await screen.findByRole("heading", { name: "Iron Man" })
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    // The failure is inline; the tracker itself is never replaced.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /that change could not be saved/i
    )
    expect(heading).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /save progress/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: /couldn't load the tracker/i })
    ).not.toBeInTheDocument()

    // The failed save must not escape as an unhandled rejection.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(unhandled).not.toHaveBeenCalled()
    window.removeEventListener("unhandledrejection", unhandled)

    await user.click(screen.getByRole("button", { name: /dismiss/i }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("recovers from a revision conflict without erasing the other member's write", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/movies/iron-man")

    // The other member has already written a note at revision 5; this device
    // still believes the row sits at revision 4.
    const theirs = {
      catalogId: "iron-man",
      status: "watching",
      note: "Sam: bring snacks",
      revision: 5,
    }
    const patches: unknown[] = []
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        if (init?.method !== "PATCH") {
          return new Response(
            JSON.stringify({
              ...sharedProgressPayload,
              items: [{ catalogId: "iron-man", status: "watching", revision: 4 }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        const body = JSON.parse(String(init.body))
        patches.push(body)
        return body.revision === theirs.revision
          ? new Response(JSON.stringify({ ...body, revision: 6 }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          : new Response(
              JSON.stringify({ error: "revision_conflict", current: theirs }),
              { status: 409, headers: { "Content-Type": "application/json" } }
            )
      }
    )

    render(<App />)
    await screen.findByRole("heading", { name: "Iron Man" })

    await user.click(screen.getByRole("button", { name: "Watched" }))
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /shared progress changed on another device/i
    )
    // The conflict response teaches the form what actually won.
    await waitFor(() =>
      expect(screen.getByLabelText(/shared note/i)).toHaveValue(
        "Sam: bring snacks"
      )
    )

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    await waitFor(() => expect(patches).toHaveLength(2))
    expect(patches[0]).toMatchObject({ status: "watched", revision: 4 })
    // The retry keeps this member's edit and preserves theirs.
    expect(patches[1]).toMatchObject({
      status: "watched",
      note: "Sam: bring snacks",
      revision: 5,
    })
  })

  it("locks the tracker only when the initial load is unauthorized", async () => {
    window.history.replaceState(null, "", "/movies/iron-man")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Private link required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: /private link required/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /save progress/i })
    ).not.toBeInTheDocument()
  })
})
