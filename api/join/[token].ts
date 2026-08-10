import type { VercelRequest, VercelResponse } from "../_lib/types.js"

import {
  inviteTokenMatches,
  sessionCookie,
} from "../_lib/auth.js"

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const candidate = Array.isArray(req.query.token)
    ? req.query.token[0]
    : req.query.token

  if (!candidate || !inviteTokenMatches(candidate)) {
    return res.status(404).json({ error: "Not found" })
  }

  res.setHeader("Set-Cookie", sessionCookie())
  return res.redirect(302, "/")
}
