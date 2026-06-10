# Supabase Security Review — Phase 3O / 4X

**Date:** 2026-06-10  
**Scope:** Client portal Supabase integration (Phases 3B–3N) + full-stack audit (Phase 4X)  
**Status:** Review complete — see Phase 4X audit pack before private beta

**Phase 4X audit pack:**

- [Security Audit Report](./SECURITY_AUDIT_REPORT.md)
- [RLS Policy Review](./RLS_POLICY_REVIEW.md)
- [Storage Policy Review](./STORAGE_POLICY_REVIEW.md)
- [Service Role Usage Review](./SERVICE_ROLE_USAGE_REVIEW.md)
- [API Security Review](./API_SECURITY_REVIEW.md)
- [Advisor & Admin Access Review](./ADVISOR_ADMIN_ACCESS_REVIEW.md)
- Automation: `npm run security:audit`

---

## 1. Current Architecture

```
Browser (anon key + cookie session)
    │
    ├─► middleware.ts ──► session refresh, page-route auth gate
    │
    ├─► Client Components ──► lib/supabase/client.ts (anon, RLS)
    │
    └─► API Route Handlers ──► ensureUserClientProfile()
            │                      (server anon client → auth.uid)
            │                      (admin client → provision user/client)
            └─► Persistence layer ──► createAdminSupabaseClient()
                    (service role, bypasses RLS for trusted writes)
                    └─► writeAuditLog() (best-effort, never throws)
```

**Identity model (MVP):** One `auth.users` row maps to one `public.users` row and one `public.clients` row (`clients.user_id = auth.uid()`). All privileged operations resolve `client_id` server-side via `ensureUserClientProfile()` — never from the browser.

**Data flow:** Discover form data is the source of truth. Saves trigger scoring, snapshot persistence (shield, pillars, stress, roadmap), and derived `client_profiles`. Module pages read recomputed snapshots from Supabase via API routes.

**RLS:** Enabled on all public tables (migration `202606100009_rls_policies.sql`). Application writes use the service-role client server-side; RLS protects direct anon/authenticated client access.

---

## 2. Protected Routes (Middleware)

`middleware.ts` redirects unauthenticated users to `/login?next=…` for:

| Prefix | Module |
|--------|--------|
| `/dashboard` | Dashboard |
| `/profile` | Profile |
| `/discover` | Discover™ |
| `/shield-diagnostic` | Shield Diagnostic |
| `/stress-testing` | Stress Testing |
| `/roadmap` | Roadmap |
| `/wealth-blueprint` | Wealth Blueprint |
| `/annual-review` | Annual Review |
| `/document-vault` | Document Vault |
| `/advisor` | Advisor OS |
| `/admin` | Admin console |

**Public pages (no auth required):**

- `/` — landing
- `/login`, `/signup` — auth pages (logged-in users redirect to `/dashboard`)
- `/auth/callback` — OAuth/magic-link callback
- `/legal/*` — terms, privacy, disclaimer, consent
- `/supabase-health` — connectivity UI
- `/api/health/app` — app runtime probe
- `/api/health/supabase` — DB health probe

**API routes** are not middleware-gated; each handler calls `ensureUserClientProfile()` and returns `401` when unauthenticated. This is intentional — API auth is handler-level, not page-level.

---

## 3. API Route Security Model

### Authentication pattern

Every data API route (except `/api/health/supabase`) follows:

1. `ensureUserClientProfile()` — verifies cookie session, provisions `users` + `clients` if missing
2. Returns `401` when `authenticated: false`
3. Uses `session.client.id` for all queries (never browser-supplied `client_id`)

### Client identity rejection

All write routes and `/api/documents/signed-url` reject `client_id` / `clientId` in request bodies or form data via `rejectClientIdInBody()` / `rejectClientIdInFormData()`.

### Error sanitization

`toPublicErrorMessage()` in `lib/security/apiGuards.ts` maps internal/DB errors to safe fallbacks. Known user-facing messages (validation, not-found) are preserved. All 21 API routes now use this helper in catch blocks.

### Route inventory

