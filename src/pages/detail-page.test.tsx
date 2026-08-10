import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { catalog } from "@/data/catalog"
import { DetailPage } from "@/pages/detail-page"

describe("DetailPage", () => {
  it("keeps edits local until one explicit save", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!

    render(
      <MemoryRouter>
        <DetailPage item={item} progress={undefined} onSave={save} saving={false} selectedNext={false} onSelectNext={vi.fn()} />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: "Watched" }))
    await user.click(
      within(screen.getByRole("group", { name: /cengizhan score/i })).getByRole(
        "button",
        { name: "8" },
      ),
    )

    expect(save).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogId: "iron-man",
        status: "watched",
        cengizhanScore: 8,
      }),
    )
  })

  it("shows season and episode controls only for series", () => {
    const movie = catalog.find((entry) => entry.id === "iron-man")!
    const show = catalog.find((entry) => entry.id === "loki")!
    const { rerender } = render(
      <MemoryRouter>
        <DetailPage item={movie} progress={undefined} onSave={vi.fn()} saving={false} selectedNext={false} onSelectNext={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText(/season/i)).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <DetailPage item={show} progress={undefined} onSave={vi.fn()} saving={false} selectedNext={false} onSelectNext={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText(/season/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/episode/i)).toBeInTheDocument()
  })

  it("sets this title as the explicit next choice", async () => {
    const user = userEvent.setup()
    const selectNext = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!

    render(
      <MemoryRouter>
        <DetailPage
          item={item}
          progress={undefined}
          onSave={vi.fn()}
          saving={false}
          selectedNext={false}
          onSelectNext={selectNext}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: /set as next/i }))

    expect(selectNext).toHaveBeenCalledWith(item)
  })
})
