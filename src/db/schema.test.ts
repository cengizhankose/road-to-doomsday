import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import {
  catalogImages,
  households,
  invites,
  members,
  pushSubscriptions,
  routeSelections,
  sessions,
  titleProgress,
} from "./schema"

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name)
}

describe("private household database schema", () => {
  it("scopes every progress item to a household", () => {
    const config = getTableConfig(titleProgress)

    expect(columnNames(titleProgress)).toContain("household_id")
    expect(config.primaryKeys).toHaveLength(1)
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual(
      ["household_id", "catalog_id"]
    )
  })

  it("stores only credential hashes for invites and sessions", () => {
    expect(columnNames(households)).toContain("id")
    expect(columnNames(invites)).toEqual(
      expect.arrayContaining(["token_hash", "household_id", "expires_at"])
    )
    expect(columnNames(sessions)).toEqual(
      expect.arrayContaining(["session_hash", "household_id", "expires_at"])
    )
    expect(columnNames(invites)).not.toContain("token")
    expect(columnNames(sessions)).not.toContain("token")
  })

  it("binds invites and sessions to uniquely named household members", () => {
    const memberConfig = getTableConfig(members)
    const inviteConfig = getTableConfig(invites)
    const sessionConfig = getTableConfig(sessions)

    expect(columnNames(members)).toEqual(
      expect.arrayContaining([
        "id",
        "household_id",
        "display_name",
        "created_at",
        "updated_at",
      ])
    )
    expect(memberConfig.foreignKeys).toHaveLength(1)
    expect(memberConfig.foreignKeys[0]?.reference().foreignTable).toBe(
      households
    )
    expect(memberConfig.uniqueConstraints).toHaveLength(1)
    expect(
      memberConfig.uniqueConstraints[0]?.columns.map((column) => column.name)
    ).toEqual(["household_id", "display_name"])

    expect(columnNames(invites)).toContain("member_id")
    expect(
      inviteConfig.foreignKeys.some(
        (key) => key.reference().foreignTable === members
      )
    ).toBe(true)
    expect(columnNames(sessions)).toContain("member_id")
    expect(
      sessionConfig.foreignKeys.some(
        (key) => key.reference().foreignTable === members
      )
    ).toBe(true)
  })

  it("keeps exactly one manual selection per household route", () => {
    const config = getTableConfig(routeSelections)

    expect(columnNames(routeSelections)).toEqual(
      expect.arrayContaining(["household_id", "route", "catalog_id"])
    )
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual(
      ["household_id", "route"]
    )
  })

  it("stores renewable catalog image metadata by static catalog id", () => {
    expect(columnNames(catalogImages)).toEqual(
      expect.arrayContaining([
        "catalog_id",
        "image_uri",
        "source",
        "source_id",
        "source_page_uri",
        "matched_title",
        "matched_year",
        "last_verified_at",
      ])
    )
    expect(getTableConfig(catalogImages).primaryKeys).toHaveLength(0)
    expect(
      getTableConfig(catalogImages).columns.find(
        (column) => column.name === "catalog_id"
      )?.primary
    ).toBe(true)
  })

  it("binds push subscriptions to a household member", () => {
    const config = getTableConfig(pushSubscriptions)
    expect(columnNames(pushSubscriptions)).toEqual(
      expect.arrayContaining([
        "endpoint_hash",
        "household_id",
        "member_id",
        "endpoint",
        "p256dh",
        "auth",
        "updated_at",
      ])
    )
    expect(
      config.foreignKeys.some(
        (key) => key.reference().foreignTable === households
      )
    ).toBe(true)
    expect(
      config.foreignKeys.some((key) => key.reference().foreignTable === members)
    ).toBe(true)
  })

  it("binds each push subscription to the session that registered it", () => {
    const config = getTableConfig(pushSubscriptions)

    expect(columnNames(pushSubscriptions)).toContain("session_hash")

    const sessionColumn = config.columns.find(
      (column) => column.name === "session_hash"
    )
    expect(sessionColumn?.notNull).toBe(true)
    // The subscription is not a device identity of its own: it belongs to one
    // session, and it must not be a primary key, so a member keeps separate
    // subscriptions for separate devices and sessions.
    expect(sessionColumn?.primary).toBe(false)

    const sessionKey = config.foreignKeys.find(
      (key) => key.reference().foreignTable === sessions
    )
    expect(sessionKey).toBeDefined()
    expect(
      sessionKey?.reference().columns.map((column) => column.name)
    ).toEqual(["session_hash"])
    // Revoking a session must take its push subscriptions with it.
    expect(sessionKey?.onDelete).toBe("cascade")
  })
})
