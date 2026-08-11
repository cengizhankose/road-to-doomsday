import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MiniCalendar } from "@/components/mini-calendar"
import type { CatalogItem } from "@/domain/catalog"
import type { ProgressMap } from "@/domain/progress"

const items: CatalogItem[] = [
  {
    id: "iron-man",
    title: "Iron Man",
    route: "movies",
    kind: "movie",
    order: 1,
    year: 2008,
    releaseStatus: "released",
  },
  {
    id: "loki",
    title: "Loki",
    route: "series",
    kind: "series",
    order: 2,
    year: 2021,
    releaseStatus: "released",
    seasonEpisodeCounts: [6, 6],
  },
]

const progress: ProgressMap = {
  "iron-man": {
    catalogId: "iron-man",
    status: "planned",
    memberOneScore: 8,
    memberTwoScore: 7,
    note: "Keep this",
    plannedAt: new Date(2026, 7, 15, 19, 30).toISOString(),
    revision: 4,
  },
}

const now = new Date(2026, 7, 10, 12)

describe("MiniCalendar", () => {
  it("renders a navigable month grid and marks planned days accessibly", async () => {
    const user = userEvent.setup()
    render(
      <MiniCalendar
        items={items}
        progress={progress}
        onSchedule={vi.fn()}
        saving={false}
        now={now}
      />
    )

    expect(
      screen.getByRole("heading", { name: "August 2026" })
    ).toBeInTheDocument()
    const plannedDay = screen.getByRole("button", {
      name: /August 15, 2026, 1 planned item/i,
    })
    expect(within(plannedDay).getByTestId("planned-dot")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /next month/i }))
    expect(
      screen.getByRole("heading", { name: "September 2026" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /previous month/i }))
    expect(
      screen.getByRole("heading", { name: "August 2026" })
    ).toBeInTheDocument()
  })

  it.each(["watched", "skipped", "watching", "not_started"] as const)(
    "stops showing a plan once the title is %s",
    (status) => {
      render(
        <MiniCalendar
          items={items}
          progress={{
            "iron-man": { ...progress["iron-man"], status },
          }}
          onSchedule={vi.fn()}
          saving={false}
          now={now}
        />
      )

      // The stale plannedAt must not keep marking the day forever.
      expect(screen.queryAllByTestId("planned-dot")).toHaveLength(0)
      expect(
        screen.getByRole("button", { name: "August 15, 2026" })
      ).toBeInTheDocument()
    }
  )

  it("shows planned titles for the selected day", async () => {
    const user = userEvent.setup()
    render(
      <MiniCalendar
        items={items}
        progress={progress}
        onSchedule={vi.fn()}
        saving={false}
        now={now}
      />
    )

    expect(
      screen.queryByRole("heading", { name: /planned for august 15/i })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /August 15, 2026, 1 planned item/i })
    )

    expect(
      screen.getByRole("heading", { name: /planned for august 15/i })
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole("region", { name: /selected day plans/i })
      ).getByText("Iron Man")
    ).toBeInTheDocument()
  })

  it("removes a plan in one press, keeping every other field on the record", async () => {
    const user = userEvent.setup()
    const onClearPlan = vi.fn()
    const onSchedule = vi.fn()
    render(
      <MiniCalendar
        items={items}
        progress={progress}
        onSchedule={onSchedule}
        onClearPlan={onClearPlan}
        saving={false}
        now={now}
      />
    )

    await user.click(
      screen.getByRole("button", { name: /August 15, 2026, 1 planned item/i })
    )
    const plans = screen.getByRole("region", { name: /selected day plans/i })

    // No dialog, no confirmation step — one press does it.
    await user.click(
      within(plans).getByRole("button", { name: /remove plan for iron man/i })
    )

    expect(onSchedule).not.toHaveBeenCalled()
    expect(onClearPlan).toHaveBeenCalledTimes(1)
    expect(onClearPlan).toHaveBeenCalledWith({
      ...progress["iron-man"],
      status: "not_started",
      plannedAt: null,
    })
    // The current revision is what makes the clear atomic.
    expect(onClearPlan.mock.calls[0][0].revision).toBe(4)
    expect(onClearPlan.mock.calls[0][0].memberOneScore).toBe(8)
    expect(onClearPlan.mock.calls[0][0].note).toBe("Keep this")
  })

  it("disables removal while a write is in flight", async () => {
    const user = userEvent.setup()
    render(
      <MiniCalendar
        items={items}
        progress={progress}
        onSchedule={vi.fn()}
        onClearPlan={vi.fn()}
        saving
        now={now}
      />
    )

    await user.click(
      screen.getByRole("button", { name: /August 15, 2026, 1 planned item/i })
    )

    expect(
      screen.getByRole("button", { name: /remove plan for iron man/i })
    ).toBeDisabled()
  })

  it("still lists plans when the host wires no removal handler", async () => {
    const user = userEvent.setup()
    render(
      <MiniCalendar
        items={items}
        progress={progress}
        onSchedule={vi.fn()}
        saving={false}
        now={now}
      />
    )

    await user.click(
      screen.getByRole("button", { name: /August 15, 2026, 1 planned item/i })
    )

    expect(
      within(
        screen.getByRole("region", { name: /selected day plans/i })
      ).getByText("Iron Man")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /remove plan/i })).toBeNull()
  })

  it("schedules once with the local date-time while preserving an existing record", async () => {
    const user = userEvent.setup()
    const onSchedule = vi.fn()
    render(
      <MiniCalendar
        items={items}
        progress={progress}
        onSchedule={onSchedule}
        saving={false}
        now={now}
      />
    )

    await user.click(screen.getByRole("button", { name: /August 20, 2026/i }))
    await user.selectOptions(screen.getByLabelText(/title/i), "iron-man")
    await user.clear(screen.getByLabelText(/time/i))
    await user.type(screen.getByLabelText(/time/i), "21:05")
    await user.click(screen.getByRole("button", { name: /schedule/i }))

    expect(onSchedule).toHaveBeenCalledTimes(1)
    expect(onSchedule).toHaveBeenCalledWith({
      ...progress["iron-man"],
      status: "planned",
      plannedAt: new Date(2026, 7, 20, 21, 5).toISOString(),
    })
  })

  it("creates a valid default progress record and disables submission while saving", async () => {
    const user = userEvent.setup()
    const onSchedule = vi.fn()
    const { rerender } = render(
      <MiniCalendar
        items={items}
        progress={{}}
        onSchedule={onSchedule}
        saving={false}
        now={now}
      />
    )

    await user.click(screen.getByRole("button", { name: /August 12, 2026/i }))
    await user.selectOptions(screen.getByLabelText(/title/i), "loki")
    await user.clear(screen.getByLabelText(/time/i))
    await user.type(screen.getByLabelText(/time/i), "08:15")
    await user.click(screen.getByRole("button", { name: /schedule/i }))

    expect(onSchedule).toHaveBeenCalledTimes(1)
    expect(onSchedule).toHaveBeenCalledWith({
      catalogId: "loki",
      status: "planned",
      plannedAt: new Date(2026, 7, 12, 8, 15).toISOString(),
      revision: 0,
    })

    rerender(
      <MiniCalendar
        items={items}
        progress={{}}
        onSchedule={onSchedule}
        saving
        now={now}
      />
    )
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled()
  })
})
