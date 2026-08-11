import { describe, expect, it } from "vitest"

import { catalog } from "../../src/data/catalog"
import {
  aliasedCatalogIds,
  chooseCinemetaMeta,
  matchTargetFor,
  metaReleaseYear,
  type CinemetaMeta,
} from "../../scripts/cinemeta-match"

const ironMan: CinemetaMeta = {
  id: "tt0371746",
  type: "movie",
  name: "Iron Man",
  poster:
    "https://m.media-amazon.com/images/M/MV5BMTczNTI2ODUwOF5BMl5BanBnXkFtZTcwMTU0NTIzMw@@._V1_SX250.jpg",
  releaseInfo: "2008",
}

describe("metaReleaseYear", () => {
  it.each([
    ["a single year", "2008", 2008],
    ["an open-ended run with a hyphen", "2025-", 2025],
    ["an open-ended run with an en dash", "2015–", 2015],
    ["a closed run", "2019-2021", 2019],
    ["nothing usable", "TBA", null],
    ["an absent field", undefined, null],
  ])("reads %s", (_name, releaseInfo, expected) => {
    expect(metaReleaseYear({ ...ironMan, releaseInfo })).toBe(expected)
  })
})

describe("chooseCinemetaMeta", () => {
  it("prefers the exact title and year over a same-titled older film", () => {
    const match = chooseCinemetaMeta({ title: "Iron Man", year: 2008 }, [
      { ...ironMan, id: "tt0096251", name: "Iron Man", releaseInfo: "1989" },
      ironMan,
    ])

    expect(match?.id).toBe("tt0371746")
  })

  it("does not settle for a loosely related title", () => {
    const match = chooseCinemetaMeta({ title: "Iron Man", year: 2008 }, [
      { ...ironMan, id: "tt0120744", name: "The Man in the Iron Mask", releaseInfo: "1998" },
      { ...ironMan, id: "tt4419554", name: "Born Again Virgin", releaseInfo: "2015" },
    ])

    expect(match).toBeNull()
  })

  it("matches a season-specific catalog item through its reviewed series alias", () => {
    const match = chooseCinemetaMeta(
      { title: "Daredevil: Born Again", year: 2025 },
      [
        {
          id: "tt18923754",
          type: "series",
          name: "Daredevil: Born Again",
          poster: "https://images.metahub.space/poster/medium/tt18923754/img",
          releaseInfo: "2025-",
        },
      ]
    )

    expect(match?.id).toBe("tt18923754")
  })

  it("tolerates punctuation, ampersands, and accents in either direction", () => {
    const match = chooseCinemetaMeta(
      { title: "Deadpool & Wolverine", year: 2024 },
      [
        {
          ...ironMan,
          id: "tt6263850",
          name: "Deadpool and Wolverine",
          releaseInfo: "2024",
        },
      ]
    )

    expect(match?.id).toBe("tt6263850")
  })

  it("matches a trailing-asterisk title such as Thunderbolts*", () => {
    const match = chooseCinemetaMeta({ title: "Thunderbolts*", year: 2025 }, [
      { ...ironMan, id: "tt20969586", name: "Thunderbolts*", releaseInfo: "2025" },
    ])

    expect(match?.id).toBe("tt20969586")
  })

  it("never chooses a result without usable artwork", () => {
    expect(
      chooseCinemetaMeta({ title: "Vision Quest", year: 2026 }, [
        { ...ironMan, id: "tt13623136", name: "Vision Quest", releaseInfo: "2026", poster: undefined },
      ])
    ).toBeNull()
  })

  it("never chooses a result served from an unexpected host", () => {
    expect(
      chooseCinemetaMeta({ title: "Iron Man", year: 2008 }, [
        { ...ironMan, poster: "https://images.example/iron-man.jpg" },
      ])
    ).toBeNull()
  })

  it("never chooses a result without an IMDb id", () => {
    expect(
      chooseCinemetaMeta({ title: "Iron Man", year: 2008 }, [
        { ...ironMan, id: "kitsu:1234" },
      ])
    ).toBeNull()
  })

  it("rejects an exact title match from a clearly different era", () => {
    expect(
      chooseCinemetaMeta({ title: "Iron Man", year: 2008 }, [
        { ...ironMan, id: "tt0096251", releaseInfo: "1989" },
      ])
    ).toBeNull()
  })

  it("is deterministic: candidate order never changes the pick", () => {
    const candidates = [
      { ...ironMan, id: "tt0371746" },
      { ...ironMan, id: "tt9999999" },
    ]
    const target = { title: "Iron Man", year: 2008 }

    expect(chooseCinemetaMeta(target, candidates)?.id).toBe("tt0371746")
    expect(chooseCinemetaMeta(target, [...candidates].reverse())?.id).toBe(
      "tt0371746"
    )
  })
})

describe("matchTargetFor", () => {
  const item = (id: string) => catalog.find((entry) => entry.id === id)!

  it("every reviewed alias points at a real catalog id", () => {
    const ids = new Set(catalog.map((entry) => entry.id))
    expect(aliasedCatalogIds.filter((id) => !ids.has(id))).toEqual([])
  })

  it("searches a plain movie under its own title in the movie catalog", () => {
    expect(matchTargetFor(item("iron-man"))).toEqual({
      title: "Iron Man",
      year: 2008,
      types: ["movie"],
    })
  })

  it("searches a series in the series catalog", () => {
    expect(matchTargetFor(item("loki"))).toEqual({
      title: "Loki",
      year: 2021,
      types: ["series"],
    })
  })

  it("searches a TV special in both catalogs, since upstream indexes them either way", () => {
    expect(matchTargetFor(item("werewolf-by-night")).types).toEqual([
      "movie",
      "series",
    ])
  })

  it("redirects a season-specific catalog entry to the parent series and its debut year", () => {
    // The catalog tracks season 2 as its own 2026 item; upstream has one
    // series entry that debuted in 2025.
    const target = matchTargetFor(item("daredevil-born-again-season-2"))
    expect(target).toEqual({
      title: "Daredevil: Born Again",
      year: 2025,
      types: ["series"],
    })
    expect(item("daredevil-born-again-season-2").year).toBe(2026)
  })

  it("respells a stylised one-word title upstream indexes with a space", () => {
    expect(matchTargetFor(item("visionquest"))).toEqual({
      title: "Vision Quest",
      year: 2026,
      types: ["series"],
    })
  })

  it("keeps the catalog year when an alias only overrides the title", () => {
    const entry = item("punisher-one-last-kill")
    expect(matchTargetFor(entry).year).toBe(entry.year)
  })
})
