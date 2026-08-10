import { describe, expect, it } from "vitest"

import type { CatalogItem } from "@/domain/catalog"
import {
  getRouteCompletion,
  getSelectedRouteItem,
  normalizeScore,
  normalizeSeriesPosition,
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
      getSelectedRouteItem(items, { movies: null, series: null }, "movies"),
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
})
