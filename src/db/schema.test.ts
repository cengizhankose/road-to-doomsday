import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { households, invites, routeSelections, sessions, titleProgress } from "./schema"

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name)
}

describe("private household database schema", () => {
  it("scopes every progress item to a household", () => {
    const config = getTableConfig(titleProgress)

    expect(columnNames(titleProgress)).toContain("household_id")
    expect(config.primaryKeys).toHaveLength(1)
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      "household_id",
      "catalog_id",
    ])
  })

  it("stores only credential hashes for invites and sessions", () => {
    expect(columnNames(households)).toContain("id")
    expect(columnNames(invites)).toEqual(
      expect.arrayContaining(["token_hash", "household_id", "expires_at"]),
    )
    expect(columnNames(sessions)).toEqual(
      expect.arrayContaining(["session_hash", "household_id", "expires_at"]),
    )
    expect(columnNames(invites)).not.toContain("token")
    expect(columnNames(sessions)).not.toContain("token")
  })

  it("keeps exactly one manual selection per household route", () => {
    const config = getTableConfig(routeSelections)

    expect(columnNames(routeSelections)).toEqual(
      expect.arrayContaining(["household_id", "route", "catalog_id"]),
    )
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      "household_id",
      "route",
    ])
  })
})
