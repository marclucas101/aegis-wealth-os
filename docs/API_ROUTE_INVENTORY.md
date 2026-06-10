# API Route Inventory — Phase 4R

**Date:** 2026-06-10  
**Total routes:** 51 handler files  
**Regenerate flags:** `npm run qa:routes`

**Related:** [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) · [Security Test Plan](./SECURITY_TEST_PLAN.md)

**Column key:** Auth = session required · Role = minimum role · R/W = read or write · RL = rate limited · Audit = writeAuditLog on success (or access audit for advisor document/report views)

---

## Public

| Route | Method | Auth | Role | R/W | RL | Audit |
|-------|--------|------|------|-----|----|-------|
| `/api/health/supabase` | GET | No | — | R | Yes (`health`) | — |

---

## Session / Profile

| Route | Method | Auth | Role | R/W | RL | Audit |
|-------|--------|------|------|-----|----|-------|
| `/api/me` | GET | Optional | any | R | No | — |

Returns `{ authenticated: false }` with 200 when logged out. Returns own client profile when logged in.

---

## Client Portal (`ensureUserClientProfile`)

| Route | Method | Auth | Role | R/W | RL | Audit |
|-------|--------|------|------|-----|----|-------|
| `/api/discover/current` | GET | Yes | client† | R | No | — |
| `/api/discover/save` | POST | Yes | client† | W | Yes (`writeHeavy`) | `discover_profile_saved` |
| `/api/dashboard/current` | GET | Yes | client† | R | No | — |
| `/api/shield-diagnostic/current` | GET | Yes | client† | R | No | — |
| `/api/roadmap/current` | GET | Yes | client† | R | No | — |
| `/api/roadmap/status` | POST | Yes | client† | W | Yes (`writeHeavy`) | `roadmap_status_updated` |
| `/api/stress-testing/current` | GET | Yes | client† | R | No | — |
| `/api/stress-testing/run` | POST | Yes | client† | W | Yes (`writeHeavy`) | `stress_test_run` |
| `/api/stress-testing/history` | GET | Yes | client† | R | No | — |
| `/api/wealth-blueprint/current` | GET | Yes | client† | R | No | — |
| `/api/wealth-blueprint/save` | POST | Yes | client† | W | Yes (`writeHeavy`) | `wealth_blueprint_saved` |
| `/api/wealth-blueprint/history` | GET | Yes | client† | R | No | — |
| `/api/annual-review/current` | GET | Yes | client† | R | No | — |
| `/api/annual-review/save` | POST | Yes | client† | W | Yes (`writeHeavy`) | `annual_review_saved` |
| `/api/annual-review/history` | GET | Yes | client† | R | No | — |
| `/api/documents/list` | GET | Yes | client† | R | No | — |
| `/api/documents/upload` | POST | Yes | client† | W | Yes (`writeHeavy`) | `document_uploaded` |
| `/api/documents/delete` | POST | Yes | client† | W | Yes (`writeHeavy`) | `document_deleted` |
| `/api/documents/signed-url` | POST | Yes | client† | W | No | — |

†Any authenticated user with a provisioned client record (including advisor/admin acting on their own client).

---

## Advisor (`requireAdvisorAccess`)

