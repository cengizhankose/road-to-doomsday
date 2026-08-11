/**
 * One-command bootstrap for a fresh install.
 *
 * Creates the household, its two members, and one single-use invite link each:
 *
 *   DATABASE_URL=… APP_ORIGIN=… npm run setup -- "Alex" "Sam" --household "Movie Night"
 *
 * Member names may also come from MEMBER_ONE / MEMBER_TWO and the household
 * name from HOUSEHOLD_NAME. Raw invite links are written to a 0600 file that
 * `.gitignore` already covers; they are never printed, so they cannot end up
 * in a terminal transcript or CI log.
 *
 * It refuses to run against a database that already has a household, so it can
 * never fork a live data set. Use `npm run invites` to mint fresh links later.
 */
import { randomUUID } from "node:crypto"

import { neon } from "@neondatabase/serverless"

import { writeInviteFile, type InviteLink } from "./_lib/invites.js"
import { mintInvite } from "./_lib/invites.js"

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

/** Positional args, so `npm run setup -- Alex Sam` works without flags. */
const positional = process.argv.slice(2).filter((arg, index, all) => {
  if (arg.startsWith("--")) return false
  const previous = all[index - 1]
  return !previous?.startsWith("--")
})

const databaseUrl = process.env.DATABASE_URL
const origin = process.env.APP_ORIGIN?.replace(/\/$/, "")
if (!databaseUrl || !origin) {
  throw new Error("DATABASE_URL and APP_ORIGIN are required")
}

const householdName =
  flag("household") ?? process.env.HOUSEHOLD_NAME ?? "Road to Doomsday"
const memberNames = [
  positional[0] ?? process.env.MEMBER_ONE ?? "Member 1",
  positional[1] ?? process.env.MEMBER_TWO ?? "Member 2",
].map((name) => name.trim())

if (memberNames.some((name) => !name)) {
  throw new Error("Both member names must be non-empty")
}
if (memberNames[0].toLowerCase() === memberNames[1].toLowerCase()) {
  throw new Error(
    "The two members need different display names; the app labels each score field with one of them."
  )
}

const sql = neon(databaseUrl)
const existing = await sql`select id from households`
if (existing.length > 0) {
  throw new Error(
    `Refusing to create a second household; ${existing.length} already exists. ` +
      "Run `npm run invites` to mint links for it, or start from an empty database."
  )
}

// Ids are opaque and unrelated to the display names, so renaming a member
// later never has to touch a primary key or the rows pointing at it.
const householdId = `rtd-${randomUUID()}`
const members = memberNames.map((name, index) => ({
  id: `${householdId}:member-${index + 1}`,
  name,
  slot: (index + 1) as 1 | 2,
}))

await sql.transaction([
  sql`insert into households (id, name) values (${householdId}, ${householdName})`,
  ...members.map(
    (member) => sql`
      insert into members (id, household_id, display_name, slot)
      values (${member.id}, ${householdId}, ${member.name}, ${member.slot})
    `
  ),
])

const links: InviteLink[] = []
for (const member of members) {
  links.push(await mintInvite(sql, householdId, member, origin))
}

const outputPath = await writeInviteFile(links)
console.log(
  JSON.stringify(
    {
      household: householdName,
      members: members.map((member) => member.name),
      invites: links.length,
      inviteFile: outputPath,
    },
    null,
    2
  )
)
console.log(
  `\nOpen ${outputPath} and send each member their own link. ` +
    "Each one works once and expires in 7 days."
)
