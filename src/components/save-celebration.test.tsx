import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SaveCelebration } from "@/components/save-celebration"

/**
 * `token` counts successful explicit saves. The component reacts to it
 * *changing*, never to its value being non-zero, which is what keeps a React
 * re-render from firing a second burst.
 */
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

describe("SaveCelebration", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubMatchMedia(false)
  })

  afterEach(() => {
    // Unmount first. Vitest runs `afterEach` hooks in reverse registration
    // order, so Testing Library's auto-cleanup — registered when it was
    // imported — would otherwise run *after* this hook. Flushing timers while
    // the component is still mounted fires the dismiss callbacks as unactioned
    // state updates, which is what produces "not wrapped in act(...)".
    cleanup()
    // Anything still queued after unmount is drained inside `act` so React can
    // process the resulting render, rather than warning about it.
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("shows nothing before the first successful save", () => {
    render(<SaveCelebration token={0} />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
  })

  it("announces the save and fires one burst when the token advances", () => {
    const view = render(<SaveCelebration token={0} />)

    view.rerender(<SaveCelebration token={1} />)

    expect(screen.getByRole("status")).toHaveTextContent(/progress saved/i)
    expect(screen.getAllByTestId("confetti-piece").length).toBeGreaterThan(0)
  })

  it("does not repeat the burst when React re-renders with the same token", () => {
    const view = render(<SaveCelebration token={0} />)
    view.rerender(<SaveCelebration token={1} />)

    const firstBurst = screen.getAllByTestId("confetti-piece").length
    view.rerender(<SaveCelebration token={1} />)
    view.rerender(<SaveCelebration token={1} />)

    expect(screen.getAllByTestId("confetti-piece")).toHaveLength(firstBurst)
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("celebrates again on the next successful save", () => {
    const view = render(<SaveCelebration token={1} />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    view.rerender(<SaveCelebration token={2} />)

    expect(screen.getByRole("status")).toHaveTextContent(/progress saved/i)
    expect(screen.getAllByTestId("confetti-piece").length).toBeGreaterThan(0)
  })

  it("dismisses itself so it never sits on top of the tracker", () => {
    const view = render(<SaveCelebration token={0} />)
    view.rerender(<SaveCelebration token={1} />)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
  })

  it("keeps the toast but skips the animation under prefers-reduced-motion", () => {
    stubMatchMedia(true)
    const view = render(<SaveCelebration token={0} />)

    view.rerender(<SaveCelebration token={1} />)

    expect(screen.getByRole("status")).toHaveTextContent(/progress saved/i)
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
  })

  it("announces the message it was handed", () => {
    const view = render(<SaveCelebration token={0} message="Plan saved" />)

    view.rerender(<SaveCelebration token={1} message="Plan saved" />)

    expect(screen.getByRole("status")).toHaveTextContent("Plan saved")
  })

  it("withholds the burst for a confirmation that is not a celebration", () => {
    const view = render(
      <SaveCelebration token={0} message="Plan cleared" confetti={false} />
    )

    view.rerender(
      <SaveCelebration token={1} message="Plan cleared" confetti={false} />
    )

    expect(screen.getByRole("status")).toHaveTextContent("Plan cleared")
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument()
  })

  it("keeps the message that arrived with the token it is announcing", () => {
    const view = render(<SaveCelebration token={0} message="Progress saved" />)
    view.rerender(<SaveCelebration token={1} message="Progress saved" />)

    // A later re-render carrying a fresh message must not rewrite the toast
    // that is already on screen for an earlier write.
    view.rerender(<SaveCelebration token={1} message="Plan cleared" />)

    expect(screen.getByRole("status")).toHaveTextContent("Progress saved")
  })

  it("keeps the overlay inert so it cannot block a tap or shift layout", () => {
    const view = render(<SaveCelebration token={0} />)
    view.rerender(<SaveCelebration token={1} />)

    const overlay = screen.getByTestId("confetti")
    expect(overlay).toHaveAttribute("aria-hidden", "true")
    expect(overlay.className).toMatch(/pointer-events-none/)
    expect(overlay.className).toMatch(/fixed/)

    // The toast is polite: it must not steal focus or interrupt a screen reader.
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite")
  })
})
