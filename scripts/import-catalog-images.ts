/**
 * Keyless catalog artwork import.
 *
 * Poster metadata is resolved from the public Cinemeta catalog
 * (https://v3-cinemeta.strem.io), which needs no API key, no account and no
 * secret of any kind. Every catalog id ends up with a row: a verified Cinemeta
 * poster where one exists, and the self-hosted placeholder where it does not,
 * so the app never has to guess what a missing mapping means.
 *
 *   npm run images:import              # dry run, writes a private review file
 *   npm run images:import -- --apply   # dry run + upsert into DATABASE_URL
 */
import { mkdir, writeFile } from "node:fs/promises"
import { request as httpsRequest } from "node:https"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { neon } from "@neondatabase/serverless"

import { catalog } from "../src/data/catalog.js"
import {
  catalogImageSchema,
  fallbackImageUri,
  type CatalogImage,
} from "../src/domain/images.js"
import {
  chooseCinemetaMeta,
  matchTargetFor,
  type CinemetaMeta,
  type MediaType,
} from "./cinemeta-match.js"

type CatalogEntry = (typeof catalog)[number]

const CINEMETA_ORIGIN = "https://v3-cinemeta.strem.io"

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Cinemeta responded ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  throw lastError
}

async function searchCinemeta(
  type: MediaType,
  title: string
): Promise<CinemetaMeta[]> {
  const payload = await fetchJson(
    `${CINEMETA_ORIGIN}/catalog/${type}/top/search=${encodeURIComponent(title)}.json`
  )
  const metas = (payload as { metas?: unknown })?.metas
  if (!Array.isArray(metas)) return []
  return metas
    .filter((meta): meta is Record<string, unknown> => Boolean(meta))
    .map((meta) => ({
      id: String(meta.id ?? ""),
      type,
      name: typeof meta.name === "string" ? meta.name : undefined,
      poster: typeof meta.poster === "string" ? meta.poster : undefined,
      releaseInfo:
        typeof meta.releaseInfo === "string" ? meta.releaseInfo : undefined,
    }))
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Status code, or null when the host could not be reached at all.
 *
 * `fetch` races IPv6 and IPv4, so on a machine with broken IPv6 egress it
 * reports a perfectly healthy host as unreachable. A network-level failure is
 * therefore retried over IPv4 before the URL is believed to be dead.
 */
async function probeStatus(
  url: string,
  method: "HEAD" | "GET"
): Promise<number | null> {
  try {
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(20_000),
    })
    await response.body?.cancel()
    return response.status
  } catch {
    return await new Promise<number | null>((resolve) => {
      const request = httpsRequest(
        url,
        { method, family: 4, timeout: 20_000 },
        (response) => {
          response.resume()
          resolve(response.statusCode ?? null)
        }
      )
      request.on("timeout", () => {
        request.destroy()
        resolve(null)
      })
      request.on("error", () => resolve(null))
      request.end()
    })
  }
}

/**
 * A poster URL is only recorded once it has actually been fetched.
 *
 * These are community-run hosts, so a refusal is retried with backoff before
 * the title is written off: treating a throttled response as "no artwork"
 * would silently downgrade a real poster to the placeholder.
 */
async function isReachable(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const method of ["HEAD", "GET"] as const) {
      const status = await probeStatus(url, method)
      if (status !== null && status >= 200 && status < 300) return true
      // 404 is a real answer; anything else may just be throttling.
      if (status === 404) return false
    }
    await pause(750 * (attempt + 1))
  }
  return false
}

async function verifiedPoster(meta: CinemetaMeta): Promise<string | null> {
  const candidates = [
    meta.poster,
    `https://images.metahub.space/poster/medium/${meta.id}/img`,
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (await isReachable(candidate)) return candidate
  }
  return null
}

