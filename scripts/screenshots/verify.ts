/**
 * CI-friendly staleness check for the README screenshots.
 *
 * Recomputes the manifest's `inputsHash` from the source tree and compares it
 * to the committed value. If any manifest input has changed since the last
 * regeneration, the check fails with a pointer to `npm run screenshots` — the
 * generator writes the same manifest so a clean run makes the check pass.
 * Nothing here loads the screenshots themselves, so it is cheap enough to run
 * on every CI push.
 */
import { existsSync, readFileSync } from "node:fs"

import { MANIFEST_PATH, hashInputs, type ScreenshotManifest } from "./manifest.js"

function loadManifest(): ScreenshotManifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `No manifest at ${MANIFEST_PATH}. Run \`npm run screenshots\` and commit the result.`,
    )
  }
  const parsed: unknown = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { version?: unknown }).version !== 1
  ) {
    throw new Error(`Manifest ${MANIFEST_PATH} is not version 1`)
  }
  return parsed as ScreenshotManifest
}

function main(): void {
  const manifest = loadManifest()
  const { inputsHash, inputs } = hashInputs()

  if (manifest.inputsHash === inputsHash) {
    process.stdout.write(`Screenshots are current (${inputsHash.slice(0, 12)}…)\n`)
    return
  }

  process.stderr.write("Screenshots are stale — regenerate with `npm run screenshots`.\n")
  const drifted: string[] = []
  for (const [file, hash] of Object.entries(inputs)) {
    if (manifest.inputs[file] !== hash) drifted.push(file)
  }
  for (const file of Object.keys(manifest.inputs)) {
    if (!(file in inputs)) drifted.push(`${file} (missing)`)
  }
  if (drifted.length) {
    process.stderr.write("Drifted inputs:\n")
    for (const file of drifted) process.stderr.write(`  - ${file}\n`)
  }
  process.stderr.write(`expected ${manifest.inputsHash}\n`)
  process.stderr.write(`actual   ${inputsHash}\n`)
  process.exit(1)
}

main()
