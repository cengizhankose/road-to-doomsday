import type { CatalogItem } from "../src/domain/catalog.js"
import { remoteImageHosts } from "../src/domain/images.js"

export type MediaType = "movie" | "series"

/** The subset of a Cinemeta catalog entry this importer relies on. */
export interface CinemetaMeta {
  id: string
  type: MediaType
  name?: string
  poster?: string | null
  releaseInfo?: string
}

export interface MatchTarget {
  title: string
  year: number
}

/**
 * Reviewed overrides for catalog ids the upstream catalog does not index under
 * their display title — season-specific entries and stylised one-word titles.
 */
const aliases: Record<
  string,
  { title?: string; year?: number; types?: MediaType[] }
> = {
  // The catalog tracks season 2 separately; upstream has one series entry.
  "daredevil-born-again-season-2": {
    title: "Daredevil: Born Again",
    year: 2025,
    types: ["series"],
  },
  visionquest: { title: "Vision Quest", types: ["series"] },
  "guardians-holiday-special": {
    title: "The Guardians of the Galaxy Holiday Special",
    types: ["movie", "series"],
  },
  "werewolf-by-night": { types: ["movie", "series"] },
  "punisher-one-last-kill": {
    title: "The Punisher: One Last Kill",
    types: ["movie", "series"],
  },
}

/** Catalog ids that carry a reviewed override, for test coverage. */
export const aliasedCatalogIds = Object.keys(aliases)

/** What to search upstream for, and which catalogs to search. */
export function matchTargetFor(
  item: CatalogItem
): MatchTarget & { types: MediaType[] } {
  const alias = aliases[item.id]
  return {
    title: alias?.title ?? item.title,
    year: alias?.year ?? item.year,
    types:
      alias?.types ??
      (item.kind === "movie"
        ? ["movie"]
        : // A TV special can be indexed either way upstream.
          item.kind === "special"
          ? ["movie", "series"]
          : ["series"]),
  }
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Cinemeta reports a release as `2008`, `2025-`, `2015–` or `2019-2021`.
 * Only the first year identifies the title.
 */
export function metaReleaseYear(meta: CinemetaMeta): number | null {
  const year = /^\s*(\d{4})/.exec(meta.releaseInfo ?? "")?.[1]
  return year ? Number(year) : null
}

function hasUsablePoster(meta: CinemetaMeta) {
  if (!meta.poster) return false
  try {
    const url = new URL(meta.poster)
    return (
      url.protocol === "https:" &&
      (remoteImageHosts as readonly string[]).includes(url.hostname)
    )
  } catch {
    return false
  }
}

/**
 * Deterministic title + year match. No API key, no popularity tiebreak that
 * could drift between runs: a candidate only wins on how well its own name and
 * release year line up with the catalog entry, and ties fall to the lower IMDb
 * id so repeated imports are reproducible.
 */
export function chooseCinemetaMeta(
  target: MatchTarget,
  candidates: CinemetaMeta[]
): CinemetaMeta | null {
  const targetTitle = normalize(target.title)

  const ranked = candidates
    .filter((meta) => /^tt\d+$/.test(meta.id) && meta.name && hasUsablePoster(meta))
    .map((meta) => {
      const title = normalize(meta.name ?? "")
      const titleScore =
        title === targetTitle
          ? 100
          : title.includes(targetTitle) || targetTitle.includes(title)
            ? 45
            : 0

      // The catalog year is authoritative. A title that matches by name but
      // sits two or more years away is a different work — "Iron Man" (1989),
      // not "Iron Man" (2008) — and must lose rather than merely rank lower.
      const year = metaReleaseYear(meta)
      const delta = year === null ? null : Math.abs(year - target.year)
      const yearScore =
        delta === null ? 0 : delta === 0 ? 20 : delta === 1 ? 12 : -70

      return { meta, score: titleScore === 0 ? 0 : titleScore + yearScore }
    })
    .sort((left, right) =>
      right.score === left.score
        ? left.meta.id.localeCompare(right.meta.id)
        : right.score - left.score
    )

  // 60 keeps an exact-title/wrong-era hit and a fuzzy-title/right-year hit out.
  const best = ranked[0]
  return best && best.score >= 60 ? best.meta : null
}