| Route | Method | Auth | Writes | Audit log | Ownership |
|-------|--------|------|--------|-----------|-----------|
| `/api/discover/save` | POST | ✓ | ✓ | `discover_profile_saved` | session client |
| `/api/discover/current` | GET | ✓ | — | — | session client |
| `/api/dashboard/current` | GET | ✓ | — | — | session client |
| `/api/shield-diagnostic/current` | GET | ✓ | — | — | session client |
| `/api/roadmap/current` | GET | ✓ | — | — | session client |
| `/api/roadmap/status` | POST | ✓ | ✓ | `roadmap_status_updated` | `client_id` + `item_key` |
| `/api/stress-testing/current` | GET | ✓ | — | — | session client |
| `/api/stress-testing/run` | POST | ✓ | ✓ | `stress_test_run` | session client + enum validation |
| `/api/stress-testing/history` | GET | ✓ | — | — | session client |
| `/api/wealth-blueprint/current` | GET | ✓ | — | — | session client |
| `/api/wealth-blueprint/save` | POST | ✓ | ✓ | `wealth_blueprint_saved` | cloud snapshot only |
| `/api/wealth-blueprint/history` | GET | ✓ | — | — | session client |
| `/api/annual-review/current` | GET | ✓ | — | — | session client |
| `/api/annual-review/save` | POST | ✓ | ✓ | `annual_review_saved` | cloud snapshot only |
| `/api/annual-review/history` | GET | ✓ | — | — | session client |
| `/api/documents/list` | GET | ✓ | — | — | session client |
| `/api/documents/upload` | POST | ✓ | ✓ | `document_uploaded` | session client |
| `/api/documents/delete` | POST | ✓ | ✓ | `document_deleted` | `fetchOwnedDocument()` |
| `/api/documents/signed-url` | POST | ✓ | — | — | `fetchOwnedDocument()` |
| `/api/me` | GET | optional | — | — | returns auth state only |
| `/api/health/supabase` | GET | public | — | — | service-role probe |

---

## 4. Service Role Usage

| Module | `import "server-only"` | Uses service role |
|--------|------------------------|-------------------|
| `lib/supabase/admin.ts` | ✓ | defines client |
| `lib/supabase/env.ts` | — | `getSupabaseServiceRoleKey()` (only imported server-side) |
| `lib/supabase/auditLog.ts` | ✓ | audit inserts |
| `lib/supabase/userProfile.ts` | ✓ | user/client provisioning |
| `lib/supabase/discoverPersistence.ts` | ✓ | discover save chain |
| `lib/supabase/dashboardQueries.ts` | ✓ | dashboard reads |
| `lib/supabase/moduleQueries.ts` | ✓ | module reads |
| `lib/supabase/roadmapPersistence.ts` | ✓ | roadmap status |
| `lib/supabase/stressPersistence.ts` | ✓ | stress runs |
| `lib/supabase/reportPersistence.ts` | ✓ | report snapshots |
| `lib/supabase/documentPersistence.ts` | ✓ | vault CRUD + signed URLs |
| `app/api/health/supabase/route.ts` | — (route handler) | health probe |

**Verified:** No `createAdminSupabaseClient` import in any Client Component or `components/aegis/auth/**`. Browser client (`lib/supabase/client.ts`) uses anon key only.

---

## 5. Audit Logging Coverage

`writeAuditLog()` appends to `audit_logs` via service role. Failures are logged to `console.error` and **never throw** — main requests always complete.

| Action | Trigger |
|--------|---------|
| `discover_profile_saved` | Discover save |
| `roadmap_status_updated` | Roadmap status change |
| `stress_test_run` | Interactive stress test |
| `wealth_blueprint_saved` | Blueprint snapshot |
| `annual_review_saved` | Annual review snapshot |
| `document_uploaded` | Vault upload |
| `document_deleted` | Vault delete |

Each entry records: `client_id`, `user_id`, `action`, `entity_type`, `entity_id`, `metadata`, `ip_address`, `user_agent`.

**Not audited (read-only):** All GET routes, signed-url generation, `/api/me`.

---

## 6. Document Vault Validation

| Check | Implementation |
|-------|----------------|
| Auth | `ensureUserClientProfile()` → 401 |
| File size | Max 10 MB (`MAX_DOCUMENT_SIZE_BYTES`) |
| File type | Extension allowlist + MIME cross-check |
| Category | Enum validation (`DOCUMENT_CATEGORIES`) |
| Ownership (delete/signed-url) | `fetchOwnedDocument(client.id, documentId)` |
| Client identity | `rejectClientIdInFormData` on upload |

Signed URLs expire in 120 seconds (`SIGNED_URL_EXPIRY_SECONDS`).

---

## 7. Report Save Integrity

