/**
 * Mint one fresh single-use invite per member of an existing household.
 *
 *   DATABASE_URL=… APP_ORIGIN=… npm run invites
 *
 * Any unused invite for the household is revoked first, so at most one link
 * per member is ever live. Existing sessions are untouched: re-inviting
 * someone does not sign them out of the devices they already joined on.
 *
 * Raw links go to a 0600 file under `.secrets/`, never to stdout.
 */
import { neon } from "@neondatabase/serverless"

import {
  mintInvite,
  writeInviteFile,
  type InviteLink,
} from "./_lib/invites.js"

const databaseUrl = process.env.DATABASE_URL
const origin = process.env.APP_ORIGIN?.replace(/\/$/, "")
if (!databaseUrl || !origin) {
  throw new Error("DATABASE_URL and APP_ORIGIN are required")
}

const sql = neon(databaseUrl)
const households = await sql`select id from households order by created_at`
const requestedHousehold = process.env.HOUSEHOLD_ID
if (!requestedHousehold && households.length === 0) {
  throw new Error(
    "This database has no household yet. Run `npm run setup` first."
  )
}

const householdId =
  requestedHousehold ??
  (households.length === 1 ? String(households[0]?.id) : null)
if (!householdId) {
  throw new Error(
    `HOUSEHOLD_ID is required when the database has multiple households (found ${households.length})`
  )
}

const members = await sql`
  select id, display_name, slot
  from members
  where household_id = ${householdId}
  order by slot
`
if (members.length !== 2) {
  throw new Error(
    `Expected exactly 2 members in household ${householdId}, found ${members.length}. ` +
      "A fresh database needs `npm run setup` before invites can be minted."
  )
}

await sql`delete from invites where household_id = ${householdId}`

const links: InviteLink[] = []
for (const member of members) {
  links.push(
    await mintInvite(
      sql,
      householdId,
      { id: String(member.id), name: String(member.display_name) },
      origin
    )
  )
}

const outputPath = await writeInviteFile(links)
console.log(
  JSON.stringify(
    {
      household: householdId,
      members: links.map((entry) => entry.member),
      inviteFile: outputPath,
    },
    null,
    2
  )
)
