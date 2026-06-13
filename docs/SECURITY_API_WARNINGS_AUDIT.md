# Security API Warnings Audit — Phase 6F Follow-up

**Date:** 13 June 2026  
**Command:** `npm run security:api`  
**Original warnings:** 12 WARN + 1 REVIEW + 1 INFO

This document records per-route verification, classifications, fixes applied, and scanner updates.

---

## Summary

| Classification | Count |
|----------------|-------|
| Confirmed false positive (scanner coverage gap) | 7 |
| Real issue fixed (rate limiting) | 3 |
| Real issue fixed (debug routes ungated in production) | 3 |
| Real authentication issue (unfixed / remaining) | 0 |
| Real authorization issue | 0 |
| Requires manual test | 0 |

**Scanner changes:** Audited guard allowlist added; body-less POST review rule tightened; self-tests added.  
**Route changes:** Production gate on debug routes; `rateLimitOrThrow` on three write handlers.  
**No warnings globally suppressed. No RLS or role gates weakened.**

---

## Full audit table (12 WARN rows)

| Route / File | HTTP Method | Guard Used | Authentication Source | Authorization Rule | User-Supplied Identifiers | RLS / DB Enforcement | Why Scanner Flagged It | Classification | Required Action |
| ------------ | ----------- | ---------- | --------------------- | ------------------ | ------------------------- | -------------------- | ---------------------- | -------------- | --------------- |
| `/api/adviser-contact` · `app/api/adviser-contact/route.ts` | GET | `loadAssignedAdviserContact()` → `ensureUserClientProfile()` | Supabase server client `auth.getUser()` from HTTP-only cookies; not browser-trusted | Client sees only `clients.advisor_user_id` from their own client row; adviser `users` fields loaded by that ID | None | Admin client loads `users` where `id = session.client.advisor_user_id`; client row from `clients.user_id = auth.uid()` | Scanner only matched `ensureUserClientProfile` in route file, not nested loader name | **CONFIRMED FALSE POSITIVE** → **SCANNER COVERAGE GAP** | Add `loadAssignedAdviserContact` to audited allowlist ✅ |
| `/api/adviser-feedback` · `app/api/adviser-feedback/route.ts` | POST | `submitAdviserFeedback()` → `ensureUserClientProfile()`; `rateLimitOrThrow`; `rejectForbiddenFeedbackFields`; `rejectUnexpectedFields(rejectClientId)` | Same Supabase session | Feedback inserted with `client_user_id = auth.uid()`, `client_id = session.client.id`, `adviser_user_id = session.client.advisor_user_id`; rejects if not eligible / already submitted | Ratings and text fields only; no client/adviser IDs accepted (`rejectClientId: true`) | `adviser_feedback` RLS; server derives all IDs from session | Route calls `submitAdviserFeedback` not `ensureUserClientProfile` directly | **CONFIRMED FALSE POSITIVE** → **SCANNER COVERAGE GAP** | Add `submitAdviserFeedback` to allowlist ✅ |
| `/api/adviser-feedback/prompt` · `app/api/adviser-feedback/prompt/route.ts` | GET, POST | GET: `loadFeedbackPromptState()`; POST: `dismissFeedbackPrompt()` → `ensureUserClientProfile()` | Supabase session | GET: prompt for authenticated client only; POST: updates `feedback_prompt_dismissed_at` on `session.client.id` only | POST has **no body** | `clients` update `.eq("id", session.client.id)` | GET: nested loader not recognised; POST: missing `rateLimitOrThrow` | GET: **FALSE POSITIVE**; POST: **REAL ISSUE (rate limit)** — not auth | Add loaders to allowlist ✅; add `rateLimitOrThrow` on POST ✅ |
| `/api/my-adviser` · `app/api/my-adviser/route.ts` | GET | `loadMyAdviserPageData()` → `ensureUserClientProfile()` | Supabase session | Returns assigned adviser profile + approved testimonials for `session.client.advisor_user_id` only; empty state if unassigned | None | Testimonials query filters `adviser_user_id` + `approved_testimonial`; no client-supplied adviser ID | Nested loader not in scanner list | **CONFIRMED FALSE POSITIVE** → **SCANNER COVERAGE GAP** | Add `loadMyAdviserPageData` to allowlist ✅ |
| `/api/my-adviser/appointments` · `app/api/my-adviser/appointments/route.ts` | GET | `listClientUpcomingAppointments()` → `ensureUserClientProfile()` | Supabase session | Appointments filtered `.eq("client_user_id", session.authUser.id)` | None | `adviser_appointments` queried by authenticated client user ID | Nested loader not recognised | **CONFIRMED FALSE POSITIVE** → **SCANNER COVERAGE GAP** | Add `listClientUpcomingAppointments` to allowlist ✅ |
| `/api/my-adviser/availability` · `app/api/my-adviser/availability/route.ts` | GET | `listAvailabilityForAssignedAdviser()` → `getClientAssignedAdviserId()` → `ensureUserClientProfile()` | Supabase session | Availability only for `session.client.advisor_user_id`; returns 404 if unassigned | Query: `date` (validated `YYYY-MM-DD`), `appointmentType` (label only) — adviser ID **not** accepted | Busy slots + settings scoped to assigned adviser from DB | Nested loader not recognised | **CONFIRMED FALSE POSITIVE** → **SCANNER COVERAGE GAP** | Add `listAvailabilityForAssignedAdviser` to allowlist ✅ |
| `/api/google-calendar/callback` · `app/api/google-calendar/callback/route.ts` | GET | `verifyOAuthState(state)` (HMAC + expiry); `exchangeGoogleAuthCode` | OAuth redirect — no user session; **trusted** signed state from connect flow | Tokens saved to `adviser_user_id` embedded in signed state created at `/api/advisor/calendar/connect` (adviser-gated) | Query: `code`, `state`, `error` — `state` cryptographically verified | `adviser_calendar_connections` keyed by `adviser_user_id` from verified state | Scanner expects session guards, not OAuth callback pattern | **CONFIRMED FALSE POSITIVE** → **SCANNER COVERAGE GAP** | Add `verifyOAuthState` as `oauth-callback` kind ✅ |
| `/api/documents/signed-url` · `app/api/documents/signed-url/route.ts` | POST | `ensureUserClientProfile()` directly | Supabase session | `createDocumentSignedUrl(session.client, documentId)` → `fetchOwnedDocument(client.id, documentId)` | Body: `document_id` only; `rejectClientIdInBody` | Document must belong to authenticated client's `client.id` | Auth OK; missing `rateLimitOrThrow` | **REAL ISSUE (rate limiting)** — not auth/authz | Add `rateLimitOrThrow` (`writeHeavy`) ✅ |
| `/api/advisor/clients/:clientId/documents/:documentId/signed-url` · `app/api/advisor/clients/[clientId]/documents/[documentId]/signed-url/route.ts` | POST | `requireAdvisorAccess()` + `createAdvisorDocumentSignedUrl()` → `resolveAccessibleClient()` | Supabase session + `users.role` | Adviser: `clients.advisor_user_id = auth.uid()`; admin: all clients; document must exist for that client | Route params: `clientId`, `documentId` — cross-checked via `resolveAccessibleClient` | `resolveAccessibleClient` enforces assignment before storage signed URL | Auth OK; missing `rateLimitOrThrow` | **REAL ISSUE (rate limiting)** — not auth/authz | Add `rateLimitOrThrow` with `userId` ✅ |
| `/api/debug/auth-cookies` · `app/api/debug/auth-cookies/route.ts` | GET | **Was:** none · **Now:** `blockDebugRouteInProduction()` | **Was:** fully public · **Now:** 404 in production | Dev-only cookie diagnostics; no PII values exposed (names/flags only) | None | N/A — not a data API | No guard pattern matched | **REAL AUTHENTICATION ISSUE** (ungated diagnostic in prod) | Gate with `blockDebugRouteInProduction` ✅ |
| `/api/debug/set-basic-cookie` · `app/api/debug/set-basic-cookie/route.ts` | GET | **Was:** none · **Now:** `blockDebugRouteInProduction()` | **Was:** public · **Now:** 404 in production | Dev-only cookie probe | None | N/A | No guard matched | **REAL AUTHENTICATION ISSUE** | Production gate ✅ |
| `/api/debug/set-basic-cookie-redirect` · `app/api/debug/set-basic-cookie-redirect/route.ts` | GET | **Was:** none · **Now:** `blockDebugRouteInProduction()` | **Was:** public · **Now:** 404 in production | Dev-only redirect cookie probe | None | N/A | No guard matched | **REAL AUTHENTICATION ISSUE** | Production gate ✅ |

