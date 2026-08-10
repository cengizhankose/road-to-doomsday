import { describe, expect, it } from "vitest"

import { catalog, getRouteItems } from "@/data/catalog"

describe("catalog", () => {
  it("uses unique stable ids", () => {
    const ids = catalog.map((item) => item.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(["movies", "series"] as const)(
    "keeps %s route order contiguous",
    (route) => {
      const orders = getRouteItems(route).map((item) => item.order)

      expect(orders).toEqual(orders.map((_, index) => index + 1))
    },
  )

  it("repairs the infographic's dead-end movie branch", () => {
    expect(getRouteItems("movies").slice(-6).map((item) => item.title)).toEqual([
      "Deadpool & Wolverine",
      "Captain America: Brave New World",
      "Thunderbolts*",
      "The Fantastic Four: First Steps",
      "Spider-Man: Brand New Day",
      "Avengers: Doomsday",
    ])
  })

  it("adds the omitted live-action series and specials", () => {
    const ids = new Set(getRouteItems("series").map((item) => item.id))

    expect(ids.has("werewolf-by-night")).toBe(true)
    expect(ids.has("guardians-holiday-special")).toBe(true)
    expect(ids.has("secret-invasion")).toBe(true)
  })

  it("keeps movies and series as independent routes", () => {
    expect(getRouteItems("movies").every((item) => item.route === "movies")).toBe(
      true,
    )
    expect(getRouteItems("series").every((item) => item.route === "series")).toBe(
      true,
    )
  })
})
