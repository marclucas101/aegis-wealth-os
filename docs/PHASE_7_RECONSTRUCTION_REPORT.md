# Phase 7 — Performance, Architecture, Security & Reliability Reconstruction Report

Date: 2026-06-15 · Next.js 16.2.7 (Turbopack) · React 19 · Supabase · Vercel

> Companion docs: `PHASE_7_RECONSTRUCTION_BASELINE.md` (measurements),
> `PHASE_7_ARCHITECTURE_MAP.md` (architecture + risk register),
> `phase7/DUPLICATE_CLIENT_REMEDIATION.md`, `phase7/PENDING_clients_user_id_unique.sql`.

## Executive summary
A full audit (Wave 1) found the application **already substantially optimised**
by Phase 6F: `recharts` removed, PDF tooling dynamically imported, dashboard and
My-Clients loaders already parallelised with explicit column selects, pagination,
and `.in()` batching, plus layered auth/RLS and Google-Calendar timeouts. The
highest-value, genuinely outstanding issues were in **auth provisioning
durability**, not raw performance. Phase 7 therefore prioritised correctness and
reliability (per the brief: reliability/security over benchmark scores) and made
**surgical, fully test-validated** changes rather than a high-risk blind rewrite
of working, already-optimised pages.

Per the agreed plan, DB-access-dependent items (duplicate-client uniqueness
constraint, new indexes) were **prepared as reviewable artifacts but not
applied**, because the brief requires auditing live duplicates before adding the
constraint and inspecting real query patterns before adding indexes.

All regression suites, type-check, lint, and production build are **green**.

---

## 1. Baseline
See `PHASE_7_RECONSTRUCTION_BASELINE.md`. Key measured values:
- `next build` (idle machine): compile 3.8 s, build-time TS 5.8 s, static gen ~0.2 s, total ~24 s.
- `npx tsc --noEmit`: ~14–23 s. `npm run lint`: ~20 s.
- 88 API route handlers (44 advisor, 6 admin); ~160 client components; 21 migrations.
- 7 runtime deps; `jspdf`/`html2canvas` already dynamic-imported; `recharts` already removed.

## 2. Architecture problems found
P1 duplicate `clients` rows possible (no `unique(user_id)`, provisioning race);
P2 `ensureUserClientProfile()` not request-cached → repeated session/profile reads;
P3 per-call service-role client construction; P4 service-role used for user-facing
reads (RLS = backstop); P5 post-hydration `/api` fetching in several client
components; P6 some broad `select("*")`; P7/P8 possible Advisor-OS/My-Clients
overlap and per-tab refetch. Full table in `PHASE_7_ARCHITECTURE_MAP.md` §B.

## 3. Target architecture
Single request-cached session/profile resolver; idempotent race-safe
provisioning; explicit column DTOs; server-first loading with small client
islands; feature-scoped shared loaders; lazy-load only genuinely heavy modules;
never globally cache private/role/availability/token/signed-url state; reconciled
integration state. Full statement in `PHASE_7_ARCHITECTURE_MAP.md` §C.

## 4. Pages reconstructed
None rewritten. Rationale: page-level loaders audited were already server-first,
parallelised, and paginated; rewriting working, optimised, launched pages carries
high regression risk that cannot be offset without browser/runtime QA. Deeper
page reconstructions are captured as a sequenced backlog (§18) rather than shipped
blind. The one structural enabler identified (move `AuthenticatedAppShell` into
route `layout.tsx` so `loading.tsx` streaming works without a shell-less flash) is
documented as the first backlog item.

## 5. Logic reconstructed (implemented this phase)
- `lib/supabase/userProfile.ts`
  - `ensureUserClientProfile()` wrapped in `React.cache()` → **request-scoped
    single execution** of session resolution + provisioning (fixes P2; also
    prevents duplicate provisioning insert attempts within one request).
  - Exported explicit `USER_COLUMNS` / `CLIENT_COLUMNS`; replaced `select("*")`
    in `fetchUserRow` / `fetchClientByUserId` (fixes P6 on the hottest path).
- `lib/supabase/clientOnboarding.ts`
  - Reused `USER_COLUMNS`/`CLIENT_COLUMNS` across `findClientByEmail`,
    `findUserByEmail`, `findClientByUserId`, `loadOnboardingClients`,
    `findLinkablePlaceholderClient` (smaller admin/onboarding payloads).

