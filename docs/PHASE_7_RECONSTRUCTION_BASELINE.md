# Phase 7 — Reconstruction Baseline

> Wave 1 deliverable. Measured on the development machine before any Phase 7
> architecture changes. Numbers without a measurement source are explicitly
> marked **(not measured)** and must not be cited as improvements later.

Date captured: 2026-06-15
Next.js: 16.2.7 (Turbopack) · React 19.2.4 · Node 20 · TypeScript 5

---

## 1. Build & toolchain timings (measured)

| Metric | Value | Source |
| --- | --- | --- |
| `next build` total wall clock | ~24.2 s | `npm run build` (includes npm/tsx startup) |
| Turbopack compile | 3.8 s | build log "Compiled successfully in 3.8s" |
| Build-time TypeScript | 5.8 s | build log "Finished TypeScript in 5.8s" |
| Static generation (13 pages) | ~0.2 s | build log "Generating static pages ... in 199ms" |
| `npx tsc --noEmit` standalone | ~23.3 s | command wall clock (includes npm warm) |
| `npm run lint` | ~19.8 s | command wall clock |

Notes:
- The Turbopack production build summary in this Next.js version **does not emit
  the per-route "First Load JS" table**. Route bundle sizes are therefore
  **(not measured)** via the standard build output and must be obtained another
  way (see §6 follow-ups) before claiming bundle-size deltas.
- A `next dev` server is currently running; concurrent `next build` was avoided
  during some measurements to prevent `.next` contention.

---

## 2. Route inventory (measured from build output)

- Total app routes rendered in build: 124 entries (pages + route handlers).
- API route handler files: **88** (from `security:api` scanner).
  - `/api/advisor/**`: 44 handlers
  - `/api/admin/**`: 6 handlers
  - remaining: client, my-adviser, auth, health, debug, google-calendar.
- Static (prerendered) routes: `/`, `/_not-found`, legal pages,
  `/annual-review/print`, `/wealth-blueprint/print`.
- All authenticated app routes are `ƒ` (dynamic / server-rendered on demand),
  consistent with `export const dynamic = "force-dynamic"` usage.

### Client routes audited
`/dashboard`, `/discover`, `/shield-diagnostic`, `/budget-optimiser`,
`/promotions`, `/my-adviser`, `/document-vault`, `/profile`, `/roadmap`,
`/stress-testing`, `/wealth-blueprint`, `/annual-review` (+ `/print`).

### Adviser routes audited
`/advisor`, `/advisor/my-profile`, `/advisor/clients`,
`/advisor/clients/[clientId]`, `/advisor/appointments`, `/advisor/promotions`,
`/advisor/feedback`, `/advisor/protection-report`
(+ legacy redirects `/advisor/setup`, `/advisor/calendar`).

### Admin routes audited
`/admin` and `/api/admin/**` (users, role, clients, client-invitations,
create-placeholder).

---

## 3. Client/server component footprint (measured)

| Metric | Value | Source |
| --- | --- | --- |
| `"use client"` components under `components/` | ~160 files | grep count |
| `"use client"` files under `app/` | 5 (error boundaries + 2 print pages) | grep |
| Server components / loaders | majority of `app/**/page.tsx` | inspection |

Observation: most page shells are server components, but a large number of
**leaf and mid-level client components fetch their own data from `/api/**`
after hydration** (e.g. adviser calendar status, adviser profile, several
client panels). This is the dominant data-waterfall pattern to address in
Waves 3–5.

---

## 4. Dependencies (measured from package.json + lockfile)

Runtime dependencies (7):
- `next@16.2.7`, `react@19.2.4`, `react-dom@19.2.4`
- `@supabase/ssr@^0.12.0`, `@supabase/supabase-js@^2.108.1`
- `html2canvas@^1.4.1`, `jspdf@^4.2.1`

Dev dependencies: `@tailwindcss/postcss@^4`, `tailwindcss@^4`, `eslint@^9`,
`eslint-config-next@16.2.7`, `typescript@^5`, `supabase@^2.105.0`, type packages.

Findings:
- **`recharts` already removed** (Phase 6F). No chart library remains; the
  Circular Shield is hand-rolled SVG/CSS.
