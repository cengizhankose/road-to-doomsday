import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "./App"
import { queryClient } from "./lib/query-client"

/**
 * The celebration belongs to the control the member pressed, not to the
 * endpoint that ends up carrying the write. "Save progress" on a detail page is
 * an explicit save even when a changed plan routes it through the notifying
 * mutation. A refresh, the home calendar's own Schedule button, and a rejected
 * save all stay silent.
 */
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

function progressResponse() {
  return new Response(JSON.stringify(sharedProgressPayload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function savedResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      catalogId: "iron-man",
      status: "watched",
      revision: 1,
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

describe("save success feedback", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false)
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    queryClient.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    queryClient.clear()
    window.history.replaceState(null, "", "/")
  })

  it("stays silent on initial load and on a plain refresh", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/")
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      progressResponse()
    )

    render(<App />)
    await screen.findByRole("heading", { name: /road to/i })

    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
    expect(screen.queryByText(/progress saved/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /refresh/i }))
    await waitFor(() =>
      expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
    )
    expect(screen.queryByText(/progress saved/i)).not.toBeInTheDocument()
  })

  it("celebrates an explicit save the server accepted", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/movies/iron-man")
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) =>
        init?.method === "PATCH" ? savedResponse() : progressResponse()
    )

    render(<App />)
    await screen.findByRole("heading", { name: "Iron Man" })

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      /progress saved/i
    )
    expect(screen.getAllByTestId("confetti-piece").length).toBeGreaterThan(0)
  })

  it("stays silent when the save is rejected, and still reports the failure", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/movies/iron-man")
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) =>
        init?.method === "PATCH"
          ? new Response("save failed", { status: 500 })
          : progressResponse()
    )

    render(<App />)
    await screen.findByRole("heading", { name: "Iron Man" })

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    // The existing non-blocking error feedback must be untouched.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /that change could not be saved/i
    )
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
    expect(screen.queryByText(/progress saved/i)).not.toBeInTheDocument()
  })

  it("celebrates a planned datetime saved from the detail page, once", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/movies/iron-man")
    const notifyHeaders: Array<string | undefined> = []
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          notifyHeaders.push(
            (init.headers as Record<string, string>)?.["X-RTD-Notify-Plan"]
          )
          return savedResponse({
            status: "planned",
            plannedAt: "2026-09-01T18:00:00.000Z",
          })
        }
        return progressResponse()
      }
    )

    render(<App />)
    await screen.findByRole("heading", { name: "Iron Man" })

    // A new plan routes the save through `schedule`, but the member still
    // pressed "Save progress" — the confirmation is owed either way.
    await user.click(screen.getByRole("button", { name: "Planned" }))
    const when = screen.getByLabelText(/planned date & time/i)
    await user.clear(when)
    await user.type(when, "2026-09-01T21:00")
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      /progress saved/i
    )
    expect(screen.getAllByTestId("confetti")).toHaveLength(1)
    expect(screen.getAllByRole("status")).toHaveLength(1)

    // The plan change must still be the kind of write that wakes the other
    // member, and one press must remain one write.
    expect(notifyHeaders).toEqual(["1"])
  })

  it("stays silent for the home calendar's own Schedule button", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/")
    const notifyHeaders: Array<string | undefined> = []
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          notifyHeaders.push(
            (init.headers as Record<string, string>)?.["X-RTD-Notify-Plan"]
          )
          return savedResponse({
            status: "planned",
            plannedAt: "2026-09-01T18:00:00.000Z",
          })
        }
        return progressResponse()
      }
    )

    render(<App />)
    await screen.findByRole("heading", { name: /road to/i })

    await user.click(screen.getByRole("button", { name: /^schedule$/i }))

    // The write still happens, and still notifies — only the confirmation is
    // withheld, because this control has its own feedback.
    await waitFor(() => expect(notifyHeaders).toEqual(["1"]))
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
    expect(screen.queryByText(/progress saved/i)).not.toBeInTheDocument()
  })
})
