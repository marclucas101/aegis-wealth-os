# Role Access Matrix — Phase 4R

**Date:** 2026-06-10  
**Purpose:** Expected access by role for pages and API routes.

**Legend:** ✅ Allowed · ❌ Denied · ⚠️ Partial (authenticated but wrong role) · — Not applicable

**Related:** [API Route Inventory](./API_ROUTE_INVENTORY.md) · [Supabase Security Review](./SUPABASE_SECURITY_REVIEW.md)

---

## Roles

| Role | Description |
|------|-------------|
| **Unauthenticated** | No Supabase session cookie |
| **Client** | `public.users.role = 'client'` — owns one client record |
| **Advisor** | `public.users.role = 'advisor'` |
| **Assigned advisor** | Advisor where `clients.advisor_user_id = auth.uid()` |
| **Unassigned advisor** | Advisor with no matching assignment for target client |
| **Admin** | `public.users.role = 'admin'` — full admin + advisor-equivalent API access |

---

## Page Routes (Middleware)

Middleware (`middleware.ts`) gates **authentication only**, not role. Unauthenticated users are redirected to `/login`. Role enforcement happens in page components and API handlers.

| Page prefix | Unauthenticated | Client | Advisor | Admin |
|-------------|-----------------|--------|---------|-------|
| `/` | ✅ | ✅ | ✅ | ✅ |
| `/login`, `/signup` | ✅ | redirect → `/dashboard` | redirect | redirect |
| `/dashboard` | ❌ → login | ✅ | ✅ | ✅ |
| `/profile` | ❌ | ✅ | ✅ | ✅ |
| `/discover` | ❌ | ✅ | ✅ | ✅ |
| `/shield-diagnostic` | ❌ | ✅ | ✅ | ✅ |
| `/stress-testing` | ❌ | ✅ | ✅ | ✅ |
| `/roadmap` | ❌ | ✅ | ✅ | ✅ |
| `/wealth-blueprint` | ❌ | ✅ | ✅ | ✅ |
| `/annual-review` | ❌ | ✅ | ✅ | ✅ |
| `/document-vault` | ❌ | ✅ | ⚠️ page loads* | ⚠️ |
| `/advisor` | ❌ | ⚠️ page loads* | ✅ | ✅ |
| `/admin` | ❌ | ⚠️ page loads* | ⚠️ | ✅ |
| `/supabase-health` | ✅ | ✅ | ✅ | ✅ |

\*Page may render but API calls return 403; UI should show access denied.

---

## Client Portal API (`ensureUserClientProfile`)

Scoped to the authenticated user's own client. Never accepts browser-supplied `client_id`.

| Route | Method | Unauth | Client | Advisor | Admin |
|-------|--------|--------|--------|---------|-------|
| `/api/me` | GET | ✅ `authenticated:false` | ✅ own profile | ✅ own profile | ✅ own profile |
| `/api/discover/current` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/discover/save` | POST | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/dashboard/current` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/shield-diagnostic/current` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/roadmap/current` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/roadmap/status` | POST | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/stress-testing/current` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/stress-testing/run` | POST | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/stress-testing/history` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/wealth-blueprint/current` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/wealth-blueprint/save` | POST | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/wealth-blueprint/history` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/annual-review/current` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/annual-review/save` | POST | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/annual-review/history` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/documents/list` | GET | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/documents/upload` | POST | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/documents/delete` | POST | ❌ 401 | ✅ | ✅† | ✅† |
| `/api/documents/signed-url` | POST | ❌ 401 | ✅ | ✅† | ✅† |

†Advisor/admin users still have their **own** client record via provisioning — these routes operate on that record, not on assigned clients. Advisor access to **other** clients uses `/api/advisor/*` routes.

---

## Advisor API (`requireAdvisorAccess` — role `advisor` or `admin`)

Client-scoped routes use `resolveAccessibleClient`: advisors need assignment; admins bypass.

| Route | Method | Unauth | Client | Unassigned advisor | Assigned advisor | Admin |
|-------|--------|--------|--------|--------------------|------------------|-------|
| `/api/advisor/overview` | GET | ❌ 401 | ❌ 403 | ✅ (own clients) | ✅ | ✅ |
| `/api/advisor/command-center` | GET | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/command-center/heavy` | GET | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/notifications` | GET | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/review-pipeline` | GET | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/file-quality` | GET | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/task-suggestions` | GET | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/tasks` | GET/POST | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/tasks/[taskId]` | PATCH | ❌ 401 | ❌ 403 | ✅‡ | ✅‡ | ✅ |
| `/api/advisor/task-suggestions/create-task` | POST | ❌ 401 | ❌ 403 | ✅‡ | ✅ | ✅ |
| `/api/advisor/client-invitations` | GET/POST | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/clients/create-placeholder` | POST | ❌ 401 | ❌ 403 | ✅ | ✅ | ✅ |
| `/api/advisor/clients/[clientId]` | GET | ❌ 401 | ❌ 403 | ❌ 403/404 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/command-center` | GET | ❌ 401 | ❌ 403 | ❌ 403/404 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/notes` | GET/POST | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/notes/[noteId]` | PATCH/DELETE | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/tasks` | GET | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/task-suggestions` | GET | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/review-status` | GET/PATCH | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/file-quality` | GET | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/documents/upload` | POST | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/documents/[documentId]/delete` | POST | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/documents/[documentId]/signed-url` | POST | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/reports/wealth-blueprints/[blueprintId]` | GET | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| `/api/advisor/clients/[clientId]/reports/annual-reviews/[reviewId]` | GET | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |

‡Task must belong to an accessible client.

---

## Admin API (`requireAdminAccess` — role `admin` only)

| Route | Method | Unauth | Client | Advisor | Admin |
|-------|--------|--------|--------|---------|-------|
| `/api/admin/users` | GET | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `/api/admin/users/[userId]/role` | PATCH | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `/api/admin/clients` | GET | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `/api/admin/clients/[clientId]/advisor` | PATCH | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `/api/admin/clients/create-placeholder` | POST | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `/api/admin/client-invitations` | GET/POST | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |

---

## Public API

| Route | Method | Unauth | Notes |
|-------|--------|--------|-------|
| `/api/health/supabase` | GET | ✅ | Rate-limited; production mode minimizes payload |

---

## Summary Rules

1. **Authentication** is required for all data routes except health.
2. **Client routes** always resolve `client_id` from session — never from request body.
3. **Advisor routes** require `advisor` or `admin` role; client-specific routes additionally require assignment (except admin).
4. **Admin routes** require `admin` role exclusively.
5. **Middleware** does not enforce role — only session presence on protected pages.
