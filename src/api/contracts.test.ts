import { describe, expect, it } from "vitest"

import { progressPatchSchema, selectionPatchSchema } from "@/api/contracts"

describe("progressPatchSchema", () => {
  const valid = {
    catalogId: "iron-man",
    status: "watched",
    revision: 0,
    cengizhanScore: 8,
  }

  it("accepts a bounded known catalog update", () => {
    expect(progressPatchSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects unknown catalog ids", () => {
    expect(
      progressPatchSchema.safeParse({ ...valid, catalogId: "made-up-title" })
        .success,
    ).toBe(false)
  })

  it("rejects scores outside 0-10", () => {
    expect(
      progressPatchSchema.safeParse({ ...valid, cengizhanScore: 11 }).success,
    ).toBe(false)
  })

  it("rejects unknown request fields", () => {
    expect(
      progressPatchSchema.safeParse({ ...valid, householdId: "attacker-chosen" })
        .success,
    ).toBe(false)
  })

  it("rejects oversized notes", () => {
    expect(
      progressPatchSchema.safeParse({ ...valid, note: "x".repeat(2001) }).success,
    ).toBe(false)
  })

  it.each([
    ["a UTC instant", "2026-08-14T18:00:00.000Z"],
    ["an offset instant", "2026-08-14T21:00:00+03:00"],
    ["no plan at all", null],
  ])("accepts %s as plannedAt", (_name, plannedAt) => {
    expect(progressPatchSchema.safeParse({ ...valid, plannedAt }).success).toBe(
      true,
    )
  })

  it.each([
    ["a floating local datetime without a zone", "2026-08-14T18:00:00"],
    ["a bare date", "2026-08-14"],
    ["free text", "tomorrow night"],
    ["an impossible instant", "2026-02-31T18:00:00.000Z"],
    ["an empty string", ""],
  ])("rejects %s as plannedAt", (_name, plannedAt) => {
    expect(progressPatchSchema.safeParse({ ...valid, plannedAt }).success).toBe(
      false,
    )
  })

  it.each([
    ["a calendar date", "2026-08-14"],
    ["no watch date at all", null],
  ])("accepts %s as watchedOn", (_name, watchedOn) => {
    expect(progressPatchSchema.safeParse({ ...valid, watchedOn }).success).toBe(
      true,
    )
  })

  it.each([
    ["a full datetime", "2026-08-14T18:00:00.000Z"],
    ["an impossible date", "2026-02-31"],
    ["free text", "last weekend"],
    ["an empty string", ""],
  ])("rejects %s as watchedOn", (_name, watchedOn) => {
    expect(progressPatchSchema.safeParse({ ...valid, watchedOn }).success).toBe(
      false,
    )
  })

  it("rejects fractional scores that the smallint columns cannot hold", () => {
    expect(
      progressPatchSchema.safeParse({ ...valid, cengizhanScore: 7.5 }).success,
    ).toBe(false)
    expect(
      progressPatchSchema.safeParse({ ...valid, sinemScore: 7.5 }).success,
    ).toBe(false)
  })
})

describe("selectionPatchSchema", () => {
  it("accepts a catalog item from the chosen route", () => {
    expect(
      selectionPatchSchema.safeParse({ route: "movies", catalogId: "iron-man" })
        .success,
    ).toBe(true)
  })

  it("rejects a catalog item from another route", () => {
    expect(
      selectionPatchSchema.safeParse({ route: "series", catalogId: "iron-man" })
        .success,
    ).toBe(false)
  })
})
