/**
 * Minting and safely storing single-use member invites.
 *
 * Only the SHA-256 hash of an invite reaches Postgres, so a database dump
 * cannot be replayed into a session. The raw links exist in exactly one place:
 * a 0600 file under `.secrets/`, which `.gitignore` covers. Nothing here ever
 * writes a raw token to stdout.
 */
import { createHash, randomBytes } from "node:crypto"
import { chmod, mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

export const INVITE_TTL_DAYS = 7

/** Repo-local rather than a home directory, so a fork needs no extra setup. */
export const INVITE_FILE = resolve(
  process.cwd(),
  ".secrets",
  "invite-links.json"
)

export interface InviteMember {
  id: string
  name: string
}

export interface InviteLink {
  member: string
  link: string
  expiresAt: string
}

/** A Neon tagged-template query runner. */
type Sql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>

export function inviteExpiry(now = new Date()): string {
  return new Date(
    now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1_000
  ).toISOString()
}

export async function mintInvite(
  sql: Sql,
  householdId: string,
  member: InviteMember,
  origin: string,
  expiresAt = inviteExpiry()
): Promise<InviteLink> {
  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")

  await sql`
    insert into invites (token_hash, household_id, member_id, expires_at)
    values (${tokenHash}, ${householdId}, ${member.id}, ${expiresAt})
  `

  // The token lives in the URL fragment, which browsers never send to the
  // server and which the app strips from the address bar on arrival.
  return { member: member.name, link: `${origin}/join#${token}`, expiresAt }
}

export async function writeInviteFile(
  links: InviteLink[],
  outputPath = INVITE_FILE
): Promise<string> {
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 })
  await writeFile(outputPath, `${JSON.stringify(links, null, 2)}\n`, {
    mode: 0o600,
  })
  // `writeFile` honours the mode only when it creates the file, so an existing
  // file keeps whatever permissions it had until this runs.
  await chmod(outputPath, 0o600)
  return outputPath
}
