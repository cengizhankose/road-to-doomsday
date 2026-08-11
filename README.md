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

- One `GET /api/progress` on initial production load (progress, manual selections, catalog images, member identity, and public push config)
- One `PATCH /api/progress` per explicit progress Save
- Calendar scheduling uses the same progress PATCH and requests one best-effort push delivery; it does not refetch
- One `PATCH /api/selection` per explicit “Set as next” action
- One `POST /api/push-subscription` only when a member explicitly enables notifications on a device
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
VAPID_SUBJECT=mailto:<contact-email>
VAPID_PUBLIC_KEY=<public VAPID key>
VAPID_PRIVATE_KEY=<private VAPID key>
```

Apply checked-in migrations:

```bash
npm run db:migrate
```

The database enforces credential hashing, household/member scope, one manual selection per route, status/score/progress limits, and item-level revisions. Stale writes return `409 Conflict` instead of silently overwriting another device.

## Catalog artwork

Poster metadata is imported from the public [Cinemeta](https://v3-cinemeta.strem.io) catalog. There is **no API key**: nothing to ship to the browser, nothing to configure at runtime, nothing to rotate.

```bash
npm run images:import                              # dry run + private review file
DATABASE_URL=<url> npm run images:import -- --apply
```

Matching is deterministic — normalised title plus the catalog year, with the media type derived from the catalog entry and a short table of reviewed aliases for season-specific and stylised titles. A candidate whose release year is two or more years away loses even on an exact title, so "Iron Man" (1989) can never stand in for "Iron Man" (2008). Every chosen poster URL is fetched before it is recorded.

Every one of the 63 catalog ids gets a row. Titles with no published artwork yet keep their own row pointing at the self-hosted placeholder `/posters/fallback.svg` (`source: "fallback"`), so a missing poster is an explicit state rather than an absent mapping. Each run reports `verified`, `fallback`, and the fallback ids, and writes a private `0600` review file under `~/.hermes/secure/`.

Provenance is stored per row: `source` (`cinemeta` or `fallback`), the IMDb id, the upstream metadata URL, and the verification timestamp. Artwork is served from `m.media-amazon.com` and `images.metahub.space`; those two hosts are the only remote origins the image contract and the CSP accept.

Caveat, accepted deliberately for a private non-commercial tracker: Cinemeta is a community catalog with no URL-stability or licensing guarantee. Re-run the importer if artwork starts 404ing. The app credits Cinemeta and claims no relationship with TMDB or any rights holder.

## Private access

A private invite has this shape:

```text
https://<production-domain>/join#<single-use-invite>
```

The fragment never reaches Vercel/CDN logs or normal referrers. The SPA removes it from the address bar immediately and sends it once in a JSON `POST /api/join`. Each invite is bound to either Cengizhan or Sinem. The server atomically consumes the short-lived invite hash, carries that member identity into a separate random session, and returns a `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` cookie. There is no client-side “who are you?” selector.

Only hashes are stored in Postgres. Revoking a session does not require changing or exposing an invite secret.

## Push notifications

Web push is optional and requires an explicit user gesture. A plan made by one member is delivered only to subscriptions belonging to the other household member. Push endpoints are scoped in Postgres; expired (`404`/`410`) subscriptions are removed automatically. A failed notification never rolls back a saved plan.

On iPhone/iPad, web push requires iOS/iPadOS 16.4+ and the installed Home Screen PWA. Calendar and progress features remain usable when permission is denied or push is unsupported.

## Deploy

1. Create a Neon database.
2. Set `DATABASE_URL` locally and run `npm run db:migrate`. Migration `0001` seeds the two members **from the households that already exist**, clears pre-member invites and sessions, and adds the artwork and push tables.
3. On a brand new database there is no household yet, so nothing was seeded — create the household and its two members: `DATABASE_URL=<url> npx tsx scripts/create-household.ts`. (Skip this when migrating an existing deployment; the migration already seeded them, and the script refuses to create a second household.)
4. Import the private GitHub repository into Vercel.
5. Add `DATABASE_URL`, a fixed `APP_ORIGIN`, and the three `VAPID_*` values to Vercel Production environment variables. The private VAPID key lives only there.
6. Import artwork: `DATABASE_URL=<url> npm run images:import -- --apply`.
7. Mint one single-use invite per member: `DATABASE_URL=<url> APP_ORIGIN=<origin> npm run invites:create`. Raw links are written only to a `0600` file under `~/.hermes/secure/` — they are never printed.
8. Deploy, exchange a fresh invite on each approved device, and smoke-test GET/PATCH/conflict behavior.

The SPA rewrite in `vercel.json` explicitly excludes `/api`, assets, and icons. Authenticated API responses are private/no-store and the app ships a restrictive CSP.
