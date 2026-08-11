import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { catalog } from "@/data/catalog"
import { DetailPage } from "@/pages/detail-page"
import type { HouseholdMember } from "@/domain/progress"

const householdMembers: HouseholdMember[] = [
  { id: "member-1", name: "Alex", slot: 1 },
  { id: "member-2", name: "Sam", slot: 2 },
]

describe("DetailPage", () => {
  it("shows the verified poster without changing the editing flow", () => {
    const item = catalog.find((entry) => entry.id === "iron-man")!

    render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={item}
          image={{
            catalogId: "iron-man",
            imageUri: "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg",
            source: "cinemeta",
            sourceId: "tt0371746",
            sourcePageUri: "https://v3-cinemeta.strem.io/meta/movie/tt0371746.json",
            matchedTitle: "Iron Man",
            matchedYear: 2008,
            lastVerifiedAt: "2026-08-10T14:00:00.000Z",
          }}
          progress={undefined}
          onSave={vi.fn()}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("img", { name: "Iron Man poster" })
    ).toBeInTheDocument()
  })

  it("shows local plan time and saves an unambiguous UTC instant", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!
    const plannedAt = new Date(2026, 7, 14, 21, 0).toISOString()
    render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={item}
          progress={{ catalogId: item.id, status: "planned", plannedAt, revision: 1 }}
          onSave={save}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>,
    )

    const input = screen.getByLabelText(/planned date & time/i)
    expect(input).toHaveValue("2026-08-14T21:00")
    fireEvent.change(input, { target: { value: "2026-08-15T20:30" } })
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedAt: new Date(2026, 7, 15, 20, 30).toISOString(),
      }),
    )
  })

  it("offers a clear control only once there is a plan to clear", () => {
    const item = catalog.find((entry) => entry.id === "iron-man")!
    const props = {
      members: householdMembers,
      item,
      onSave: vi.fn(),
      saving: false,
      selectedNext: false,
      onSelectNext: vi.fn(),
    }

    const { rerender } = render(
      <MemoryRouter>
        <DetailPage {...props} progress={undefined} />
      </MemoryRouter>
    )

    expect(screen.queryByRole("button", { name: /clear plan/i })).toBeNull()

    rerender(
      <MemoryRouter>
        <DetailPage
          {...props}
          progress={{
            catalogId: item.id,
            status: "planned",
            plannedAt: "2026-08-14T18:00:00.000Z",
            revision: 3,
          }}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("button", { name: /clear plan/i })
    ).toBeInTheDocument()
  })

  it("clears the planned date and drops the planned status on the next save", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!

    render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={item}
          progress={{
            catalogId: item.id,
            status: "planned",
            memberOneScore: 8,
            memberTwoScore: 7,
            plannedAt: "2026-08-14T18:00:00.000Z",
            note: "Bring snacks",
            revision: 3,
          }}
          onSave={save}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
    )

    await user.click(screen.getByRole("button", { name: /clear plan/i }))

    // Clearing edits the draft; the member still owns the moment it persists.
    expect(screen.getByLabelText(/planned date & time/i)).toHaveValue("")
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Not started" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Planned" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({
      catalogId: "iron-man",
      status: "not_started",
      plannedAt: null,
      memberOneScore: 8,
      memberTwoScore: 7,
      currentSeason: null,
      currentEpisode: null,
      watchedOn: null,
      note: "Bring snacks",
      revision: 3,
    })
  })

  it("keeps a non-planned status when the date is cleared", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!

    render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={item}
          progress={{
            catalogId: item.id,
            status: "watching",
            plannedAt: "2026-08-14T18:00:00.000Z",
            revision: 3,
          }}
          onSave={save}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
    )

    await user.click(screen.getByRole("button", { name: /clear plan/i }))
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "watching", plannedAt: null })
    )
  })

  it("does not let the other device's plan reappear after this member cleared it", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!
    const props = {
      members: householdMembers,
      item,
      onSave: save,
      saving: false,
      selectedNext: false,
      onSelectNext: vi.fn(),
    }

    const { rerender } = render(
      <MemoryRouter>
        <DetailPage
          {...props}
          progress={{
            catalogId: item.id,
            status: "planned",
            plannedAt: "2026-08-14T18:00:00.000Z",
            revision: 3,
          }}
        />
      </MemoryRouter>
    )

    await user.click(screen.getByRole("button", { name: /clear plan/i }))

    // The other member writes a note; the cleared date is this member's edit
    // and must not be resurrected by the merge.
    rerender(
      <MemoryRouter>
        <DetailPage
          {...props}
          progress={{
            catalogId: item.id,
            status: "planned",
            plannedAt: "2026-08-14T18:00:00.000Z",
            note: "Sam: bring snacks",
            revision: 4,
          }}
        />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/planned date & time/i)).toHaveValue("")

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedAt: null,
        status: "not_started",
        note: "Sam: bring snacks",
        revision: 4,
      })
    )
  })

  it("keeps edits local until one explicit save", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!

    render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={item}
          progress={undefined}
          onSave={save}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
    )

    await user.click(screen.getByRole("button", { name: "Watched" }))
    await user.click(
      within(screen.getByRole("group", { name: /alex score/i })).getByRole(
        "button",
        { name: "8" }
      )
    )

    expect(save).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogId: "iron-man",
        status: "watched",
        memberOneScore: 8,
      })
    )
  })

  it("saves twice in a row without replaying a stale revision", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!
    const first = {
      catalogId: item.id,
      status: "watching" as const,
      revision: 1,
    }

    const { rerender } = render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={item}
          progress={first}
          onSave={save}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: "Watched" }))
    await user.click(screen.getByRole("button", { name: /save progress/i }))
    expect(save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "watched", revision: 1 }),
    )

    // The server accepted the write and the shared cache now holds revision 2.
    const saved = { ...first, status: "watched" as const, revision: 2 }
    rerender(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={item}
          progress={saved}
          onSave={save}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: "Skipped" }))
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "skipped", revision: 2 }),
    )
  })

  it("never overwrites another device's field that this member did not touch", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!
    const props = {
      item,
      onSave: save,
      saving: false,
      selectedNext: false,
      onSelectNext: vi.fn(),
    }

    const { rerender } = render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          {...props}
          progress={{ catalogId: item.id, status: "watching", revision: 4 }}
        />
      </MemoryRouter>,
    )

    // This member only ever changes the status.
    await user.click(screen.getByRole("button", { name: "Watched" }))

    // Meanwhile the other member writes a note and a plan.
    rerender(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          {...props}
          progress={{
            catalogId: item.id,
            status: "watching",
            note: "Sam: bring snacks",
            plannedAt: "2026-08-20T18:00:00.000Z",
            revision: 5,
          }}
        />
      </MemoryRouter>,
    )

    // Their values are adopted and visible, because nobody edited them here.
    expect(screen.getByLabelText(/shared note/i)).toHaveValue(
      "Sam: bring snacks",
    )

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "watched", // this member's deliberate edit survives
        note: "Sam: bring snacks", // the other member's write is not clobbered
        plannedAt: "2026-08-20T18:00:00.000Z",
        revision: 5,
      }),
    )
  })

  it("keeps this member's in-flight edit when the other device changes the same field", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!
    const props = {
      item,
      onSave: save,
      saving: false,
      selectedNext: false,
      onSelectNext: vi.fn(),
    }

    const { rerender } = render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          {...props}
          progress={{ catalogId: item.id, status: "watching", revision: 4 }}
        />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/shared note/i), "Bring snacks")

    rerender(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          {...props}
          progress={{
            catalogId: item.id,
            status: "watching",
            note: "Written from the other device",
            revision: 5,
          }}
        />
      </MemoryRouter>,
    )

    // A field this member is actively editing is not yanked out from under them.
    expect(screen.getByLabelText(/shared note/i)).toHaveValue("Bring snacks")

    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Bring snacks", revision: 5 }),
    )
  })

  it("shows season and episode controls only for series", () => {
    const movie = catalog.find((entry) => entry.id === "iron-man")!
    const show = catalog.find((entry) => entry.id === "loki")!
    const { rerender } = render(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={movie}
          progress={undefined}
          onSave={vi.fn()}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.queryByLabelText(/season/i)).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <DetailPage
          members={householdMembers}
          item={show}
          progress={undefined}
          onSave={vi.fn()}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
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
          members={householdMembers}
          item={item}
          progress={undefined}
          onSave={vi.fn()}
          saving={false}
          selectedNext={false}
          onSelectNext={selectNext}
        />
      </MemoryRouter>
    )

    await user.click(screen.getByRole("button", { name: /set as next/i }))

    expect(selectNext).toHaveBeenCalledWith(item)
  })

  it("labels each score field with the household's own member names", async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const item = catalog.find((entry) => entry.id === "iron-man")!
    const ownMembers: HouseholdMember[] = [
      { id: "member-1", name: "Ada", slot: 1 },
      { id: "member-2", name: "Grace", slot: 2 },
    ]

    render(
      <MemoryRouter>
        <DetailPage
          members={ownMembers}
          item={item}
          progress={undefined}
          onSave={save}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole("group", { name: "Ada score" })).toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: "Grace score" })
    ).toBeInTheDocument()
    // The previous owners' names must not survive anywhere in the markup.
    expect(screen.queryByRole("group", { name: /alex/i })).toBeNull()

    // Slot 1 owns `memberOneScore`, whatever that member happens to be called.
    await user.click(
      within(screen.getByRole("group", { name: "Grace score" })).getByRole(
        "button",
        { name: "9" }
      )
    )
    await user.click(screen.getByRole("button", { name: /save progress/i }))

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ memberTwoScore: 9, memberOneScore: null })
    )
  })

  it("still renders when a household has not finished setup", () => {
    const item = catalog.find((entry) => entry.id === "iron-man")!

    render(
      <MemoryRouter>
        <DetailPage
          members={[]}
          item={item}
          progress={undefined}
          onSave={vi.fn()}
          saving={false}
          selectedNext={false}
          onSelectNext={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("group", { name: "Member 1 score" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: "Member 2 score" })
    ).toBeInTheDocument()
  })
})