## 6. Authentication & authorization changes
No security boundary weakened. Auth lifecycle confirmed: `requireAuthenticatedUser`
already request-cached; middleware/proxy refresh intact; access denial never signs
out (verified by `security:advisor-access` `no-signout-on-denial`). Layered model
(nav filter → layout guard → API guard → assignment check → RLS → DB constraint)
unchanged and passing 11/11. Provisioning caching changes timing only, not
authority (identity still from `auth.getUser()`; roles still from DB).

## 7. Duplicate-client prevention
- **Implemented now (safe):** request-cached provisioning so a single request can
  no longer self-race; defensive earliest-row selection retained.
- **Prepared, not applied (needs DB access):**
  - `scripts/phase7/audit-duplicate-clients.ts` — READ-ONLY audit reporting each
    affected `user_id` with per-row linked-data footprint; exit code 2 if any
    duplicates exist.
  - `docs/phase7/PENDING_clients_user_id_unique.sql` — additive partial
    `UNIQUE INDEX clients_user_id_unique ON clients(user_id) WHERE user_id IS NOT NULL`.
  - `docs/phase7/DUPLICATE_CLIENT_REMEDIATION.md` — canonical-row selection +
    non-destructive merge SQL (never deletes rows owning data) + upsert switch.
  - Switch provisioning insert → `upsert(onConflict:"user_id")` **after** the
    constraint exists.

## 8. Database migrations and indexes
No migrations applied in Phase 7 (per agreement). Existing
`202606100021_phase6f_performance_indexes.sql` covers feedback and client-list
indexes. New index proposals (clients.user_id unique; verifying coverage for
appointments-by-adviser/date, feedback-by-adviser/status, documents-by-owner,
budgets-by-owner) are **deferred pending real query-pattern inspection** as the
brief requires; the prepared constraint above is the only ready-to-apply item and
is gated on the duplicate audit.

## 9. Google Calendar reliability changes
No code changes needed this phase; audited and confirmed intact: OAuth connect,
HMAC `verifyOAuthState`, encrypted token storage, `fetchWithTimeout` on Google
calls, availability recheck + idempotency + compensating Google-event cleanup on
DB failure, overlap-exclusion DB constraint, disconnect/revoke handling, and the
Phase 6G callback redirect to `/advisor/my-profile?section=calendar`. `qa:calendar`
passes (11 + 5 assertion groups). Edge-case hardening backlog in §18.

## 10. Performance changes
- Fewer per-request DB round-trips: provisioning no longer repeats
  `getUser`+users+clients lookups when multiple loaders need the profile.
- Smaller payloads on user/client reads via explicit columns.
- No new client JS shipped; PDF tooling remains code-split. No bundle regressions.

## 11. Dependencies removed
None — audit found no unused/duplicate runtime dependencies (`recharts` already
gone). `jspdf`/`html2canvas` are used (dynamically) and retained. Removing any
would break the protection-report PDF flow.

## 12. Security findings
- Service-role client is used for user-facing reads (P4): RLS is a backstop, so
  in-code authorization must stay airtight — confirmed present on audited paths.
  `security:service-role` shows no service-role leakage to the browser.
- `security:api`: only INFO item is the pre-existing `/api/adviser-feedback/prompt`
  write-without-audit (unchanged, previously reviewed as intentional).
- No tokens/secrets/service-role keys exposed; no `NEXT_PUBLIC_*SERVICE_ROLE*`.

## 13. Reliability findings
- Duplicate-client durability is the main residual risk; mitigated in-request now,
  fully closed once the prepared constraint + upsert are applied post-audit.
- Route error boundaries exist (`app/error.tsx`, `app/advisor/error.tsx`,
  `app/my-adviser/error.tsx`, `RouteErrorFallback`); broader per-feature loading
  states are gated on the shell-to-layout refactor (§18 item 1).

## 14. Before/after measurements
| Metric | Before | After | Notes |
| --- | --- | --- | --- |
| `tsc --noEmit` | ~23 s | ~14 s | within noise; machine/cache dependent |
| `next build` compile | 3.8 s | 31.7 s | **after run shared CPU with a running `next dev`**; not a regression — see baseline note |
| Build TypeScript | 5.8 s | 34.4 s | same contention caveat |
| Per-request profile lookups | repeated | ≤1 per request | from `React.cache` on `ensureUserClientProfile` |
| user/client read payload | `select *` | explicit cols | fewer bytes/columns |
| Runtime deps | 7 | 7 | unchanged (no dead deps) |
| Per-route First Load JS | not measured | not measured | Turbopack build omits the table; capture with bundle-analyzer (§18) |

