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

- One `GET /api/progress` on initial production load (progress + manual selections)
- One `PATCH /api/progress` per explicit progress Save
- One `PATCH /api/selection` per explicit “Set as next” action
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
APP_ORIGIN=https://<production-domain>
```

Apply checked-in migrations:

```bash
npm run db:migrate
```

The database enforces credential hashing, household scope, one manual selection per route, status/score/progress limits, and item-level revisions. Stale writes return `409 Conflict` instead of silently overwriting another device.

## Private access

A private invite has this shape:

```text
https://<production-domain>/join#<single-use-invite>
```

The fragment never reaches Vercel/CDN logs or normal referrers. The SPA removes it from the address bar immediately and sends it once in a JSON `POST /api/join`. The server atomically consumes the short-lived invite hash, creates a separate random session, and returns a `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` cookie.

Only hashes are stored in Postgres. Revoking a session does not require changing or exposing an invite secret.

## Deploy

1. Create a Neon database.
2. Set `DATABASE_URL` locally and run `npm run db:migrate`.
3. Create one household and short-lived invite hash in Neon.
4. Import the private GitHub repository into Vercel.
5. Add `DATABASE_URL` and fixed `APP_ORIGIN` to Vercel Production environment variables.
6. Deploy, exchange a fresh invite on each approved device, and smoke-test GET/PATCH/conflict behavior.

The SPA rewrite in `vercel.json` explicitly excludes `/api`, assets, and icons. Authenticated API responses are private/no-store and the app ships a restrictive CSP.
