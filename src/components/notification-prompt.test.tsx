import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { NotificationPrompt } from "@/components/notification-prompt"

describe("NotificationPrompt", () => {
  it("enables notifications for the member identified by the magic link", () => {
    const onEnable = vi.fn()
    render(
      <NotificationPrompt
        memberName="Cengizhan"
        supported
        subscribed={false}
        enabling={false}
        onEnable={onEnable}
      />
    )

    expect(screen.getByText("Cengizhan's device")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Enable notifications" })
    )
    expect(onEnable).toHaveBeenCalledOnce()
  })

  it("explains a failed opt-in and offers a retry", () => {
    const onEnable = vi.fn()
    render(
      <NotificationPrompt
        memberName="Cengizhan"
        supported
        subscribed={false}
        enabling={false}
        error={new Error("Push subscription failed with 500")}
        onEnable={onEnable}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      /couldn't turn on notifications/i
    )
    fireEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(onEnable).toHaveBeenCalledOnce()
  })

  it("tells the member when the browser itself blocked notifications", () => {
    render(
      <NotificationPrompt
        memberName="Sinem"
        supported
        subscribed={false}
        enabling={false}
        blocked
        onEnable={vi.fn()}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      /blocked notifications for this site/i
    )
  })

  it("stays out of the way on unsupported browsers", () => {
    const { container } = render(
      <NotificationPrompt
        memberName="Sinem"
        supported={false}
        subscribed={false}
        enabling={false}
        onEnable={vi.fn()}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })
})