`persistWealthBlueprintSnapshot()` and `persistAnnualReviewSnapshot()` load data exclusively from `loadWealthBlueprintSnapshot()` / `loadAnnualReviewSnapshot()` — no browser-supplied report payloads. Request bodies are optional/empty; `client_id` rejection still applies.

---

## 8. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Service-role bypasses RLS | Medium (accepted) | All writes trust server code. A compromised server env leaks full DB access. Mitigate with secret rotation, least-privilege deploy, and eventual migration to RLS-respecting writes where feasible. |
| Public health endpoint | Low | `/api/health/supabase` uses service role and is unauthenticated. Exposes connectivity status only; consider IP allowlist or auth in production. |
| `/api/me` returns `clientId` | Low | Intentional for client UI; scoped to authenticated user's own record. |
| No rate limiting | Medium | API routes have no throttling. Add edge/CDN or middleware rate limits before production traffic. |
| Admin client for all reads | Low | Read paths also use service role, so RLS is not a second line of defence for API reads. Acceptable for MVP; Advisor OS multi-tenancy will need stricter scoping. |
| `advisor_notes` table unused | Low | Schema exists; no API yet. No exposure risk until Advisor Dashboard ships. |
| Audit log silent failure | Low | By design — availability over audit completeness. Monitor `[auditLog]` errors in production logs. |
| Stress test `extreme` severity | Low | Interactive UI limits to mild/moderate/severe; API enforces `INTERACTIVE_STRESS_SEVERITIES`. |

---

## 9. Recommended Production Hardening

1. **Remove or protect** `/supabase-health` and `/api/health/supabase` in production (env flag or Vercel IP restriction).
2. **Add rate limiting** on write endpoints (`discover/save`, `documents/upload`, `stress-testing/run`).
3. **Rotate** `SUPABASE_SERVICE_ROLE_KEY` on a schedule; never expose in client bundles (verify with `next build` source analysis).
4. **Enable Supabase Auth** email confirmation and MFA before public launch.
5. **Add monitoring** for audit log insert failures and 5xx rates per route.
6. **Advisor OS:** Replace single-client assumption with `advisor_user_id` scoping, advisor role checks, and RLS-respecting reads where possible.
7. **CSP headers** and upload virus scanning for document vault at scale.
8. **Backup/restore drill** for `client-documents` storage bucket and Postgres.

---

## 10. Advisor Command Center (Phase 4O)

`GET /api/advisor/command-center` consolidates advisor dashboard reads into one handler-gated response.

| Control | Implementation |
|---------|----------------|
| Authentication | `requireAdvisorAccess()` — same advisor/admin gate as individual advisor routes |
| Scope | All client IDs resolved server-side from advisor assignment; no browser-supplied `client_id` |
| Errors | `toPublicErrorMessage()` on fatal failures; per-section errors returned without blocking other sections |
| Service role | Used only inside existing Supabase query modules (`advisorQueries`, `advisorTasks`, etc.) — never exposed to the client |
| Timing | Server logs section timings (`payload.timing`) for future profiling |

Individual advisor routes (`/api/advisor/overview`, `/notifications`, `/tasks`, `/review-pipeline`, `/file-quality`, `/task-suggestions`) remain available for backward compatibility and targeted refreshes after mutations.

---

## 11. Advisor Client Command Center (Phase 4P)

`GET /api/advisor/clients/[clientId]/command-center` consolidates advisor client workspace reads into one handler-gated response.

| Control | Implementation |
|---------|----------------|
| Authentication | `requireAdvisorAccess()` — same advisor/admin gate as individual client routes |
| Scope | `clientId` from URL path; access checked server-side via existing query modules (`loadAdvisorClientWorkspace`, `resolveAccessibleClient`) |
| Advisor scope | Advisors may only load assigned clients; admins may load any client |
| Errors | `toPublicErrorMessage()` on fatal failures; per-section errors (`fileQualityError`, `suggestionsError`, etc.) without blocking workspace core |
| Service role | Used only inside existing Supabase query modules — never exposed to the client |
| Timing | Server logs section timings (`payload.timing`) for profiling |

Individual client routes (`/api/advisor/clients/[clientId]`, `/review-status`, `/tasks`, `/file-quality`, `/task-suggestions`, `/notes`, document/report actions) remain available for backward compatibility and targeted refreshes after mutations.

---

## 12. Review Conclusion

