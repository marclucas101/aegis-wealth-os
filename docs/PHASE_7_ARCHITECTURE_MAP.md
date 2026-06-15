# Phase 7 — Architecture Map, Target Architecture & Risk Register

> Wave 1 deliverable. Produced before any high-risk change, as required by the
> Phase 7 brief ("Document the target architecture before making high-risk
> changes"). Pairs with `PHASE_7_RECONSTRUCTION_BASELINE.md`.

---

## A. Current architecture map

### A.1 Authentication & session
- `proxy`/`middleware.ts` → `updateSession()` refreshes the Supabase cookie
  session on protected prefixes; redirects unauthenticated users to `/login`
  with `next=`. Never signs users out on access denial.
- `lib/supabase/server.ts` builds the cookie-bound anon client for RSC.
- `requireAuthenticatedUser()` (`authGuards.ts`) — request-cached
  (`React.cache`) resolution of `auth.getUser()` + authoritative `users` row.
- Role helpers: `getCurrentUserRole()`, `isAdvisorRole`, `isAdminRole`
  (`roles.ts`: advisor ⊇ {advisor, admin}; admin = admin).

### A.2 Provisioning & assignment
- `ensureUserClientProfile()` (`userProfile.ts`): resolves session, ensures a
  `users` row (insert with 23505 fallback), then a `clients` row — links a
  placeholder client by email if present, else inserts a new `clients` row.
- `clientOnboarding.ts`: `findLinkablePlaceholderClient`,
  `linkPlaceholderClientToUser`, `normalizeEmail`.
- Adviser assignment lives on `clients.advisor_user_id`; admin can reassign via
  `/api/admin/clients/[clientId]/advisor`.

### A.3 Authorization layers (defense in depth)
1. Navigation filtering — `lib/navigation.ts` `getNavSectionsForRole`.
2. Server layout/page guards — `app/advisor/layout.tsx`
   (`requireAdvisorAccess`), `app/admin/layout.tsx` (`requireAdminAccess`).
3. API route guards — every `/api/advisor/**` uses `requireAdvisorAccess`;
   `/api/admin/**` uses `requireAdminAccess` (verified by `security:advisor-access`).
4. Authoritative assignment checks — `advisorClientAccess.ts` for
   client-scoped adviser APIs; booking derives adviser from
   `clients.advisor_user_id` (never browser input).
5. Supabase RLS — migrations `..009_rls_policies.sql`, `..010_storage_policies`,
   `..014_fix_users_role_self_escalation.sql`.
6. DB constraints — overlap exclusion on `adviser_appointments`, token table
   blocked from authenticated RLS.

### A.4 Persistence modules (`lib/supabase/*`)
Auth/profile: `userProfile`, `authGuards`, `advisorAuth`, `adminManagement`,
`adminManagement`. Domain: `dashboardQueries`, `budgetPersistence`,
`documentPersistence`, `advisorDocumentPersistence`, `promotionsPersistence`,
`adviserFeedbackPersistence`, `adviserProfilePersistence`, `calendarPersistence`,
`appointmentsPersistence`, `advisorClientQueries`, `advisorClientListQueries`,
`advisorClientCommandCenter`, `advisorClientAccess`, `adviserContactQueries`.
Scoring (pure): `src/lib/scoring/*` (protection core, benchmarks, types).
Calendar: `lib/google/{calendarClient,oauthState,env}` + availability in
`src/lib/calendar/*`.

### A.5 Page/UI composition
- Shared shell: `AuthenticatedAppShell` (server, resolves role + nav) → `AppShell`
  (client) → `SidebarNav`/`TopBar`.
- ~160 client components; flagship visual: `components/aegis/charts/*`
  (Circular Shield, hand-rolled SVG; `ShieldArchitectureModule` lazy-loaded on
  dashboard per Phase 6F).
- Report/PDF: `src/features/document-vault/generateProtectionReportPdf.ts`
  (dynamic-imports `jspdf`+`html2canvas`); print pages under `/*/print`.

---

## B. Problems & duplication identified

| # | Problem | Severity | Wave |
| --- | --- | --- | --- |
| P1 | No DB uniqueness on `clients.user_id`; provisioning can race on first login → **duplicate client rows** | High | 2 |
| P2 | `ensureUserClientProfile()` not request-cached → repeated `getUser`+users+clients lookups per request | High | 2/3 |
| P3 | `createAdminSupabaseClient()` constructs a new service-role client every call | Low | 3 |
| P4 | Service-role admin client used for routine user-facing reads → RLS is backstop; in-code authz must stay airtight | Med | 2/5 |
| P5 | Client components fetch own data post-hydration (calendar status, profile, several panels) → data waterfalls | Med | 3/4/5 |
| P6 | Broad `select("*")` in several loaders → oversized payloads/coupling | Med | 3 |
| P7 | Advisor OS vs My Clients likely overlap in roster loading | Med | 5 |
| P8 | Per-tab refetching in adviser client workspace | Med | 5 |
| P9 | Turbopack build hides per-route JS sizes → measurement gap | Low | 1/7 |
| P10 | Legacy redirects (`/advisor/setup`,`/advisor/calendar`) must remain | Info | done (Phase 6G) |

No financial scoring duplication or formula risk identified; scoring is isolated
in `src/lib/scoring/*` and must remain unchanged (brief constraint).

---

## C. Target architecture (principles to converge on)

1. **Single authoritative session/profile resolver.** Wrap
   `ensureUserClientProfile()` in `React.cache()` and route all client-scoped
   loaders/APIs through it (or a thin typed wrapper) so a request resolves
   session + profile **once**.
2. **Idempotent, race-safe provisioning.** One provisioning function; add a DB
   unique constraint on `clients.user_id` (**after** auditing/merging existing
   duplicates) so concurrent inserts collapse to one row via `onConflict`.
3. **Memoized service-role client** per request where safe; keep service role
   strictly server-only; keep explicit authorization on every service-role read.
4. **Server-first data loading.** Move post-hydration `/api` fetches into server
   loaders passed as typed props; keep client components as small interactive
   islands. Use `Promise.all` for independent queries.
5. **Explicit column selection** + small typed DTOs; paginate all lists.
6. **Feature-scoped loaders** shared between page and any API that needs the same
   data; no duplicate fetch of the same entity within a request.
7. **Lazy-load genuinely heavy modules only** (PDF already split; keep
   adviser-only and chart-heavy modules out of unrelated bundles).
8. **Never globally cache** private/client data, role checks, assignments,
   availability, OAuth tokens, signed URLs, booking state. Request-scoped only.
9. **Reconciled integration state**: booking/calendar never reports "confirmed"
   unless Google + DB state agree; compensating cleanup on partial failure.
10. **Preserve aesthetics, scoring, features, access controls, public URLs.**

---

## D. Risk register for high-risk waves

- **DB unique constraint on `clients.user_id` (P1)** must be additive and is
  blocked on a **production duplicate audit + merge plan**. Sequence:
  1. Read-only audit query (service role) counting `user_id` with >1 client row.
  2. For each duplicate set, choose the canonical row (earliest `created_at` with
     the most linked data) and produce a merge plan; **never auto-delete** rows
     owning documents/budgets/feedback/appointments/reports/Discover.
  3. Add `unique` constraint only once duplicates are resolved; provisioning
     switches to `upsert ... onConflict(user_id)`.
  This requires DB access not available from the workstation and should be run
  against staging/production by the maintainer or with explicit approval.
- **Auth provisioning caching (P2)** changes session-resolution timing; validate
  with `qa:my-adviser`, `qa:my-clients`, `final:check`, and manual login/refresh.
- **RLS parity (P4)**: any move from service-role reads toward anon+RLS must be
  proven not to break access before shipping.

---

## E. Wave execution plan (status)

- **Wave 1 — Baseline + map + target + risks**: ✅ this document + baseline doc.
- **Wave 2 — Auth/authz/provisioning**: request-cache provisioning; idempotent
  provisioning; duplicate-client audit query + migration *prepared* (constraint
  applied only after duplicate audit); RLS parity review. *Gate: needs DB audit
  before applying the uniqueness constraint to production.*
- **Wave 3 — Shared data layer**: cached resolver wiring, explicit selects,
  parallel queries, memoized admin client, remove duplicate loaders.
- **Wave 4 — Client experience**: dashboard, discover, my-adviser, booking,
  budgets, document vault — server-first loading, small islands.
- **Wave 5 — Adviser/admin**: Advisor OS as command overview, My Clients roster,
  client workspace lazy tabs with session cache, my-profile, appointments,
  reports, feedback, promotions, admin.
- **Wave 6 — Integration hardening**: calendar lifecycle edge cases, storage,
  signed URLs, PDFs, external failures.
- **Wave 7 — Bundle/dep/db/image/css**: size capture, additive indexes (after
  query-pattern confirmation), dependency prune, image/font/CSS.
- **Wave 8 — Full regression + measurement + final report**.

---

## F. Decision required before high-risk execution

Two Phase 7 requirements are **blocked on production database access** that this
environment does not have:
1. Auditing existing duplicate `clients` rows before adding the uniqueness
   constraint (brief §4: "Add a safe uniqueness constraint only after auditing
   existing duplicates").
2. Runtime query-count / waterfall measurement and index validation against real
   data (brief §12: "Inspect actual query patterns before adding indexes").

Recommendation: proceed now with all **code-level, non-destructive** waves
(2 caching/idempotency, 3 shared data layer, 4–6 server-first loading and
integration hardening, 7 dependency/bundle/CSS) which are safe and fully
testable here; **prepare** the duplicate-client migration + remediation script
as reviewable artifacts but **defer applying the DB uniqueness constraint and
new indexes** until the maintainer runs the audit against staging/production.
