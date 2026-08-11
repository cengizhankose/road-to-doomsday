import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ActionErrorNotice } from "@/components/action-error-notice"
import { HttpError } from "@/lib/progress-client"

describe("ActionErrorNotice", () => {
  it("keeps the tracker visible and offers refresh on revision conflict", () => {
    const retry = vi.fn()
    render(
      <div>
        <span>tracker remains visible</span>
        <ActionErrorNotice
          error={new HttpError(409, "revision_conflict")}
          onRetry={retry}
          onDismiss={vi.fn()}
        />
      </div>,
    )

    expect(screen.getByText("tracker remains visible")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Shared progress changed on another device.",
    )
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it("renders nothing while every mutation is healthy", () => {
    const { container } = render(
      <ActionErrorNotice error={null} onRetry={vi.fn()} onDismiss={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("can be dismissed so a one-off failure does not linger", () => {
    const dismiss = vi.fn()
    render(
      <ActionErrorNotice
        error={new Error("network down")}
        onRetry={vi.fn()}
        onDismiss={dismiss}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That change could not be saved.",
    )
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }))
    expect(dismiss).toHaveBeenCalledOnce()
  })
})
