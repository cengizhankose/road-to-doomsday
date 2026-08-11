import { createHash, randomBytes } from "node:crypto"

import type { VercelRequest } from "./types.js"

export const SESSION_COOKIE = "__Host-rtd_session"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url")
}

/**
 * A non-secret, one-way marker of "which session am I on".
 *
 * A device needs to know when its stored push subscription is still bound to a
 * session that has since been replaced, so it can re-register. It cannot read
 * the HttpOnly cookie, so the server hands it this derivative instead: stable
 * for the life of a session, different after a re-join, and useless as a
 * credential — it is a second hash of an already-hashed 256-bit token.
 */
export function pushBindingId(sessionHash: string): string {
  return createHash("sha256")
    .update(`rtd-push-binding:${sessionHash}`)
    .digest("hex")
    .slice(0, 32)
}

export function readSessionToken(req: VercelRequest): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key === SESSION_COOKIE && value) return value
  }
  return null
}

export function hasAllowedOrigin(req: VercelRequest): boolean {
  const allowedOrigin = process.env.APP_ORIGIN
  return Boolean(
    allowedOrigin &&
      typeof req.headers.origin === "string" &&
      req.headers.origin === allowedOrigin,
  )
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}