Phase 3 Supabase integration meets MVP security requirements:

- No browser-supplied `client_id` on privileged operations
- All write routes require authentication
- Service role is server-only
- Errors are sanitized across all API routes
- Audit logging covers all major writes without breaking requests
- Document, roadmap, stress, and report flows verify ownership or server-derived identity

**Phase 3 is complete.** Proceed to Advisor Dashboard (Phase 4).

---

## 13. Phase 4Q — Production Security Hardening & Rate Limits

**Date:** 2026-06-10  
**Scope:** Central request guards, in-memory rate limiting, sensitive-field rejection, health endpoint hardening

### Rate limiting approach

| Module | Purpose |
|--------|---------|
| `lib/security/rateLimit.ts` | In-memory sliding-window limiter (`checkRateLimit`, presets) |
| `lib/security/requestValidation.ts` | `rejectUnexpectedFields`, `rejectUnexpectedFormFields` |
| `lib/security/apiGuards.ts` | `getRequestActorKey`, `rateLimitOrThrow`, `createRateLimitedResponse`, `assertAllowedMethods`, `parseJsonBodySafe` |

**Actor key:** Authenticated requests key by `user:{userId}`; unauthenticated requests fall back to `ip:{x-forwarded-for|x-real-ip}`.

**Presets:**

| Bucket | Window | Max | Applied to |
|--------|--------|-----|------------|
| `writeHeavy` | 60s | 30 | All privileged write routes (client saves, uploads, advisor/admin mutations) |
| `commandCenter` | 60s | 120 | `GET /api/advisor/command-center`, `GET /api/advisor/clients/[clientId]/command-center` |
| `health` | 60s | 20 | `GET /api/health/supabase` (per IP) |

**429 response:** `{ ok: false, error: "Too many requests...", retryAfterMs }` with `Retry-After` header.

> **WARNING:** The in-memory store is **per Node.js process** and is **not shared** across serverless instances, containers, or horizontal scale-out. Replace with Redis, Upstash, or edge/CDN rate limiting before multi-instance production.

### Sensitive field rejection

`rejectUnexpectedFields()` blocks browser-supplied identity/escalation keys on privileged writes:

`user_id`, `userId`, `advisor_id`, `advisorId`, `client_id`, `clientId`, `role` (except admin role update), `service_role`, `serviceRole`.

Routes with `clientId` in the URL path reject body `client_id` / `clientId`. Task create / suggestion routes allow optional `client_id` in body (scoped server-side).

### Health endpoint (production mode)

When `NODE_ENV=production` or `VERCEL_ENV=production`, `/api/health/supabase` returns only `{ ok, timestamp }` — no `databaseReachable`, `tablesAccessible`, or internal error strings. Dev/non-production responses retain diagnostic fields (sanitized).

### Endpoints hardened (Phase 4Q)

**Client writes:** discover save, document upload/delete, stress test run, roadmap status, blueprint save, annual review save.

**Advisor writes:** notes create/update/delete, tasks create/update, suggested task create, client document upload/delete, client invitation create.

**Advisor reads (light limit):** command-center routes.

**Admin writes:** user role update, client advisor assignment, client invitation create.

**Public:** health probe (IP rate limit + reduced production payload).

### Audit log review (Phase 4Q)

Existing write routes already emit audit events. No new audit actions were required — advisor notes/tasks/documents, admin role/assignment/invitations, and client portal writes were confirmed covered. Invitation failures continue to log `client_invitation_failed`.

### Remaining production risks (post-4Q)

| Risk | Severity | Notes |
|------|----------|-------|
| In-memory rate limits | Medium | Bypassable under multi-instance / serverless cold starts; upgrade before launch traffic |
| Service-role bypasses RLS | Medium (accepted) | Unchanged — server env compromise = full DB access |
| Public health endpoint | Low | Production mode minimizes leakage; still unauthenticated — consider auth or IP allowlist |
| No WAF / bot protection | Medium | Add CDN or edge rules for abuse patterns |
| Audit log silent failure | Low | Monitor `[auditLog]` console errors |
| CSP / virus scan on uploads | Low | Deferred to scale phase |

---

## 14. Phase 4R — Production Readiness QA

**Date:** 2026-06-10  
**Scope:** QA documentation, route inventory, and automation scripts (no app behavior changes)

