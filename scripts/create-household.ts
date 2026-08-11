/**
 * One-time bootstrap for a brand new database.
 *
 * Migration `0001` seeds the two members from whatever households already
 * exist, so a database created from scratch has no household and therefore no
 * members. This creates both, using the same member id shape the migration
 * uses so either path produces an identical row set.
 *
 *   DATABASE_URL=<url> npx tsx scripts/create-household.ts
 *
 * It refuses to run against a database that already has a household, so it can
 * never fork the production data set.
 */
import { randomUUID } from "node:crypto"

import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error("DATABASE_URL is required")

const householdName = process.env.HOUSEHOLD_NAME ?? "Road to Doomsday"
const memberNames = ["Cengizhan", "Sinem"] as const

const sql = neon(databaseUrl)
const existing = await sql`select id from households`
if (existing.length > 0) {
  throw new Error(
    `Refusing to create a second household; ${existing.length} already exists. ` +
      "Delete it first if this database really should start over."
  )
}

const householdId = `rtd-${randomUUID()}`
await sql.transaction([
  sql`insert into households (id, name) values (${householdId}, ${householdName})`,
  ...memberNames.map(
    (name) => sql`
      insert into members (id, household_id, display_name)
      values (${`${householdId}:${name.toLowerCase()}`}, ${householdId}, ${name})
    `
  ),
])

console.log(
  JSON.stringify({ householdId, members: memberNames, name: householdName })
)
