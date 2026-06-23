# Phase 9F.4 — Role and Compliance Audit

**Checkpoint:** 9F.4 Checkpoint 1 (audit only)  
**Branch:** `phase-9f4-compliance-promotions-retirement`  
**Date:** 2026-06-24

## Executive summary

AEGIS uses a **three-value user role model** (`client`, `advisor`, `admin`). There is **no distinct `compliance` role** in the database, TypeScript, or JWT metadata. Compliance-style content approval is performed by **admins** under the `admin_content_approval` platform feature. Adviser publication workflows use **assigned-adviser or admin** gates, not a separate compliance actor.

**Recommendation:** Do **not** invent a new `compliance` role in Phase 9F.4 without operator policy approval. Existing `admin` + `admin_content_approval` already covers governed communications approval; adviser-controlled paths remain appropriate for client-specific operational documents and adviser-reviewed planning outputs.

---

## Canonical role values

| Value | Layer | Definition |
|-------|-------|------------|
| `client` | DB `user_role` enum | Default signup role; portal user |
| `advisor` | DB `user_role` enum | Assigned adviser workspace access |
| `admin` | DB `user_role` enum | Firm administration; acts as content approver until dedicated compliance role exists |

**Database source of truth:** `supabase/migrations/202606100001_extensions_and_enums.sql` — `CREATE TYPE user_role AS ENUM ('client', 'advisor', 'admin')`.

**TypeScript source of truth:** `lib/roles.ts` — `UserRole = "client" | "advisor" | "admin"`.

**Duplicate TS definition:** `lib/supabase/userProfile.ts` re-declares the same `UserRole` union for `AppUserRow`. Values are identical; not a semantic drift risk.

**Auth metadata:** `handle_new_user()` inserts `id, email, full_name` only. Role is **not** stored in JWT `user_metadata` / `app_metadata`. Server guards load `public.users.role` via service-role admin client (`lib/supabase/authGuards.ts` — *"Never trusts role values from the browser"*).

### Related enums (not user roles)

| Enum / type | Purpose |
|-------------|---------|
| `relationship_stage` | Client workflow stage (prospect → active_client) |
| `publication_status` | Planning output lifecycle |
| `ContentApprovalStatus` | Governed communications lifecycle |
| Promotion `status` | `draft` / `published` / `archived` (legacy table CHECK) |

---

## Where each role is assigned

| Mechanism | Location | Rule |
|-----------|----------|------|
| Signup default | `users.role` column | `DEFAULT 'client'` |
| Auth trigger | `handle_new_user()` | No role override |
| Profile provisioning | `lib/supabase/userProfile.ts` | Fallback insert with `role: "client"` |
| Admin API | `app/api/admin/users/[userId]/role/route.ts` | `PATCH`; `ALLOWED_ROLES = ["client","advisor","admin"]` |
| Self-escalation block | `202606100014_fix_users_role_self_escalation.sql` | Trigger + column-level UPDATE grants on `users` |
| Adviser assignment | `lib/supabase/adminManagement.ts` | Target user must be `advisor` or `admin` |

---

## Where each role is checked

### Application helpers

| Helper | File | Rule |
|--------|------|------|
| `isAdminRole()` | `lib/roles.ts` | `role === "admin"` |
| `isAdvisorRole()` | `lib/roles.ts` | `role === "advisor" \|\| role === "admin"` |
| `requireAuthenticatedUser()` | `lib/supabase/authGuards.ts` | Session + DB user row |
| `requireAdvisorAccess()` | `lib/supabase/advisorAuth.ts` | `isAdvisorRole(user.role)` |
| `requireAdminAccess()` | `lib/supabase/adminManagement.ts` | `isAdminRole(user.role)` |
| `canPublishClientOutput()` | `lib/compliance/entitlements.ts` | Admin OR assigned adviser + `adviser_publication_workflow` flag |
| `getUserExperienceContext()` | `lib/compliance/entitlements.ts` | Role + relationship stage + feature flags |

### Layout / page gates

| Surface | Gate |
|---------|------|
| `app/advisor/layout.tsx` | `requireAdvisorAccess()` |
| `app/admin/layout.tsx` | `requireAdminAccess()` |
| Active client pages | `requireActiveClientPortalPage()` / entitlement helpers |
| Prospect pages | `requireProspectPortalPage()` |

### Database RLS helpers

| Function | Definition | Meaning |
|----------|------------|---------|
| `is_admin()` | `202606100003_users_and_clients.sql` | `users.role = 'admin'` for `auth.uid()` |
| `is_advisor()` | same | `users.role IN ('advisor','admin')` |
| `is_assigned_advisor(client_id)` | same | Adviser assigned to client |
| `owns_client(client_id)` | same | Client owns their record |