| Deliverable | Location |
|-------------|----------|
| Production readiness checklist | `docs/PRODUCTION_READINESS_CHECKLIST.md` |
| Manual smoke test plan | `docs/QA_SMOKE_TEST_PLAN.md` |
| Role access matrix | `docs/ROLE_ACCESS_MATRIX.md` |
| API route inventory | `docs/API_ROUTE_INVENTORY.md` |
| Security test plan | `docs/SECURITY_TEST_PLAN.md` |
| Env verification | `npm run qa:env` |
| Route scanner | `npm run qa:routes` |
| API smoke tests | `npm run qa:smoke` (requires running server) |

---

## 15. Phase 4O.2 — Heavy Advisor Load Performance

**Date:** 2026-06-10  
**Scope:** Server-side batching for `/api/advisor/command-center/heavy` (no schema or scoring changes)

### Root cause (pre-4O.2)

- Task suggestions called `loadClientFileQuality()` and `loadClientReviewStatus()` **per client** (N+1 queries).
- Each per-client file-quality load re-ran ~10 Supabase queries instead of one batched pass.
- Heavy command-center sections loaded **in parallel but independently**, duplicating clients, review pipeline, tasks, and file-quality work.
- Dashboard suggestions could emit up to **six document-gap suggestions per client**, inflating compute time.

### Optimizations

| Area | Change |
|------|--------|
| Command center heavy | Single client list → batch quality + review contexts → derive file quality, pipeline, notifications, suggestions from shared data |
| Task suggestions | Batch `loadAdvisorClientQualityContexts` / `loadAdvisorClientReviewContexts`; no per-client quality/review loaders on dashboard path |
| Document gaps | Dashboard caps **2 document suggestions per client**; empty vault gets **1** suggestion |
| Book-wide cap | Top **20** suggestions by priority for `/advisor` heavy payload |
| Time budget | **3s** suggestion compute budget; returns partial results + `warning` instead of blocking |
| Notifications | Accepts preloaded `taskDashboard` + `reviewPipeline` + `clients` (no duplicate pipeline/task loads) |

### Timing logs

`GET /api/advisor/command-center/heavy` logs:

`totalMs`, `totalHeavyMs`, `tasksMs`, `fileQualityMs`, `reviewPipelineMs`, `notificationsMs`, `taskSuggestionsMs`

### Remaining limitations

| Limit | Notes |
|-------|-------|
| Large books (>50 clients) | Batch queries grow with client count; consider pagination or background jobs |
| Client workspace suggestions | `GET /api/advisor/clients/[clientId]/task-suggestions` still computes full client detail (intentional) |
| Standalone `GET /api/advisor/task-suggestions` | Returns dashboard-capped top 20 (backward compatible, lighter than pre-4O.2 full book) |
| Partial suggestions | `partial: true` + `warning` when time budget or cap applies — UI may show fewer than total actionable items |
| Cold Supabase latency | First request after idle may still exceed 3–5s on slow networks |

---

## 16. Phase 4X — Security Audit & RLS Review

**Date:** 2026-06-10  
**Scope:** Full API route review, RLS/storage/service-role/middleware audit, automated scans

### Deliverables

| Item | Location |
|------|----------|
| Master audit report | `docs/SECURITY_AUDIT_REPORT.md` |
| RLS table review | `docs/RLS_POLICY_REVIEW.md` |
| Storage policy review | `docs/STORAGE_POLICY_REVIEW.md` |
| Service role inventory | `docs/SERVICE_ROLE_USAGE_REVIEW.md` |
| API security matrix | `docs/API_SECURITY_REVIEW.md` |
| Advisor/admin boundaries | `docs/ADVISOR_ADMIN_ACCESS_REVIEW.md` |
| Service-role import scan | `npm run security:service-role` |
| API auth pattern scan | `npm run security:api` |
| Combined runner | `npm run security:audit` |

### Code fixes (4X)

- `writeHeavy` rate limit on advisor/admin `create-placeholder` and advisor `review-status` PATCH
- `rejectUnexpectedFields` on advisor `review-status` PATCH

### Top findings (not fixed in 4X — migration deferred)

1. **Critical:** `users_update_own` RLS may allow `role` self-escalation via direct Supabase client
2. **Medium:** In-memory rate limits not multi-instance safe
3. **Medium:** `clients` UPDATE policy does not restrict sensitive columns at RLS layer

See [Security Audit Report](./SECURITY_AUDIT_REPORT.md) for full severity table and manual test checklist.

