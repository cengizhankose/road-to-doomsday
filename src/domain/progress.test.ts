import { describe, expect, it } from "vitest"

import type { CatalogItem } from "@/domain/catalog"
import {
  getRouteCompletion,
  getSelectedRouteItem,
  householdMemberSchema,
  memberBySlot,
  memberLabel,
  normalizeScore,
  normalizeSeriesPosition,
  scoreFieldBySlot,
  shouldNotifyPlan,
  type HouseholdMember,
  type ProgressMap,
} from "@/domain/progress"

const items: CatalogItem[] = [
  {
    id: "one",
    title: "One",
    route: "movies",
    kind: "movie",
    order: 1,
    releaseStatus: "released",
    year: 2020,
  },
  {
    id: "two",
    title: "Two",
    route: "movies",
    kind: "movie",
    order: 2,
    releaseStatus: "released",
    year: 2021,
  },
  {
    id: "show",
    title: "Show",
    route: "series",
    kind: "series",
    order: 1,
    releaseStatus: "released",
    year: 2021,
    seasonEpisodeCounts: [6, 4],
  },
]

describe("progress selectors", () => {
  it("uses only the manually selected item for each route", () => {
    const selections = { movies: "two", series: "show" } as const

    expect(getSelectedRouteItem(items, selections, "movies")?.id).toBe("two")
    expect(getSelectedRouteItem(items, selections, "series")?.id).toBe("show")
  })

  it("does not invent an automatic next item", () => {
    expect(
      getSelectedRouteItem(items, { movies: null, series: null }, "movies")
    ).toBeUndefined()
  })

  it("calculates watched completion without mixing routes", () => {
    const progress: ProgressMap = {
      one: { catalogId: "one", status: "watched", revision: 1 },
      show: { catalogId: "show", status: "watched", revision: 1 },
    }

    expect(getRouteCompletion(items, progress, "movies")).toEqual({
      watched: 1,
      total: 2,
      percent: 50,
    })
    expect(getRouteCompletion(items, progress, "series").percent).toBe(100)
  })

  it("clamps scores to the 0-10 range", () => {
    expect(normalizeScore(-1)).toBe(0)
    expect(normalizeScore(7.5)).toBe(7.5)
    expect(normalizeScore(12)).toBe(10)
  })

  it("clamps a series position to valid season and episode bounds", () => {
    const show = items[2]

    expect(normalizeSeriesPosition(show, 8, 99)).toEqual({
      currentSeason: 2,
      currentEpisode: 4,
    })
    expect(normalizeSeriesPosition(show, 1, 0)).toEqual({
      currentSeason: 1,
      currentEpisode: 1,
    })
  })

  it("notifies only when a real plan is created or changed", () => {
    const existing = {
      catalogId: "one",
      status: "planned" as const,
      plannedAt: "2026-08-14T18:00:00.000Z",
      revision: 1,
    }

    expect(shouldNotifyPlan(undefined, existing)).toBe(true)
    expect(shouldNotifyPlan(existing, { ...existing, note: "Bring snacks" })).toBe(false)
    expect(
      shouldNotifyPlan(existing, {
        ...existing,
        plannedAt: "2026-08-15T18:00:00.000Z",
      }),
    ).toBe(true)
  })
})

describe("household members", () => {
  const members: HouseholdMember[] = [
    { id: "member-2", name: "Sam", slot: 2 },
    { id: "member-1", name: "Alex", slot: 1 },
  ]

  it("resolves a member by slot regardless of the order they arrive in", () => {
    expect(memberBySlot(members, 1)?.name).toBe("Alex")
    expect(memberBySlot(members, 2)?.name).toBe("Sam")
  })

  it("labels each score field with whatever the household named itself", () => {
    expect(memberLabel(members, 1)).toBe("Alex")
    expect(memberLabel(members, 2)).toBe("Sam")

    const renamed: HouseholdMember[] = [
      { id: "member-1", name: "Ada", slot: 1 },
      { id: "member-2", name: "Grace", slot: 2 },
    ]
    expect(renamed.map((member) => memberLabel(renamed, member.slot))).toEqual([
      "Ada",
      "Grace",
    ])
  })

  it("falls back to a neutral label rather than mislabelling a score", () => {
    expect(memberLabel([], 1)).toBe("Member 1")
    expect(memberLabel([members[0]], 1)).toBe("Member 1")
  })

  it("maps each slot onto its own score field", () => {
    expect(scoreFieldBySlot[1]).toBe("memberOneScore")
    expect(scoreFieldBySlot[2]).toBe("memberTwoScore")
  })

  it("rejects a member outside the two-slot contract", () => {
    expect(
      householdMemberSchema.safeParse({ id: "m", name: "Alex", slot: 1 }).success
    ).toBe(true)
    expect(
      householdMemberSchema.safeParse({ id: "m", name: "Alex", slot: 3 }).success
    ).toBe(false)
    expect(
      householdMemberSchema.safeParse({ id: "m", name: "", slot: 1 }).success
    ).toBe(false)
  })
})
