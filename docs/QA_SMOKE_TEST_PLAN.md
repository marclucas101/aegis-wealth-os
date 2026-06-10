# QA Smoke Test Plan — Phase 4R

**Date:** 2026-06-10  
**Purpose:** Structured manual and automated smoke tests before deploy or after major changes.

**Automation:** `npm run qa:smoke` covers unauthenticated API checks only. Complete the manual sections below for full coverage.

**Related:** [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md) · [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) · [Security Test Plan](./SECURITY_TEST_PLAN.md)

---

## Prerequisites

1. Local or staging app running (`npm run dev` or deployed URL)
2. Env vars verified (`npm run qa:env`)
3. Test accounts prepared in Supabase:

| Account | Role | Assignment notes |
|---------|------|------------------|
| `client@test.local` | `client` | Standard portal user |
| `advisor-a@test.local` | `advisor` | Assigned to at least one test client |
| `advisor-b@test.local` | `advisor` | **Not** assigned to advisor-a's clients |
| `admin@test.local` | `admin` | Full admin console access |

Set roles in `public.users.role`. Set `clients.advisor_user_id` for assignment tests.

---

## A. Automated API Smoke (no credentials)

Run with server up:

```bash
npm run qa:smoke
```

| # | Check | Expected |
|---|-------|----------|
| A1 | Health probe | 200 (healthy) or 503 (unreachable DB); never 500 |
| A2 | Health JSON | `ok` boolean present; no JWT-like tokens in body |
| A3 | `/api/me` unauthenticated | 200, `{ authenticated: false }` |
| A4 | Client protected GET | 401 |
| A5 | Client protected POST | 401 |
| A6 | Advisor protected GET | 401 |
| A7 | Admin protected GET/PATCH | 401 |

---

## B. Unauthenticated User

| # | Step | Expected |
|---|------|----------|
| B1 | Visit `/` | Landing loads |
| B2 | Visit `/dashboard` | Redirect to `/login?next=/dashboard` |
| B3 | Visit `/advisor`, `/admin`, `/document-vault` | Redirect to login |
| B4 | Visit `/login`, `/signup` | Auth pages load |
| B5 | `GET /api/dashboard/current` | 401 |
| B6 | `GET /api/advisor/overview` | 401 |
| B7 | `GET /api/admin/users` | 401 |

---

## C. Client User

Log in as client. Complete in order where data dependencies exist.

| # | Step | Expected |
|---|------|----------|
| C1 | `/dashboard` loads | Snapshot cards render; no 500 |
| C2 | `/discover` — save profile | Save succeeds; score updates |
| C3 | `/shield-diagnostic` | Current shield data loads |
| C4 | `/roadmap` — update item status | Status persists after refresh |
| C5 | `/stress-testing` — run mild scenario | Result saves; history shows run |
| C6 | `/wealth-blueprint` — save | Snapshot saved; history entry |
| C7 | `/annual-review` — save | Snapshot saved; history entry |
| C8 | `/document-vault` — upload PDF | Appears in list |
| C9 | Open document (signed URL) | File opens in new tab |
| C10 | Archive/delete document | Removed from active list |
| C11 | `/profile` | User/client info visible |
| C12 | `/advisor`, `/admin` | Page may load (middleware) but API returns 403 |
| C13 | `GET /api/me` | `authenticated: true`, own `clientId` |

---

## D. Advisor User (assigned)

Log in as advisor with assigned clients.

| # | Step | Expected |
|---|------|----------|
| D1 | `/advisor` dashboard | Overview, pipeline sections load |
| D2 | Open assigned client workspace | Client detail loads |
| D3 | Command center (dashboard + client) | Consolidated payload loads |
| D4 | Create note on assigned client | Note appears in list |
| D5 | Edit / delete note | Changes persist |
| D6 | Create task | Task appears |
| D7 | Update task status | Status persists |
| D8 | View task suggestions → create task | Task created from suggestion |
| D9 | Update review status | Pipeline reflects change |
| D10 | Upload document to client vault | Document listed |
| D11 | Open client document (signed URL) | File accessible |
| D12 | Delete advisor-uploaded document | Removed |
| D13 | View wealth blueprint / annual review report | Report loads; audit logged |
| D14 | File quality panel | Scores load for assigned client |
| D15 | Notifications panel | Notifications load |
| D16 | Create client invitation | Invitation recorded |

---

## E. Advisor User (unassigned)

Log in as advisor **without** assignment to target client.

| # | Step | Expected |
|---|------|----------|
| E1 | `/advisor` overview | Only assigned clients listed |
| E2 | `GET /api/advisor/clients/{unassigned-id}` | 403 or 404 |
| E3 | Notes/tasks/documents on unassigned client | 403 |
| E4 | Command center for unassigned client | 403 or 404 |

---

## F. Admin User

| # | Step | Expected |
|---|------|----------|
| F1 | `/admin` dashboard | Users and clients load |
| F2 | Change user role (e.g. client → advisor) | Role persists; audit logged |
| F3 | Assign advisor to client | `advisor_user_id` updated |
| F4 | Unassign advisor | Assignment cleared |
| F5 | Create placeholder client | Client created |
| F6 | Create client invitation | Invitation recorded |
| F7 | Access any client via advisor workspace routes | 200 (admin bypasses assignment) |
| F8 | Non-admin cannot perform F2–F6 | 403 |

---

## G. Cross-Role Regression Spot Checks

| # | Scenario | Expected |
|---|----------|----------|
| G1 | Client POST with `client_id` in body | 400 rejection |
| G2 | Client POST with `role: admin` in body | 400 rejection |
| G3 | Rapid writes (>30/min) on discover save | 429 with `Retry-After` |
| G4 | Invalid UUID in advisor client path | 404 (not 500) |
| G5 | Duplicate admin role change | Idempotent or safe error |

---

## H. Page Route Smoke (all roles)

Quick load check — no console errors, no infinite spinners.

| Route | Client | Advisor | Admin | Anonymous |
|-------|--------|---------|-------|-----------|
| `/` | ✓ | ✓ | ✓ | ✓ |
| `/login` | redirect if logged in | | | ✓ |
| `/dashboard` | ✓ | ✓ | ✓ | redirect |
| `/discover` | ✓ | ✓ | ✓ | redirect |
| `/document-vault` | ✓ | — | — | redirect |
| `/advisor` | middleware pass* | ✓ | ✓ | redirect |
| `/admin` | middleware pass* | middleware pass* | ✓ | redirect |

\*Client users reach advisor/admin pages via middleware (authenticated) but API/UI should show forbidden state.

---

## Failure Logging

Record failures with:

- Date, environment (local/staging/prod)
- Account role used
- Route or page URL
- HTTP status and response body (redact tokens)
- Browser console / server log excerpt
- Steps to reproduce

---

## Exit Criteria

- [ ] All automated smoke tests pass (`npm run qa:smoke`)
- [ ] Sections B–G completed on staging with test accounts
- [ ] No P0/P1 defects open for auth, data loss, or cross-tenant access
- [ ] [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md) signed off
