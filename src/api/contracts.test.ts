import { describe, expect, it } from "vitest"

import { progressPatchSchema } from "@/api/contracts"

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

  it("rejects oversized notes", () => {
    expect(
      progressPatchSchema.safeParse({ ...valid, note: "x".repeat(2001) }).success,
    ).toBe(false)
  })
})
