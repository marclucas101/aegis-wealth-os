# Service Role Usage Review — Phase 4X

**Date:** 2026-06-10  
**Entry point:** `lib/supabase/admin.ts` → `createAdminSupabaseClient()`  
**Key env:** `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`)

**Automation:** `npm run security:service-role`

**Related:** [Security Audit Report](./SECURITY_AUDIT_REPORT.md) · [RLS Policy Review](./RLS_POLICY_REVIEW.md)

---

## Why service role is used

| Reason | Examples |
|--------|----------|
| Bypass RLS for trusted server writes | Scoring chain, discover save, document upload |
| User/client provisioning | `ensureUserClientProfile`, placeholder clients |
| Advisor/admin operations spanning tenants | `resolveAccessibleClient` + explicit checks |
| Append-only audit log | `writeAuditLog()` — no authenticated INSERT policy |
| Role lookup after auth | `requireAdvisorAccess`, `requireAdminAccess` load `users.role` |
| Health probe | `GET /api/health/supabase` — DB connectivity |

---

## Module inventory

### Core (defines / exports key)

| Module | `server-only` | Role |
|--------|---------------|------|
| `lib/supabase/admin.ts` | ✅ | Creates service-role client |
| `lib/supabase/env.ts` | — | `getSupabaseServiceRoleKey()` |

### Persistence / queries (service role inside)

| Module | Explicit access checks |
|--------|------------------------|
| `userProfile.ts` | Session `auth.uid()` |
| `discoverPersistence.ts` | Session client |
| `dashboardQueries.ts` | Session client |
| `moduleQueries.ts` | Session client |
| `roadmapPersistence.ts` | Session client |
| `stressPersistence.ts` | Session client |
| `reportPersistence.ts` | Session client |
| `documentPersistence.ts` | `fetchOwnedDocument`, session client |
| `advisorAuth.ts` | `getUser()` then role check |
| `adminManagement.ts` | Admin gate + validation |
| `clientOnboarding.ts` | Caller-supplied advisor ID validated |
| `advisorQueries.ts` | Advisor user ID scope |
| `advisorClientQueries.ts` | `resolveAccessibleClient` |
| `advisorNotesPersistence.ts` | `resolveAccessibleClient` |
| `advisorTasks.ts` | `resolveAccessibleClient` |
| `advisorDocumentPersistence.ts` | `resolveAccessibleClient` |
| `advisorDocumentAccess.ts` | `resolveAccessibleClient` |
| `advisorReportQueries.ts` | `resolveAccessibleClient` |
| `advisorReviewPipeline.ts` | `resolveAccessibleClient` |
| `advisorTaskSuggestions.ts` | `resolveAccessibleClient` |
| `advisorNotifications.ts` | Advisor user ID |
| `clientFileQuality.ts` | `resolveAccessibleClient` |
| `auditLog.ts` | Trusted server caller |

### API routes (direct import)

| Route | Explicit checks |
|-------|-----------------|
| `app/api/health/supabase/route.ts` | Public; rate limited; production-safe payload |

### Server pages (direct import — not API)

| Page | Checks |
|------|--------|
| `app/advisor/.../print/page.tsx` (×2) | `requireAdvisorAccess` + `loadAdvisor*Detail` before admin client for display name |

**Note:** Print pages use service role only for `clients.display_name` after access gate. Acceptable server-component pattern; not bundled to client.

---

## Unsafe import scan results

**Automated scan (`npm run security:service-role`):**

| Category | Result |
|----------|--------|
| Client Components (`"use client"`) | ✅ None import service role |
| `components/**` | ✅ Only type imports from `adminManagement` |
| `lib/supabase/client.ts` | ✅ Anon key only |
| `NEXT_PUBLIC_*SERVICE_ROLE*` | ✅ Not found in source or `.env.example` |

**Manual review items:**

- Advisor print server pages import `createAdminSupabaseClient` — **safe** (RSC, post-`requireAdvisorAccess`).

---

## Explicit checks pattern (advisor routes)

```text
requireAdvisorAccess()
  → resolveAccessibleClient(authUserId, role, clientId)
      → admin: load client by ID (any)
      → advisor: 403 if client.advisor_user_id !== authUserId
  → persistence mutation with service role
  → writeAuditLog (writes)
```

Admin routes use `requireAdminAccess()` — no assignment restriction.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Env key in client bundle | Critical | Never `NEXT_PUBLIC_`; verify build output |
| Missing `resolveAccessibleClient` on new advisor route | High | Code review + `npm run security:api` |
| Service role on health endpoint | Medium | Rate limit + minimal production response |
| All reads use service role | Medium (accepted) | RLS not second line for API reads |

---

## Verification commands

```bash
npm run security:service-role
npm run qa:env
npm run deploy:config -- --production
```

After `next build`, grep `.next/static` for `service_role` string — should find **no** matches.

---

**Conclusion:** Service role is confined to server modules and route handlers. No client-bundle exposure detected. All advisor mutations chain through `requireAdvisorAccess` and `resolveAccessibleClient`.
