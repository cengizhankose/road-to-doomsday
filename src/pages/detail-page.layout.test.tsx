import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { catalog } from "@/data/catalog"
import { DetailPage } from "@/pages/detail-page"
import type { HouseholdMember } from "@/domain/progress"
import css from "@/index.css?raw"

/**
 * jsdom does not lay anything out, so these are containment *contracts* rather
 * than measurements: the declarations and classes that stop iOS Safari sizing
 * `input[type="datetime-local"]` from its own shadow content and pushing the
 * field past the card padding. The measurement itself is a real-browser check.
 */
const householdMembers: HouseholdMember[] = [
  { id: "member-1", name: "Alex", slot: 1 },
  { id: "member-2", name: "Sam", slot: 2 },
]

function renderDetail(catalogId: string) {
  const item = catalog.find((entry) => entry.id === catalogId)!
  render(
    <MemoryRouter>
      <DetailPage
        members={householdMembers}
        item={item}
        progress={{
          catalogId: item.id,
          status: "planned",
          plannedAt: "2026-08-14T18:00:00.000Z",
          revision: 2,
        }}
        onSave={vi.fn()}
        saving={false}
        selectedNext={false}
        onSelectNext={vi.fn()}
      />
    </MemoryRouter>
  )
  return screen.getByLabelText(/planned date & time/i)
}

describe("planned date field containment", () => {
  it.each([
    ["a movie", "iron-man"],
    ["a series", "loki"],
  ])("keeps the %s field shrinkable inside its card", (_kind, catalogId) => {
    const input = renderDetail(catalogId)

    // Without `min-w-0` the field refuses to shrink below its intrinsic width.
    expect(input.className).toMatch(/\bmin-w-0\b/)
    expect(input.className).toMatch(/\bw-full\b/)
    expect(input.className).toMatch(/\bmax-w-full\b/)

    // The wrapper must not re-introduce an intrinsic floor of its own.
    const wrapper = input.parentElement!
    expect(wrapper.className).toMatch(/\bmin-w-0\b/)
    expect(wrapper.className).toMatch(/\bmax-w-full\b/)

    // The clear control lives in the same padded column, not beside the field.
    expect(
      wrapper.querySelector("button[data-slot='clear-plan']")
    ).not.toBeNull()
  })

  it("strips the native intrinsic width without dropping below the no-zoom size", () => {
    const rule = css.match(
      /input\[type="datetime-local"\]\s*\{([^}]*)\}/
    )?.[1]

    expect(rule).toBeDefined()
    expect(rule).toMatch(/-webkit-appearance:\s*none/)
    expect(rule).toMatch(/\bappearance:\s*none/)
    expect(rule).toMatch(/min-width:\s*0/)
    expect(rule).toMatch(/max-width:\s*100%/)
    expect(rule).toMatch(/box-sizing:\s*border-box/)
    // Below 16px iOS zooms the whole page in on focus.
    expect(rule).toMatch(/font-size:\s*max\(16px/)
  })

  it("contains the shadow value that iOS sizes the field from", () => {
    for (const pseudo of ["-webkit-date-and-time-value", "-webkit-datetime-edit"]) {
      const rule = css.match(
        new RegExp(`input\\[type="datetime-local"\\]::${pseudo}\\s*\\{([^}]*)\\}`)
      )?.[1]

      expect(rule, pseudo).toBeDefined()
      expect(rule, pseudo).toMatch(/min-width:\s*0/)
      expect(rule, pseudo).toMatch(/max-width:\s*100%/)
      expect(rule, pseudo).toMatch(/overflow:\s*hidden/)
    }
  })
})
