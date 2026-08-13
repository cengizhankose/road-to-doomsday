/**
 * Deterministic poster placeholder used by the screenshot interceptor so the
 * catalog and detail pages render without any real network dependency. Every
 * catalog id maps to the same SVG on every run — a stable hash picks the hue,
 * so the mosaic looks poster-like instead of uniform grey.
 */
import { catalog } from "../../src/data/catalog.js"

/** djb2 — small, dependency-free, plenty stable enough for a hue choice. */
function hash(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return h >>> 0
}

function initials(title: string): string {
  const parts = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "MCU"
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase()
  return parts
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join("")
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

const catalogById = new Map(catalog.map((item) => [item.id, item] as const))

export function posterSvgForCatalogId(catalogId: string): string {
  const item = catalogById.get(catalogId)
  const title = item?.title ?? catalogId
  const year = item?.year ?? ""
  const hue = hash(catalogId) % 360
  const bgTop = `hsl(${hue}, 55%, 22%)`
  const bgBottom = `hsl(${(hue + 40) % 360}, 65%, 12%)`
  const accent = `hsl(${(hue + 200) % 360}, 70%, 55%)`
  const label = escapeXml(initials(title))
  const yearLabel = escapeXml(String(year))

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="200" height="300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bgTop}" />
      <stop offset="1" stop-color="${bgBottom}" />
    </linearGradient>
  </defs>
  <rect width="200" height="300" fill="url(#g)" />
  <rect x="0.5" y="0.5" width="199" height="299" fill="none" stroke="#ffffff" stroke-opacity="0.12" />
  <circle cx="100" cy="130" r="46" fill="${accent}" fill-opacity="0.9" />
  <text x="100" y="145" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="34" font-weight="800" fill="#0b0b0d" letter-spacing="1">${label}</text>
  <text x="100" y="230" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="10" font-weight="600" fill="#f4f4f5" letter-spacing="2">MCU</text>
  <text x="100" y="252" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" fill="#d4d4d8">${yearLabel}</text>
</svg>`
}
