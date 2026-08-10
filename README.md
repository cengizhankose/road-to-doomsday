# Road to Doomsday

A private, mobile-first MCU watch tracker for two people. Movies and series remain independent routes toward *Avengers: Doomsday*.

## Stack

- React 19, Vite, TypeScript, Tailwind CSS 4
- shadcn/ui preset `b6WJzpzZli` on Radix UI
- TanStack Query with explicit-save updates and no polling
- Vercel Functions + Neon Postgres + Drizzle
- Vitest, Testing Library, ESLint
- Installable PWA

## Request model

- One `GET /api/progress` on initial production load
- One `PATCH /api/progress` per explicit Save
- No polling, realtime subscription, focus refetch, reconnect refetch, or save-after-refetch
- Static MCU catalog ships in the application bundle
- PWA service worker never caches `/api/*`

## Local development

```bash
npm install
npm run dev
```

Development mode uses a clearly isolated localStorage adapter (`rtd-dev-progress`) so UI work does not require a live database. Production builds always use the authenticated API.

## Quality gates

```bash
npm run test:run
npm run typecheck
npm run lint
npm run build
```

## Database and environment

Copy `.env.example` to `.env.local` and set:

```text
DATABASE_URL=<Neon pooled connection string>
INVITE_TOKEN=<at least 128 bits of URL-safe random data>
```

Generate a token with:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

Apply checked-in migrations:

```bash
npm run db:migrate
```

The database enforces status, score, season/episode, and note-length constraints. Progress writes use a `revision` field; stale writes return `409 Conflict` instead of silently overwriting another device.

## Private access

Open this URL once on each approved device:

```text
https://<production-domain>/api/join/<INVITE_TOKEN>
```

The endpoint exchanges the token for a `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` cookie and redirects to `/`. Rotating `INVITE_TOKEN` invalidates existing sessions.

This is capability-link security: anyone who receives the private link can access the shared tracker. Do not publish or commit the token.

## Deploy

1. Create a Neon database.
2. Set `DATABASE_URL` locally and run `npm run db:migrate`.
3. Import the GitHub repository into Vercel.
4. Add `DATABASE_URL` and `INVITE_TOKEN` to Vercel Production environment variables.
5. Deploy and verify both private device links.

The SPA rewrite in `vercel.json` explicitly excludes `/api`, assets, and icons.
