# Supabase Security Review — Phase 3O

**Date:** 2026-06-10  
**Scope:** Client portal Supabase integration (Phases 3B–3N)  
**Status:** Review complete — ready for Advisor Dashboard (Phase 4)

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
| `/advisor` | Advisor (placeholder) |

**Public pages (no auth required):**

- `/` — landing
- `/login`, `/signup` — auth pages (logged-in users redirect to `/dashboard`)
- `/auth/callback` — OAuth/magic-link callback
- `/supabase-health` — connectivity UI
- `/api/health/supabase` — health probe

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

## 11. Review Conclusion

Phase 3 Supabase integration meets MVP security requirements:

- No browser-supplied `client_id` on privileged operations
- All write routes require authentication
- Service role is server-only
- Errors are sanitized across all API routes
- Audit logging covers all major writes without breaking requests
- Document, roadmap, stress, and report flows verify ownership or server-derived identity

**Phase 3 is complete.** Proceed to Advisor Dashboard (Phase 4).