---

## Additional scanner findings (non-WARN)

| Route | Finding | Classification | Action |
|-------|---------|----------------|--------|
| `/api/adviser-feedback/prompt` POST | REVIEW: client write without `rejectClientId` | **CONFIRMED FALSE POSITIVE** | POST has no JSON body; scanner updated to only REVIEW when `parseJsonBodySafely` present ✅ |
| `/api/adviser-feedback/prompt` POST | INFO: no `writeAuditLog` | Acceptable | Dismiss is low-risk UI state; no audit required |

---

## Manual access matrix

No routes classified as `REQUIRES MANUAL TEST` after code review. Recommended spot-checks:

### `/api/my-adviser` GET

| Actor | Expected HTTP | Data | Session |
|-------|---------------|------|---------|
| Unauthenticated | 401 | None | Active (no sign-out) |
| Client (assigned) | 200 | Own adviser's public profile + testimonials | Active |
| Client (unassigned) | 200 | `assigned: false` empty state | Active |
| Unassigned adviser | 401 | None (not a client session path) | Active |
| Assigned adviser | 401 | None | Active |
| Admin (as client user) | 200/401 per client row linkage | Per client profile | Active |

### `/api/my-adviser/availability` GET

| Actor | Expected HTTP | Data | Session |
|-------|---------------|------|---------|
| Unauthenticated | 401 | None | Active |
| Client (assigned, booking on) | 200 | Slots for assigned adviser only | Active |
| Client (unassigned) | 404 `unassigned` | None | Active |
| Other adviser's client | 200 | Own adviser's slots only — cannot pass another adviser ID | Active |

