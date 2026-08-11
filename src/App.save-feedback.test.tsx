import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "./App"
import { queryClient } from "./lib/query-client"

/**
 * The confirmation belongs to the control the member pressed, not to the
 * endpoint that ends up carrying the write. "Save progress" on a detail page is
 * an explicit save even when a changed plan routes it through the notifying
 * mutation, and the home calendar's Schedule button is an explicit scheduling
 * action that earns the same confirmation. Clearing a plan is confirmed too,
 * but quietly — undoing something is not an occasion for confetti. A refresh,
 * an initial load and a rejected write all stay silent.
 */
function sharedProgressPayload(items: Array<Record<string, unknown>> = []) {
  return {
    items,
    selections: { movies: null, series: null },
    images: [],
    member: { id: "member-alex", name: "Alex" },
    members: [
      { id: "member-alex", name: "Alex", slot: 1 },
      { id: "member-sam", name: "Sam", slot: 2 },
    ],
    push: { publicKey: null, bindingId: "binding-abc" },
  }
}

/** Noon today, so the mini-calendar's default selected day already holds it. */
function plannedToday() {
  const when = new Date()
  when.setHours(12, 0, 0, 0)
  return when.toISOString()
}

function plannedIronMan() {
  return {
    catalogId: "iron-man",
    status: "planned",
    memberOneScore: 8,
    memberTwoScore: null,
    currentSeason: null,
    currentEpisode: null,
    plannedAt: plannedToday(),
    watchedOn: null,
    note: "Bring snacks",
    revision: 4,
  }
}

function progressResponse(items: Array<Record<string, unknown>> = []) {
  return new Response(JSON.stringify(sharedProgressPayload(items)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

/** Records every PATCH the app makes, so one press can be proved to be one write. */
function recordPatches() {
  const patches: Array<{
    notify: string | undefined
    body: Record<string, unknown>
  }> = []
  return {
    patches,
    capture(init: RequestInit) {
      patches.push({
        notify: (init.headers as Record<string, string>)?.["X-RTD-Notify-Plan"],
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      })
    },
  }
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

function stubMatchMedia(prefersReducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: prefersReducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe("save success feedback", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false)
    stubMatchMedia(false)
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

  it("celebrates a plan scheduled from the home calendar, once", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/")
    const patched = recordPatches()
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patched.capture(init)
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

    expect(await screen.findByRole("status")).toHaveTextContent(/plan saved/i)
    expect(screen.getAllByTestId("confetti")).toHaveLength(1)
    expect(screen.getAllByRole("status")).toHaveLength(1)

    // The write still happens, and a new plan still wakes the other member.
    await waitFor(() => expect(patched.patches).toHaveLength(1))
    expect(patched.patches[0].notify).toBe("1")
  })

  it("stays silent when a scheduling attempt from the home calendar fails", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/")
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) =>
        init?.method === "PATCH"
          ? new Response("schedule failed", { status: 500 })
          : progressResponse()
    )

    render(<App />)
    await screen.findByRole("heading", { name: /road to/i })

    await user.click(screen.getByRole("button", { name: /^schedule$/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /that change could not be saved/i
    )
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("keeps the scheduling toast but skips the burst under reduced motion", async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/")
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) =>
        init?.method === "PATCH"
          ? savedResponse({
              status: "planned",
              plannedAt: "2026-09-01T18:00:00.000Z",
            })
          : progressResponse()
    )

    render(<App />)
    await screen.findByRole("heading", { name: /road to/i })

    await user.click(screen.getByRole("button", { name: /^schedule$/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(/plan saved/i)
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
  })

  it("clears a plan from the home calendar without notifying or celebrating", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/")
    const planned = plannedIronMan()
    const patched = recordPatches()
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patched.capture(init)
          return savedResponse({
            ...planned,
            status: "not_started",
            plannedAt: null,
            revision: 5,
          })
        }
        return progressResponse([planned])
      }
    )

    render(<App />)
    await screen.findByRole("heading", { name: /road to/i })

    await user.click(
      await screen.findByRole("button", { name: /remove plan for iron man/i })
    )

    expect(await screen.findByRole("status")).toHaveTextContent(/plan cleared/i)
    // Undoing a plan is confirmed, not celebrated.
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(1)

    // One press is one atomic write, at the revision the calendar was showing.
    expect(patched.patches).toHaveLength(1)
    expect(patched.patches[0].notify).toBeUndefined()
    expect(patched.patches[0].body).toEqual({
      ...planned,
      status: "not_started",
      plannedAt: null,
    })

    // The plan leaves the calendar, and nothing is left to remove.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /remove plan for iron man/i })
      ).toBeNull()
    )
  })

  it("reports a failed plan removal without claiming it cleared", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/")
    const planned = plannedIronMan()
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) =>
        init?.method === "PATCH"
          ? new Response("clear failed", { status: 500 })
          : progressResponse([planned])
    )

    render(<App />)
    await screen.findByRole("heading", { name: /road to/i })

    await user.click(
      await screen.findByRole("button", { name: /remove plan for iron man/i })
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /that change could not be saved/i
    )
    expect(screen.queryByText(/plan cleared/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
    // The plan is still there to try again on.
    expect(
      screen.getByRole("button", { name: /remove plan for iron man/i })
    ).toBeInTheDocument()
  })

  it("persists a null plan from the detail page without waking the other member", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/movies/iron-man")
    const planned = plannedIronMan()
    const patched = recordPatches()
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patched.capture(init)
          return savedResponse({
            ...planned,
            status: "not_started",
            plannedAt: null,
            revision: 5,
          })
        }
        return progressResponse([planned])
      }
    )

    render(<App />)
    await screen.findByRole("heading", { name: "Iron Man" })

    await user.click(
      await screen.findByRole("button", { name: /clear plan/i })
    )
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    // An explicit detail save is still one celebration, even for a removal.
    expect(await screen.findByRole("status")).toHaveTextContent(
      /progress saved/i
    )
    expect(screen.getAllByTestId("confetti")).toHaveLength(1)
    expect(screen.getAllByRole("status")).toHaveLength(1)

    expect(patched.patches).toHaveLength(1)
    expect(patched.patches[0].notify).toBeUndefined()
    expect(patched.patches[0].body).toMatchObject({
      catalogId: "iron-man",
      status: "not_started",
      plannedAt: null,
      memberOneScore: 8,
      note: "Bring snacks",
      revision: 4,
    })
  })
})
