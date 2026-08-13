/**
 * Manifest of everything a README screenshot depends on.
 *
 * A byte-for-byte PNG comparison across engineers' machines would trip on
 * font-hinting and antialiasing differences that do not represent staleness,
 * so instead a manifest records the hash of every input that shapes the
 * screenshots: the fixture, the poster generator, the pages the screenshots
 * render, and the shell/theme that wraps them. If any of those change, the
 * committed manifest no longer matches — and the check tells the maintainer
 * to regenerate. This intentionally lets font-rendering drift slide by while
 * still catching real drift between what the app renders and what the README
 * shows.
 */
import { createHash } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(scriptDir, "..", "..")

/**
 * Inputs listed relative to the repository root. Adding a component that ends
 * up visible in a screenshot means adding it here — the whole point is that
 * the manifest tells the truth about what the screenshots depend on.
 */
export const MANIFEST_INPUTS = [
  "scripts/screenshots/fixtures.ts",
  "scripts/screenshots/poster.ts",
  "src/data/catalog.ts",
  "src/domain/catalog.ts",
  "src/domain/progress.ts",
  "src/domain/images.ts",
  "src/pages/home-page.tsx",
  "src/pages/catalog-page.tsx",
  "src/pages/detail-page.tsx",
  "src/components/app-shell.tsx",
  "src/components/bottom-nav.tsx",
  "src/components/route-card.tsx",
  "src/components/progress-ring.tsx",
  "src/components/mini-calendar.tsx",
  "src/components/notification-prompt.tsx",
  "src/components/poster-credit.tsx",
  "src/components/save-celebration.tsx",
  "src/components/action-error-notice.tsx",
  "src/components/private-access-gate.tsx",
  "src/index.css",
  "public/posters/fallback.svg",
] as const

export const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "docs",
  "screenshots",
  "manifest.json",
)

export interface ScreenshotManifest {
  version: 1
  inputsHash: string
  inputs: Record<string, string>
  /**
   * Dimensions of each committed screenshot. Byte-for-byte hashes vary across
   * OS and browser builds (font rasterisation, image decode timing), so the
   * verify check compares `inputsHash` only — this block is here so a viewer
   * can confirm the shapes are what they should be without opening the files.
   */
  screenshots: Record<string, { width: number; height: number }>
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function hashInputs(): { inputsHash: string; inputs: Record<string, string> } {
  const inputs: Record<string, string> = {}
  for (const relative of MANIFEST_INPUTS) {
    const absolute = path.join(REPO_ROOT, relative)
    if (!existsSync(absolute)) {
      throw new Error(`Screenshot manifest input missing: ${relative}`)
    }
    inputs[relative] = sha256(readFileSync(absolute))
  }
  const joined = Object.entries(inputs)
    .map(([relative, hash]) => `${relative}:${hash}`)
    .join("\n")
  return { inputsHash: sha256(Buffer.from(joined)), inputs }
}

export function readImageDimensions(pngPath: string): { width: number; height: number } {
  const buffer = readFileSync(pngPath)
  if (buffer.length < 24) throw new Error(`Not a PNG: ${pngPath}`)
  if (buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`Not a PNG: ${pngPath}`)
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