- **`html2canvas` + `jspdf` are already dynamically imported** in
  `src/features/document-vault/generateProtectionReportPdf.ts` via
  `await Promise.all([import("html2canvas"), import("jspdf")])`, so PDF tooling
  is **not in any initial route bundle**. `canvg` etc. appear only as
  transitive deps of `jspdf`.
- No obvious duplicate date or utility libraries in direct dependencies.
- Candidate audit for Wave 7: confirm `html2canvas`/`jspdf` are reachable only
  from the protection-report/print flows and never statically imported.

npm package count (direct): 7 runtime + 9 dev = 16 direct. Full tree count
**(not measured)** — capture with `npm ls --all | wc -l` in Wave 7.

---

## 5. Data-access & query patterns (measured by inspection)

### Supabase client factories
- `lib/supabase/server.ts` — anon key, cookie-bound (Server Components / RSC).
- `lib/supabase/admin.ts` — **service-role**, `createAdminSupabaseClient()`
  returns a **new client on every call** (no memoization).
- `lib/supabase/client.ts` — browser anon client.
- `lib/supabase/middleware.ts` — session refresh in proxy/middleware.

### Auth / role resolution
- `requireAuthenticatedUser()` (`authGuards.ts`) is wrapped in React
  `cache()` → **request-scoped dedupe of `auth.getUser()` + users row**. Good.
- `getCurrentUserRole()` reuses the same cached call. Good.
- `requireAdvisorAccess()` / `requireAdminAccess()` build on it. Good.
- `ensureUserClientProfile()` (`userProfile.ts`) is **NOT cached** and performs
  `auth.getUser()` + users fetch + client fetch (+ provisioning) on every call.
  It is invoked by multiple client-scoped loaders and APIs per request →
  **repeated session/profile lookups** (waterfall + duplicate work).

### Service-role usage
- Many user-facing persistence modules read/write via the **service-role admin
  client** (e.g. `userProfile`, `adviserProfilePersistence`,
  dashboard/budget/document/promotions/feedback persistence). This means **RLS
  is a backstop, not the primary enforcement** on those paths; in-code
  authorization correctness is therefore safety-critical. `security:service-role`
  confirms the service role is never imported into browser code.

### Known query smells to quantify in later waves
- Broad `select("*")` in several loaders (e.g. `userProfile`,
  `adviserProfilePersistence`) → oversized payloads / column coupling.
- Per-component client-side fetching on tab changes (adviser client workspace,
  my-profile) → repeated round-trips.
- Per-call `createAdminSupabaseClient()` construction overhead across a request.

---

## 6. Integrations (baseline state)

- **Supabase**: SSR cookie auth + service-role admin; 21 ordered migrations in
  `supabase/migrations/`.
- **Google Calendar**: OAuth connect/callback with HMAC state
  (`verifyOAuthState`), encrypted token storage (`tokenEncryption.ts`,
  `GOOGLE_TOKEN_ENCRYPTION_KEY`), `fetchWithTimeout` on Google calls (Phase 6F),
  booking via `appointmentsPersistence` with availability recheck + compensating
  Google event cleanup. `qa:calendar` passes (11 assertion groups).
- **Vercel**: `middleware`/proxy convention (build warns middleware→proxy
  rename), `force-dynamic` routes, env via `.env.local` / Vercel project vars.

---

## 7. Regression suite status at baseline (all passing)

`security:api`, `security:advisor-access` (11/11), `security:service-role`,
`qa:my-adviser`, `qa:calendar`, `qa:my-clients`, `qa:phase6f`, `final:check`,
`npx tsc --noEmit`, `npm run lint`, `npm run build` — **all green** as of this
baseline.

---

## 8. Measurements still to capture (follow-ups)

These require either DB access or extra tooling and are explicitly deferred:
- Per-route First Load JS (Turbopack summary omits it) — capture via
  `@next/bundle-analyzer` or a webpack build, or `next build --turbo` size flag
  if available.
- Full transitive npm package count.
- Production DB query counts / waterfalls per page (needs runtime tracing).
- Duplicate `clients` row audit (needs service-role query against the live DB).
- Lighthouse / Web Vitals on deployed preview (needs a running deployment).
- Largest images / font-loading behavior (needs asset inventory + network trace).

Any Phase 7 "after" comparison must measure the same metric the same way as
captured here, or mark it **(not measured)**.