async function matchItem(item: CatalogEntry): Promise<CatalogImage | null> {
  const target = matchTargetFor(item)

  const candidates: CinemetaMeta[] = []
  for (const type of target.types) {
    candidates.push(...(await searchCinemeta(type, target.title)))
  }

  const match = chooseCinemetaMeta(target, candidates)
  if (!match) return null

  const poster = await verifiedPoster(match)
  if (!poster) return null

  return catalogImageSchema.parse({
    catalogId: item.id,
    imageUri: poster,
    source: "cinemeta",
    sourceId: match.id,
    sourcePageUri: `${CINEMETA_ORIGIN}/meta/${match.type}/${match.id}.json`,
    matchedTitle: match.name ?? target.title,
    matchedYear: target.year,
    lastVerifiedAt: new Date().toISOString(),
  })
}

function placeholderFor(item: CatalogEntry): CatalogImage {
  return catalogImageSchema.parse({
    catalogId: item.id,
    imageUri: fallbackImageUri,
    source: "fallback",
    sourceId: item.id,
    sourcePageUri: fallbackImageUri,
    matchedTitle: item.title,
    matchedYear: item.year,
    lastVerifiedAt: new Date().toISOString(),
  })
}

const mappings: CatalogImage[] = []
const fallbacks: string[] = []
const failures: Record<string, string> = {}
for (const item of catalog) {
  // A transient upstream failure must degrade this one title to the
  // placeholder, never abort the run: the whole point of the placeholder row
  // is that all 63 ids come out mapped either way.
  let matched: CatalogImage | null = null
  try {
    matched = await matchItem(item)
  } catch (error) {
    failures[item.id] = error instanceof Error ? error.message : String(error)
  }
  // Be a considerate client of a free community catalog.
  await pause(250)
  if (matched) mappings.push(matched)
  else {
    fallbacks.push(item.id)
    mappings.push(placeholderFor(item))
  }
}

if (mappings.length !== catalog.length) {
  throw new Error(
    `Expected ${catalog.length} mappings, built ${mappings.length}`
  )
}

const outputPath =
  process.env.IMAGE_MAPPING_OUTPUT ??
  join(homedir(), ".hermes", "secure", "road-to-doomsday-catalog-images.json")
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(mappings, null, 2)}\n`, {
  mode: 0o600,
})

const apply = process.argv.includes("--apply")
if (apply) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required with --apply")
  const sql = neon(databaseUrl)
  const keep = mappings.map((image) => image.catalogId)
  // `<> all('{}')` matches every row, so an empty keep-list would wipe the
  // table. It cannot be empty here, but the prune must not rely on that being
  // established a hundred lines earlier.
  if (keep.length !== catalog.length) {
    throw new Error("Refusing to prune catalog_images without a full keep-list")
  }

  // One transaction: either the catalog ends up fully mapped and pruned, or it
  // is left exactly as it was.
  await sql.transaction([
    ...mappings.map(
      (image) => sql`
      insert into catalog_images (
        catalog_id,
        image_uri,
        source,
        source_id,
        source_page_uri,
        matched_title,
        matched_year,
        last_verified_at,
        updated_at
      ) values (
        ${image.catalogId},
        ${image.imageUri},
        ${image.source},
        ${image.sourceId},
        ${image.sourcePageUri},
        ${image.matchedTitle},
        ${image.matchedYear},
        ${image.lastVerifiedAt},
        now()
      )
      on conflict (catalog_id) do update set
        image_uri = excluded.image_uri,
        source = excluded.source,
        source_id = excluded.source_id,
        source_page_uri = excluded.source_page_uri,
        matched_title = excluded.matched_title,
        matched_year = excluded.matched_year,
        last_verified_at = excluded.last_verified_at,
        updated_at = now()
    `
    ),
    // Catalog ids are the only legitimate rows; drop anything renamed away.
    sql`delete from catalog_images where catalog_id <> all(${keep})`,
  ])
}

console.log(
  JSON.stringify({
    catalogItems: catalog.length,
    mappings: mappings.length,
    verified: mappings.length - fallbacks.length,
    fallback: fallbacks.length,
    fallbackIds: fallbacks,
    upstreamFailures: failures,
    applied: apply,
    outputPath,
  })
)
