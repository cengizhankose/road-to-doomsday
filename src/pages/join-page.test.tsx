import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { JoinPage } from "./join-page"

describe("JoinPage", () => {
  afterEach(() => vi.restoreAllMocks())

  it("removes the fragment before exchanging the invite with one POST", async () => {
    window.location.hash = "#single-use-invite"
    const replaceState = vi.spyOn(window.history, "replaceState")
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))
    const onJoined = vi.fn()

    render(<JoinPage onJoined={onJoined} />)

    expect(replaceState).toHaveBeenCalledWith(null, "", "/join")
    await waitFor(() => expect(onJoined).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "single-use-invite" }),
    })
  })

  it("does not call the API without a fragment credential", () => {
    window.location.hash = ""
    const fetchMock = vi.spyOn(globalThis, "fetch")

    render(<JoinPage onJoined={vi.fn()} />)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/invite link is incomplete/i)).toBeInTheDocument()
  })
})