### `/api/debug/*` (after fix)

| Actor | Production | Development |
|-------|------------|-------------|
| Anyone | 404 | 200 (diagnostic only) |

---

## Files changed (follow-up)

| File | Change |
|------|--------|
| `lib/security/debugRouteGuard.ts` | New production gate helper |
| `app/api/debug/auth-cookies/route.ts` | Production gate |
| `app/api/debug/set-basic-cookie/route.ts` | Production gate |
| `app/api/debug/set-basic-cookie-redirect/route.ts` | Production gate |
| `app/api/documents/signed-url/route.ts` | Rate limit |
| `app/api/advisor/clients/[clientId]/documents/[documentId]/signed-url/route.ts` | Rate limit |
| `app/api/adviser-feedback/prompt/route.ts` | Rate limit on POST |
| `scripts/check-api-auth-patterns.ts` | Audited allowlist, self-tests, review rule fix |
| `scripts/run-phase6f-audit.ts` | `security:api` required pass |
| `docs/SECURITY_API_WARNINGS_AUDIT.md` | This report |

---

## Confirmations

- ✅ No warning globally suppressed — each route verified individually
- ✅ No authorization or RLS control weakened
- ✅ No service-role credentials exposed to browser
- ✅ Scanner still flags deliberately unguarded patterns (self-tests)
- ✅ Debug routes remain available in development only
