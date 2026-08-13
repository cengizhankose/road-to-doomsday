/**
 * Deterministic seed for README screenshots.
 *
 * The dev-mode adapter reads this from localStorage in place of a real
 * household, so shape must match `SharedProgressState`. The renderer treats
 * every field as authoritative and never validates on read, which is why the
 * types here mirror the domain types rather than re-declaring loose shapes.
 */
import type { CatalogImagesMap } from "../../src/domain/images.js"
import type {
  HouseholdMember,
  ProgressMap,
  ProgressRecord,
  RouteSelections,
  SharedProgressState,
} from "../../src/domain/progress.js"
import { catalog } from "../../src/data/catalog.js"

export const LOCAL_STORAGE_KEY = "rtd-dev-progress"

/** Physical CSS viewport for every README screenshot. */
export const VIEWPORT = { width: 448, height: 857 } as const

export const MEMBERS: HouseholdMember[] = [
  { id: "local-member-1", name: "Alex", slot: 1 },
  { id: "local-member-2", name: "Sam", slot: 2 },
]

/**
 * The first eleven movies and the first two series are watched — the same
 * completion posture the previous screenshots showed (28% / 8%), preserved so
 * the composition stays recognisable to anyone who has seen the README before.
 */
const WATCHED_MOVIE_IDS = [
  "iron-man",
  "the-incredible-hulk",
  "iron-man-2",
  "thor",
  "captain-america-the-first-avenger",
  "the-avengers",
  "iron-man-3",
  "thor-the-dark-world",
  "captain-america-the-winter-soldier",
  "guardians-of-the-galaxy",
  "avengers-age-of-ultron",
] as const

const WATCHED_SERIES_IDS = ["daredevil", "jessica-jones"] as const

/**
 * Iron Man carries both member scores so the detail screenshot shows the
 * finished-and-scored end-state, not an empty form.
 */
const IRON_MAN_SCORES = { memberOneScore: 9, memberTwoScore: 8 } as const

function watchedRecord(
  catalogId: string,
  scores: { memberOneScore?: number | null; memberTwoScore?: number | null } = {},
): ProgressRecord {
  return {
    catalogId,
    status: "watched",
    memberOneScore: scores.memberOneScore ?? null,
    memberTwoScore: scores.memberTwoScore ?? null,
    revision: 1,
  }
}

function buildProgress(): ProgressMap {
  const map: ProgressMap = {}
  for (const id of WATCHED_MOVIE_IDS) {
    map[id] = id === "iron-man" ? watchedRecord(id, IRON_MAN_SCORES) : watchedRecord(id)
  }
  for (const id of WATCHED_SERIES_IDS) map[id] = watchedRecord(id)
  return map
}

const SELECTIONS: RouteSelections = {
  movies: "captain-america-civil-war",
  series: "loki",
}

/**
 * Every catalog entry gets a synthetic poster URL on the metahub host the CSP
 * already permits. Playwright intercepts the request and returns a locally
 * generated SVG — no network dependency, and the URL still encodes the
 * catalog id so the interceptor can pick a title-specific poster.
 */
function buildImages(): CatalogImagesMap {
  const images: CatalogImagesMap = {}
  const verifiedAt = "2026-01-01T00:00:00.000Z"
  for (const item of catalog) {
    images[item.id] = {
      catalogId: item.id,
      imageUri: `https://images.metahub.space/poster/small/${item.id}/img`,
      source: "cinemeta",
      sourceId: item.id,
      sourcePageUri: `https://images.metahub.space/poster/small/${item.id}/img`,
      matchedTitle: item.title,
      matchedYear: item.year,
      lastVerifiedAt: verifiedAt,
    }
  }
  return images
}

export function buildSeedState(): SharedProgressState {
  return {
    progress: buildProgress(),
    selections: SELECTIONS,
    images: buildImages(),
    member: { id: MEMBERS[0].id, name: MEMBERS[0].name },
    members: MEMBERS,
    pushPublicKey: null,
    pushBindingId: "screenshot",
  }
}

/** README embed path → app route to render and (optional) selector to await. */
export interface ScreenshotTarget {
  name: string
  outputPath: string
  route: string
  waitFor: string
}

export const TARGETS: ScreenshotTarget[] = [
  {
    name: "home",
    outputPath: "docs/screenshots/home.png",
    route: "/",
    waitFor: 'a[aria-label="Open movie route"]',
  },
  {
    name: "catalog",
    outputPath: "docs/screenshots/catalog.png",
    route: "/movies",
    waitFor: 'ol[aria-label="Movie Route titles"]',
  },
  {
    name: "detail",
    outputPath: "docs/screenshots/detail.png",
    route: "/movies/iron-man",
    waitFor: 'button[aria-pressed="true"]',
  },
]
