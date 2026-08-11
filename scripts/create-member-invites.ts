import { createHash, randomBytes } from "node:crypto"
import { chmod, mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL
const origin = process.env.APP_ORIGIN?.replace(/\/$/, "")
if (!databaseUrl || !origin) throw new Error("DATABASE_URL and APP_ORIGIN are required")

const sql = neon(databaseUrl)
const households = await sql`select id from households order by created_at`
const requestedHousehold = process.env.HOUSEHOLD_ID
if (!requestedHousehold && households.length === 0) {
  throw new Error(
    "This database has no household yet. Run scripts/create-household.ts first."
  )
}
const householdId = requestedHousehold
  ?? (households.length === 1 ? String(households[0]?.id) : null)
if (!householdId) throw new Error(`HOUSEHOLD_ID is required when the database has multiple households (found ${households.length})`)

const members = await sql`
  select id, display_name
  from members
  where household_id = ${householdId}
  order by display_name
`
if (members.length !== 2) {
  throw new Error(
    `Expected exactly 2 members in household ${householdId}, found ${members.length}. ` +
      "A fresh database needs scripts/create-household.ts before invites can be minted."
  )
}

await sql`delete from invites where household_id = ${householdId}`
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString()
const links: Array<{ member: string; link: string; expiresAt: string }> = []
for (const member of members) {
  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await sql`
    insert into invites (token_hash, household_id, member_id, expires_at)
    values (${tokenHash}, ${householdId}, ${String(member.id)}, ${expiresAt})
  `
  links.push({
    member: String(member.display_name),
    link: `${origin}/join#${token}`,
    expiresAt,
  })
}

const outputPath = join(
  homedir(),
  ".hermes",
  "secure",
  "road-to-doomsday-member-invite-links.json",
)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(links, null, 2)}\n`, { mode: 0o600 })
await chmod(outputPath, 0o600)
console.log(JSON.stringify({ householdId, members: links.map((entry) => entry.member), outputPath }))