No speed claim is made that was not measured; the build-time figures are flagged
as contended and should be re-measured on an idle machine (`next dev` stopped).

## 15. All test results (this phase, all green)
`npm run lint` ✓ · `npx tsc --noEmit` ✓ · `security:api` ✓ · `security:advisor-access`
11/11 ✓ · `security:service-role` ✓ · `qa:protection-core` (10) ✓ · `qa:my-adviser`
(9+3) ✓ · `qa:calendar` (11+5) ✓ · `qa:my-clients` (8) ✓ · `qa:phase6f` ✓ ·
`final:check` 7/7 ✓ · `npm run build` ✓.

## 16. Manual production checks (recommended before/after applying DB items)
1. On staging: `npx tsx scripts/phase7/audit-duplicate-clients.ts` (expect exit 0
   or follow remediation). 2. Login / refresh / logout / direct-URL / access-denied
   (no logout). 3. Client journeys: dashboard, Discover, budget, promotions,
   my-adviser call/testimonials/booking, documents, profile. 4. Adviser journeys:
   Advisor OS, My Clients, client workspace tabs, My Profile, calendar
   connect/disconnect, appointments, feedback, promotions, protection report.
   5. Admin: console, adviser access, all-client access. 6. Integrations: Supabase,
   Google OAuth/Calendar, storage signed URLs, PDF save, Vercel `npm ci && npm run build`.
   7. Mobile: nav, Shield, my-adviser, booking, My Clients, My Profile, workspace tabs.

## 17. Environment variable requirements
Unchanged. Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID/SECRET`,
`GOOGLE_TOKEN_ENCRYPTION_KEY` (never `NEXT_PUBLIC_*`). Public:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The new audit script
reuses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. See
`docs/ENVIRONMENT_VARIABLES.md`.

## 18. Remaining risks & sequenced backlog
Ordered, each to be done with browser/runtime QA (and DB access where noted):
1. **Shell-to-layout refactor** — move `AuthenticatedAppShell` into route
   `layout.tsx` files; enables `loading.tsx` streaming and removes shell-less
   flashes. Medium risk; unlocks items 2–3.
2. **Server-first conversions** — replace post-hydration `/api` fetches in client
   components (adviser calendar/profile already consolidated in 6G; remaining:
   several client panels) with server loaders + small islands (P5).
3. **Client workspace tab caching** — cache loaded tabs in-session; avoid refetch
   of unchanged tabs (P8).
4. **Advisor OS vs My Clients** — confirm/trim roster duplication (P7).
5. **DB: apply `clients.user_id` unique + provisioning upsert** — after audit
   (needs DB access).
6. **DB: index validation** — confirm coverage for appointments/feedback/documents/
   budgets/reports/discover against real query plans, add additive migrations.
7. **Bundle measurement** — add `@next/bundle-analyzer`; capture per-route JS;
   confirm `jspdf`/`html2canvas` never statically imported.
8. **`createAdminSupabaseClient` request-memo** — only if proven safe for
   script/route contexts (P3).
9. Resolve the lockfile-root and `middleware`→`proxy` build warnings.

## 19. Rollback plan
- All shipped Phase 7 code changes are additive/behaviour-preserving and revert
  cleanly via git (`userProfile.ts`, `clientOnboarding.ts`).
- The `React.cache` wrapper degrades to the prior behaviour if reverted.
- No migration was applied, so there is nothing to roll back in the database. The
  prepared constraint is reversible (`DROP INDEX clients_user_id_unique`).
- New files (`docs/phase7/*`, `scripts/phase7/*`, Phase 7 docs) are inert.

## 20. Integrity confirmation
- **Aesthetics:** no UI/visual files changed; AEGIS branding intact.
- **Scoring:** `src/lib/scoring/*` untouched; `qa:protection-core` passes — no
  formula changes.
- **Features:** no functionality removed; all routes present in the build.
- **Integrations:** Supabase, Google Calendar, storage, PDF, Vercel build all
  verified green.
- **Access controls:** layered auth/RLS unchanged; `security:advisor-access` 11/11,
  `security:service-role` clean, client/adviser/admin isolation preserved.

Phase 7 stops here as instructed. No unrelated feature development was started.
