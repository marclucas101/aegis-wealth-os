# Advisor & Admin Access Review — Phase 4X

**Date:** 2026-06-10  
**Related:** [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) · [API Security Review](./API_SECURITY_REVIEW.md) · [RLS Policy Review](./RLS_POLICY_REVIEW.md)

---

## Role model

| Role | `users.role` | Client record | API access |
|------|--------------|---------------|------------|
| Client | `client` | `clients.user_id = auth.uid()` | Client portal `/api/*` (own client) |
| Advisor | `advisor` | Optional own client via provisioning | `/api/advisor/*` + own client portal |
| Admin | `admin` | Optional own client | `/api/admin/*` + full advisor API + own client portal |

**Assignment:** `clients.advisor_user_id` — single advisor per client (MVP).

---

## Advisor-only boundaries

### API (`requireAdvisorAccess`)

- Minimum role: `advisor` or `admin`
- Returns **401** without session, **403** for `client` role users

### Client workspace (`resolveAccessibleClient`)

| Actor | `clientId` in URL | Result |
|-------|-------------------|--------|
| Assigned advisor | Own assignment | 200 |
| Unassigned advisor | Another advisor's client | **403** |
| Admin | Any valid client | 200 |
| Invalid UUID | — | **404** |

**Applies to:** notes, tasks, documents, reports, file-quality, review-status, command-center, task-suggestions.

### RLS (direct Supabase)

| Resource | Advisor (assigned) | Advisor (unassigned) |
|----------|------------------|----------------------|
| `advisor_notes` | SELECT/INSERT/UPDATE own | Denied |
| `clients` | SELECT via `owns_client` | Denied |
| `documents` | SELECT/INSERT/UPDATE | Denied |
| Storage `client-documents` | SELECT/INSERT/UPDATE via `owns_client` | Denied |
| Storage DELETE | Allowed if assigned | Denied |

### Data clients must NOT see

- `advisor_notes` — RLS blocks client SELECT
- Other clients' profiles — RLS + no API route
- Admin user list — admin API only

---

## Admin-only boundaries

### API (`requireAdminAccess`)

- Minimum role: `admin` only (`advisor` role gets **403** on `/api/admin/*`)

### Capabilities (admin exclusive)

| Action | Route |
|--------|-------|
| List all users | `GET /api/admin/users` |
| Change user roles | `PATCH /api/admin/users/[userId]/role` |
| List all clients | `GET /api/admin/clients` |
| Assign/unassign advisor | `PATCH /api/admin/clients/[clientId]/advisor` |
| Create placeholder (any advisor) | `POST /api/admin/clients/create-placeholder` |
| Admin-scoped invitations | `/api/admin/client-invitations` |

### Admin as advisor

Admins pass `requireAdvisorAccess()` and may access **any** client workspace without assignment check (`userRole === "admin"` bypass in `resolveAccessibleClient`).

---

## Assigned vs unassigned advisor behavior

| Scenario | Overview / pipeline | Client workspace | Notes | Upload doc |
|----------|---------------------|------------------|-------|------------|
| Assigned advisor | Sees client in book | ✅ | ✅ | ✅ |
| Unassigned advisor | Does not see client | 403 on direct URL/API | 403 | 403 |
| Admin | Sees all | ✅ | ✅ | ✅ |
| Client user on `/advisor` | Page may load* | 403 on APIs | — | — |

\*UI shows `AdvisorAccessDenied` when page component checks role; middleware only requires login.

---

## Page-level vs API-level enforcement

| Layer | Enforces | Does NOT enforce |
|-------|----------|------------------|
| `middleware.ts` | Login for protected prefixes | Role (advisor/admin/client) |
| `app/advisor/page.tsx` | Advisor access | Per-client assignment |
| `app/admin/page.tsx` | `requireAdminAccess` | — |
| API handlers | Role + assignment + ownership | — |

**Implication:** A `client` user can navigate to `/advisor` if they guess the URL but all API calls fail with 403.

---

## Suggested manual tests

### Setup

Create test users in Supabase:

- `client-a@test` (role client)
- `advisor-1@test` (role advisor, assigned to Client A)
- `advisor-2@test` (role advisor, not assigned to Client A)
- `admin@test` (role admin)

### Advisor isolation

1. Login as `advisor-2` → `GET /api/advisor/clients/{clientA-id}` → expect **403**
2. Login as `advisor-1` → same request → expect **200**
3. Login as `advisor-1` → `POST /api/advisor/clients/{clientA-id}/notes` → expect **200**
4. Login as `client-a` → `GET /api/advisor/overview` → expect **403**

### Admin elevation

5. Login as `admin` → `GET /api/admin/users` → **200**
6. Login as `advisor-1` → same → **403**
7. Login as `admin` → `PATCH /api/admin/users/{advisor-1-id}/role` body `{ "role": "client" }` → **200** + audit log
8. Login as `admin` → assign `advisor-2` to Client A → advisor-1 loses access (**403**)

### Client portal boundary

9. Login as `client-a` → `POST /api/discover/save` with valid body → **200**
10. Same request with `"client_id": "other-uuid"` in body → **400**
11. Login as `advisor-1` → `POST /api/discover/save` → operates on **advisor's own** provisioned client, not Client A

### Cross-tenant documents

12. `advisor-1` upload to Client A → **200**
13. `advisor-2` upload to Client A → **403**
14. `client-a` cannot call advisor document upload route → **403**

### Placeholder / invitation

15. `advisor-1` `POST /api/advisor/clients/create-placeholder` → client assigned to self
16. `admin` create-placeholder with `advisor_user_id` → assigned to specified advisor

---

## Failure mode expectations

| Condition | Code | Body hint |
|-----------|------|-----------|
| No cookie | 401 | `unauthenticated` / `Authentication required` |
| Wrong role | 403 | `forbidden` / `Advisor access required` |
| Wrong client | 403 | `You do not have access to this client` |
| Missing entity | 404 | `not_found` / `Client not found` |
| Rate limit | 429 | `Too many requests` |

---

**Conclusion:** Advisor/admin separation is enforced at API layer with consistent assignment checks. Unassigned advisors are isolated from client workspaces. Admins have superuser API access by design. Page middleware remains auth-only; API is the security boundary.