| Route | Method | Auth | Role | R/W | RL | Audit |
|-------|--------|------|------|-----|----|-------|
| `/api/advisor/overview` | GET | Yes | advisor, admin | R | No | — |
| `/api/advisor/command-center` | GET | Yes | advisor, admin | R | Yes (`commandCenter`) | — |
| `/api/advisor/notifications` | GET | Yes | advisor, admin | R | No | — |
| `/api/advisor/review-pipeline` | GET | Yes | advisor, admin | R | No | — |
| `/api/advisor/file-quality` | GET | Yes | advisor, admin | R | No | — |
| `/api/advisor/task-suggestions` | GET | Yes | advisor, admin | R | No | — |
| `/api/advisor/tasks` | GET | Yes | advisor, admin | R | No | — |
| `/api/advisor/tasks` | POST | Yes | advisor, admin | W | Yes (`writeHeavy`) | `advisor_task_created` |
| `/api/advisor/tasks/[taskId]` | PATCH | Yes | advisor, admin | W | Yes (`writeHeavy`) | `advisor_task_updated` / `advisor_task_completed` |
| `/api/advisor/task-suggestions/create-task` | POST | Yes | advisor, admin | W | Yes (`writeHeavy`) | `advisor_suggested_task_created` |
| `/api/advisor/client-invitations` | GET | Yes | advisor, admin | R | No | — |
| `/api/advisor/client-invitations` | POST | Yes | advisor, admin | W | Yes (`writeHeavy`) | `client_invitation_created` / `client_invitation_failed` |
| `/api/advisor/clients/create-placeholder` | POST | Yes | advisor, admin | W | No‡ | `client_placeholder_created` |
| `/api/advisor/clients/[clientId]` | GET | Yes | advisor‡, admin | R | No | — |
| `/api/advisor/clients/[clientId]/command-center` | GET | Yes | advisor‡, admin | R | Yes (`commandCenter`) | — |
| `/api/advisor/clients/[clientId]/notes` | GET | Yes | advisor‡, admin | R | No | — |
| `/api/advisor/clients/[clientId]/notes` | POST | Yes | advisor‡, admin | W | Yes (`writeHeavy`) | `advisor_note_created` |
| `/api/advisor/clients/[clientId]/notes/[noteId]` | PATCH | Yes | advisor‡, admin | W | Yes (`writeHeavy`) | `advisor_note_updated` |
| `/api/advisor/clients/[clientId]/notes/[noteId]` | DELETE | Yes | advisor‡, admin | W | Yes (`writeHeavy`) | `advisor_note_deleted` |
| `/api/advisor/clients/[clientId]/tasks` | GET | Yes | advisor‡, admin | R | No | — |
| `/api/advisor/clients/[clientId]/task-suggestions` | GET | Yes | advisor‡, admin | R | No | — |
| `/api/advisor/clients/[clientId]/review-status` | GET | Yes | advisor‡, admin | R | No | — |
| `/api/advisor/clients/[clientId]/review-status` | PATCH | Yes | advisor‡, admin | W | No‡ | `client_review_status_updated` |
| `/api/advisor/clients/[clientId]/file-quality` | GET | Yes | advisor‡, admin | R | No | — |
| `/api/advisor/clients/[clientId]/documents/upload` | POST | Yes | advisor‡, admin | W | Yes (`writeHeavy`) | `advisor_document_uploaded` |
| `/api/advisor/clients/[clientId]/documents/[documentId]/delete` | POST | Yes | advisor‡, admin | W | Yes (`writeHeavy`) | `advisor_document_deleted` |
| `/api/advisor/clients/[clientId]/documents/[documentId]/signed-url` | POST | Yes | advisor‡, admin | W | No | `advisor_document_accessed` |
| `/api/advisor/clients/[clientId]/reports/wealth-blueprints/[blueprintId]` | GET | Yes | advisor‡, admin | R | No | `advisor_wealth_blueprint_viewed` |
| `/api/advisor/clients/[clientId]/reports/annual-reviews/[reviewId]` | GET | Yes | advisor‡, admin | R | No | `advisor_annual_review_viewed` |

‡Advisor must be assigned to `clientId`; admin may access any client.

---

## Admin (`requireAdminAccess`)

| Route | Method | Auth | Role | R/W | RL | Audit |
|-------|--------|------|------|-----|----|-------|
| `/api/admin/users` | GET | Yes | admin | R | No | — |
| `/api/admin/users/[userId]/role` | PATCH | Yes | admin | W | Yes (`writeHeavy`) | `user_role_updated` |
| `/api/admin/clients` | GET | Yes | admin | R | No | — |
| `/api/admin/clients/[clientId]/advisor` | PATCH | Yes | admin | W | Yes (`writeHeavy`) | `client_advisor_assigned` / `client_advisor_unassigned` |
| `/api/admin/clients/create-placeholder` | POST | Yes | admin | W | No‡ | `client_placeholder_created` |
| `/api/admin/client-invitations` | GET | Yes | admin | R | No | — |
| `/api/admin/client-invitations` | POST | Yes | admin | W | Yes (`writeHeavy`) | `client_invitation_created` / `client_invitation_failed` |

---

## Rate Limit Presets

| Bucket | Window | Max | Routes |
|--------|--------|-----|--------|
| `writeHeavy` | 60s | 30 | Client writes, advisor/admin mutations |
| `commandCenter` | 60s | 120 | Advisor command-center GET routes |
| `health` | 60s | 20 | `/api/health/supabase` (per IP) |

---

## Routes Flagged for Review (no rate limit on write)

These authenticated writes do **not** call `rateLimitOrThrow` as of Phase 4R inventory:

| Route | Method | Notes |
|-------|--------|-------|
| `/api/advisor/clients/create-placeholder` | POST | Consider adding `writeHeavy` |
| `/api/admin/clients/create-placeholder` | POST | Consider adding `writeHeavy` |
| `/api/advisor/clients/[clientId]/review-status` | PATCH | Consider adding `writeHeavy` |
| `/api/documents/signed-url` | POST | Read-like but mutates access; consider light limit |
| `/api/advisor/clients/[clientId]/documents/[documentId]/signed-url` | POST | Access audit only; consider light limit |

Detected automatically by `npm run qa:routes`.

---

## Auth Implementation Reference

| Pattern | Module | HTTP codes |
|---------|--------|------------|
| `ensureUserClientProfile()` | `lib/supabase/userProfile.ts` | 401 unauthenticated |
| `requireAdvisorAccess()` | `lib/supabase/advisorAuth.ts` | 401 / 403 |
| `requireAdminAccess()` | `lib/supabase/adminManagement.ts` | 401 / 403 |
| `resolveAccessibleClient()` | advisor query modules | 403 / 404 |