Granted to `authenticated, service_role` in `202606100009_rls_policies.sql`.

### Middleware

`middleware.ts` enforces **authentication only** on protected prefixes (`/advisor`, `/admin`, `/promotions`, etc.). **No role check** at middleware layer — role enforcement is in layouts and API routes.

---

## Shared source of truth assessment

| Concern | Single source? | Notes |
|---------|----------------|-------|
| User roles | **Mostly yes** — DB enum + `lib/roles.ts` | Duplicate type in `userProfile.ts` |
| RLS vs app | **Aligned** — same three values | `is_advisor()` includes admin |
| Client entitlements | **Separate layer** — `entitlements.ts` + `platform_feature_controls` | Not role enums |
| Compliance actor | **Implicit admin** | No `compliance` enum value |

---

## Duplicate or inconsistent role enums

| Finding | Classification |
|---------|----------------|
| `UserRole` in `lib/roles.ts` vs `userProfile.ts` | **Safe to deprecate later** — consolidate types in one module |
| No `compliance` in DB or TS | **Actively required** — admin covers approval today |
| Promotion `status` vs `publication_status` vs `ContentApprovalStatus` | **Intentionally separate** — different subsystems |
| `ClientFeatureKey` includes `"promotions"` but hardcoded `false` | **Inconsistent UX policy** — see entitlements audit |

---

## Routes relying only on UI hiding

| Route | UI hidden? | API/page gate | Risk |
|-------|------------|---------------|------|
| `/promotions` | Yes — not in `ACTIVE_CLIENT_NAV_SECTIONS`; `features.promotions = false` | **No** `requireClientFeaturePage("promotions")`; `GET /api/promotions` auth-only | **Medium** — direct URL/API access |
| `/advisor/promotions` | No — in adviser nav | `requireAdvisorAccess()` | Low |
| Admin communications | Nav-gated | `requireAdminAccess()` + `admin_content_approval` | Low |

---

## Compliance actions using adviser or admin permissions

| Workflow | Actor today | Independent compliance role? |
|----------|-------------|------------------------------|
| Governed content approve/publish | **Admin** | No — admin is approver |
| Planning output review/publish | **Assigned adviser or admin** | No — adviser review is intentional |
| Binder client publication | **Assigned adviser or admin** | No — operational client document |
| Legacy promotion publish | **Any adviser/admin** | **Gap** — no approval step |
| Audit log read (admin) | **Admin** | No |
| Feature control admin | **Admin** | No |
| User role changes | **Admin** | No |

---

## DB values not in TypeScript / TS not in DB

| Direction | Finding |
|-----------|---------|
| DB → TS | **None** — all `user_role` values represented in TS |
| TS → DB | **None** |
| Implicit roles | **None** — no `compliance`, `superadmin`, or `readonly` |

---

## Domain-specific access (non-role)

| Domain | Control mechanism |
|--------|-------------------|
| Document vault | `canClientViewDocument()`, relationship stage, publication flags |
| Audit logs | Admin API + service-role writes |
| Governed content client read | Service-role API only; no client RLS on `governed_content` |
| Promotions client read | RLS `promotions_select_published_active` — any authenticated user |
| Feature controls | `platform_feature_controls` + `lib/compliance/featureFlags.ts` code defaults |

---

## Classification summary

| Item | Classification |
|------|----------------|
| Three-value `user_role` model | **Actively required** |
| `is_admin()` / `is_advisor()` RLS helpers | **Actively required** |
| Admin as compliance approver | **Actively required** (until operator defines compliance role) |
| Distinct `compliance` role | **Unknown / requires operator decision** |
| Duplicate `UserRole` in `userProfile.ts` | **Safe to deprecate** (type consolidation) |
| `/promotions` without entitlement API gate | **Replace before removal** (close gap or retire route) |
| Middleware auth-only (no role) | **Actively required** (by design) |
| Hardcoded `promotions: false` in entitlements | **Actively required** (replacement channel is `/insights`) |

---

## Operator decision: compliance role

**Evidence:** `AdminCommunicationsClient.tsx` states admins act as content approvers until a dedicated compliance role exists. No schema, migration, or auth path references `compliance` as a role.

**Options:**

1. **Retain admin-as-approver** — lowest risk; matches current Phase 9E implementation.
2. **Add `compliance` to `user_role`** — requires migration, RLS review, route guard updates, and operator policy. **Not recommended in 9F.4 audit checkpoint without explicit approval.**

**Verdict:** Existing admin + adviser controls **already cover** intended workflows for this codebase. A distinct production compliance role is **optional**, not evidenced as required.
