import { createHash, timingSafeEqual } from "node:crypto"
import type { VercelRequest } from "./types.js"

export const SESSION_COOKIE = "__Host-rtd_session"

function requiredInviteToken(): string {
  const token = process.env.INVITE_TOKEN
  if (!token || token.length < 22) {
    throw new Error("INVITE_TOKEN must contain at least 128 bits of entropy")
  }
  return token
}

export function sessionValue(): string {
  return createHash("sha256")
    .update(`road-to-doomsday:${requiredInviteToken()}`)
    .digest("base64url")
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function inviteTokenMatches(candidate: string): boolean {
  return safeEqual(candidate, requiredInviteToken())
}

export function isAuthorized(req: VercelRequest): boolean {
  const cookies = Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => Boolean(key && value)),
  )
  return safeEqual(cookies[SESSION_COOKIE] ?? "", sessionValue())
}

export function hasSameOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  const forwarded = req.headers["x-forwarded-proto"]
  const protocol = Array.isArray(forwarded) ? forwarded[0] : forwarded || "https"

  return typeof origin === "string" && Boolean(host) && origin === `${protocol}://${host}`
}

export function sessionCookie(): string {
  return `${SESSION_COOKIE}=${sessionValue()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
}
