# Road to Doomsday MVP Implementation Plan

**Goal:** Build a mobile-first shared MCU watch tracker for two people, with independent movie and series routes, explicit-save progress updates, and a dark cinematic design system.

**Architecture:** A React/Vite PWA bundles the static MCU catalog and calls small Vercel Functions only for shared progress. Neon Postgres stores one row per catalog item. A private invite URL is exchanged for an HttpOnly cookie; there is no login UI. The client performs one initial GET and one PATCH per explicit save—no polling or realtime subscriptions.

**Design system:** shadcn preset `b6WJzpzZli` (Nova, Zinc, Red, Space Grotesk/Inter, Lucide, small radius, translucent menu) on Radix UI.

**Stack:** React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui, React Router, TanStack Query, Zod, Vercel Functions, Neon Postgres, Drizzle, Vitest, React Testing Library, vite-plugin-pwa.

---

## Task 1 — Scaffold and quality gates

**Files:** `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `src/test/setup.ts`

1. Initialize the approved shadcn Vite preset.
2. Add router, query, validation, database, PWA, and testing dependencies.
3. Configure Vitest + jsdom and strict TypeScript.
4. Add scripts: `test`, `test:run`, `typecheck`, `lint`, `build`.
5. Verify an empty test run/build toolchain executes.

## Task 2 — Catalog domain (TDD)

**Files:**
- Create `src/domain/catalog.ts`
- Create `src/domain/catalog.test.ts`
- Create `src/data/catalog.ts`

1. Write failing tests for unique IDs, independent route ordering, movie/series metadata, and valid season/episode totals.
2. Implement catalog types and validation.
3. Add the corrected infographic catalog, preserving each branch's internal order.
4. Add missing MCU releases only when verified; label unreleased items and optional animation/specials explicitly.
5. Run the catalog tests.

## Task 3 — Progress model and selectors (TDD)

**Files:**
- Create `src/domain/progress.ts`
- Create `src/domain/progress.test.ts`

1. Write failing tests for status transitions, completion percentage, series episode clamping, and next-item selection per route.
2. Implement pure progress functions.
3. Verify movie and series routes produce separate next recommendations.

## Task 4 — Database schema and API contracts (TDD)

**Files:**
- Create `src/db/schema.ts`
- Create `src/api/contracts.ts`
- Create `src/api/contracts.test.ts`
- Create `api/progress.ts`
- Create `api/session.ts`
- Create `api/_lib/auth.ts`
- Create `drizzle.config.ts`

1. Write failing contract tests for GET/PATCH payload validation.
2. Add Drizzle schema for shared progress and schema version metadata.
3. Implement authenticated GET-all-progress and single explicit-save PATCH.
4. Implement invite-token-to-cookie exchange.
5. Add no-store headers and bounded payload validation.

## Task 5 — Query layer with bounded requests (TDD)

**Files:**
- Create `src/lib/progress-client.ts`
- Create `src/lib/query-client.ts`
- Create `src/lib/progress-client.test.ts`

1. Test that initial load uses one GET.
2. Test that save uses one PATCH and updates cache from the response without a follow-up GET.
3. Disable polling, focus refetch, reconnect refetch, and retry storms.
4. Add manual refresh as the only post-load sync control.

## Task 6 — Mobile application shell and dashboard (TDD)

**Files:**
- Modify `src/App.tsx`, `src/index.css`, `src/main.tsx`
- Create `src/components/app-shell.tsx`
- Create `src/components/route-card.tsx`
- Create `src/components/progress-ring.tsx`
- Create `src/pages/home-page.tsx`
- Create UI tests under matching `*.test.tsx`

1. Write failing accessible UI tests for two independent route cards and next-up actions.
2. Build the dark mobile-first shell using the approved shadcn tokens.
3. Show separate Movie Route and Series Route progress, next item, counts, and manual refresh.
4. Keep touch targets at least 44px and support safe-area padding.

## Task 7 — Catalog and detail editing (TDD)

**Files:**
- Create `src/pages/catalog-page.tsx`
- Create `src/pages/detail-page.tsx`
- Create `src/components/status-control.tsx`
- Create `src/components/score-control.tsx`
- Create `src/components/series-progress-control.tsx`
- Create UI tests under matching `*.test.tsx`

1. Test movie/series route filtering and order.
2. Test local draft edits do not call the API.
3. Test a single explicit Save sends status, date, scores, notes, and episode progress together.
4. Build detail editing with optimistic local feedback and clear unsaved state.

## Task 8 — PWA and production readiness

**Files:** `vite.config.ts`, `public/manifest.webmanifest`, icons, `.env.example`, `vercel.json`, `README.md`

1. Configure installable PWA and static asset caching only.
2. Never cache authenticated progress API responses.
3. Document Neon/Vercel environment variables and migrations.
4. Add responsive metadata and production headers.

## Task 9 — Verification

1. Run unit/component tests.
2. Run typecheck, lint, and production build.
3. Launch locally and verify mobile widths visually.
4. Confirm request behavior in browser/network logs: one initial GET, one PATCH per Save, no polling.
5. Run accessibility checks and fix critical findings.

## Task 10 — Remote setup and deploy

1. Create the GitHub repository only after local verification.
2. Create/connect Neon and apply migration.
3. Configure Vercel environment variables.
4. Deploy production and verify both private invite URLs on the live URL.
