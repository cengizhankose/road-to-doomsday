import type { IncomingHttpHeaders } from "node:http"

export interface VercelRequest {
  method?: string
  headers: IncomingHttpHeaders
  query: Record<string, string | string[] | undefined>
  body: unknown
}

export interface VercelResponse {
  setHeader(name: string, value: string | string[]): this
  status(code: number): this
  json(body: unknown): this
  redirect(status: number, location: string): this
}
