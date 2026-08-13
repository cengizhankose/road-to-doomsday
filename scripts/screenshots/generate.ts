/// <reference lib="dom" />
/**
 * Regenerate the three README screenshots from a running dev server.
 *
 * The dev-mode adapter reads state from localStorage, so seeding the browser
 * once and reloading is enough to reach the pinned composition. External
 * poster requests are intercepted and answered with a locally generated SVG,
 * so this script has no network dependency and produces the same layout on
 * every machine.
 *
 * The `page.evaluate` callbacks below run inside the browser, so DOM globals
 * like `window` and `document` need to type-check even though the surrounding
 * script is Node — that is what the triple-slash reference on line 1 is for.
 */
import { spawn, type ChildProcess } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { chromium, type Route } from "playwright"

import {
  LOCAL_STORAGE_KEY,
  TARGETS,
  VIEWPORT,
  buildSeedState,
} from "./fixtures.js"
import {
  MANIFEST_PATH,
  REPO_ROOT,
  hashInputs,
  readImageDimensions,
  type ScreenshotManifest,
} from "./manifest.js"
import { posterSvgForCatalogId } from "./poster.js"

const PORT = Number(process.env.SCREENSHOT_PORT ?? 5178)
const HOST = "127.0.0.1"
const BASE_URL = `http://${HOST}:${PORT}`

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" })
      if (response.status < 500) return
      lastError = new Error(`Server replied ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(
    `Dev server never came up on ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

function startDevServer(): ChildProcess {
  const child = spawn(
    "npx",
    ["vite", "--host", HOST, "--port", String(PORT), "--strictPort"],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, BROWSER: "none", FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  child.stdout?.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`))
  child.stderr?.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`))
  return child
}

/**
 * Extract a catalog id from a synthetic poster URL. Fixture URIs follow the
 * `/poster/small/<id>/img` shape — anything else falls back to `unknown`, so
 * a mis-shaped request still gets a placeholder rather than a hang.
 */
function catalogIdFromUrl(url: string): string {
  const match = url.match(/\/poster\/[^/]+\/([^/]+)\/img$/)
  return match?.[1] ?? "unknown"
}

async function fulfillPoster(route: Route): Promise<void> {
  const id = catalogIdFromUrl(route.request().url())
  await route.fulfill({
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: posterSvgForCatalogId(id),
  })
}

async function captureAll(): Promise<ScreenshotManifest["screenshots"]> {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({
      viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "UTC",
    })
    await context.route("**/images.metahub.space/**", fulfillPoster)
    await context.route("**/m.media-amazon.com/**", fulfillPoster)

    const seed = buildSeedState()

    const page = await context.newPage()
    // Prime localStorage on the origin before the app ever loads, so the very
    // first render already sees the seeded state — no flash of empty routes.
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" })
    await page.evaluate(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [LOCAL_STORAGE_KEY, JSON.stringify(seed)] as const,
    )

    const results: ScreenshotManifest["screenshots"] = {}
    for (const target of TARGETS) {
      await page.goto(`${BASE_URL}${target.route}`, { waitUntil: "networkidle" })
      await page.waitForSelector(target.waitFor, { state: "visible" })
      // Fonts settle a beat after paint; without this the top nav can screenshot
      // with a fallback face and drift between runs even under fixture control.
      await page.evaluate(() => document.fonts.ready)
      // The catalog page marks its poster <img> elements `loading="lazy"`, so
      // even with the interceptor answering instantly the decoded pixels are
      // not guaranteed to be on screen at network-idle. Scrolling the entire
      // list into view once forces every image to start, then waiting for each
      // to `complete` closes the decode race before the shot is taken.
      await page.evaluate(async () => {
        const { scrollY } = window
        const scrollHeight = document.documentElement.scrollHeight
        for (let y = 0; y < scrollHeight; y += 400) {
          window.scrollTo(0, y)
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        window.scrollTo(0, scrollY)
        const images = Array.from(document.images)
        await Promise.all(
          images.map((image) =>
            image.complete && image.naturalWidth > 0
              ? image.decode().catch(() => undefined)
              : new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), { once: true })
                  image.addEventListener("error", () => resolve(), { once: true })
                }).then(() => image.decode().catch(() => undefined)),
          ),
        )
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      })
      const absolute = path.join(REPO_ROOT, target.outputPath)
      mkdirSync(path.dirname(absolute), { recursive: true })
      await page.screenshot({
        path: absolute,
        fullPage: false,
        omitBackground: false,
        animations: "disabled",
        caret: "hide",
      })
      const dimensions = readImageDimensions(absolute)
      results[target.name] = dimensions
      // Terse log so `npm run screenshots` is legible when re-run twice.
      process.stdout.write(
        `  ${target.name.padEnd(8)} ${target.outputPath}  ${dimensions.width}x${dimensions.height}\n`,
      )
    }
    await context.close()
    return results
  } finally {
    await browser.close()
  }
}

function writeManifest(screenshots: ScreenshotManifest["screenshots"]): void {
  const { inputsHash, inputs } = hashInputs()
  const manifest: ScreenshotManifest = {
    version: 1,
    inputsHash,
    inputs,
    screenshots,
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function main(): Promise<void> {
  const server = startDevServer()
  const serverExit = new Promise<never>((_, reject) => {
    server.once("exit", (code) => {
      reject(new Error(`vite exited with code ${code ?? "unknown"} before screenshots ran`))
    })
  })

  try {
    await Promise.race([waitForServer(`${BASE_URL}/`, 30_000), serverExit])
    const screenshots = await Promise.race([captureAll(), serverExit])
    writeManifest(screenshots)
    process.stdout.write(`Wrote ${MANIFEST_PATH}\n`)
  } finally {
    if (server.exitCode === null) {
      server.kill("SIGTERM")
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          server.kill("SIGKILL")
          resolve()
        }, 3_000)
        server.once("exit", () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
