/**
 * Out Plane entry server for Road to Doomsday.
 *
 * Vercel Functions (api/*.ts) map 1:1 to Express routes here. Handlers keep
 * their VercelRequest/VercelResponse shape; tiny adapters translate
 * express(req,res) <-> that interface so ZERO handler code changes.
 */
import express from "express"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const joinHandler = (await import("./api/join.js")).default
const progressHandler = (await import("./api/progress.js")).default
const selectionHandler = (await import("./api/selection.js")).default
const pushSubscriptionHandler = (await import("./api/push-subscription.js")).default

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, "dist")

const app = express()

// Parse JSON bodies the same way Vercel does (size cap enforced in handlers).
app.use(express.json({ limit: "64kb" }))

/** Wrap express req/res into the Vercel-like interface the handlers expect. */
function adapt(handler: (req: any, res: any) => Promise<unknown>) {
  return (req: express.Request, res: express.Response) => {
    const vReq = {
      method: req.method,
      headers: req.headers as any,
      query: req.query as Record<string, string | string[] | undefined>,
      body: req.body,
    }
    // Handlers use the res methods our VercelResponse type declares:
    // setHeader/status/json/redirect/end — all exist on express.Response.
    Promise.resolve(handler(vReq, res as unknown as any)).catch((err) => {
      console.error("[api] handler error:", err)
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal error" })
      } else {
        res.end()
      }
    })
  }
}

app.post("/api/join", adapt(joinHandler))
app.all("/api/progress", adapt(progressHandler))
app.patch("/api/selection", adapt(selectionHandler))
app.all("/api/push-subscription", adapt(pushSubscriptionHandler))

// Static SPA
app.use(express.static(DIST, { index: false, maxAge: "1h" }))
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"))
})

const PORT = Number(process.env.PORT || 3000)
app.listen(PORT, () => {
  console.log(`rtd server listening on :${PORT}`)
})
