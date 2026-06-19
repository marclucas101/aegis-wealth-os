# Phase 9A — Access Architecture Audit

Audit date: 2026-06-20  
Scope: Server-side access controls for personalised financial outputs  
Principle: **Frontend hiding is not access control.**

---

## Role model

| Layer | Location | Values |
|-------|----------|--------|
| DB enum `user_role` | `supabase/migrations/202606100001_extensions_and_enums.sql` | `client`, `advisor`, `admin` |
| DB enum `client_status` (legacy) | Same | `prospect`, `onboarding`, `active`, `review_due`, `archived` |
| DB enum `relationship_stage` (Phase 9A) | `supabase/migrations/202606200001_phase9a_compliance_access_architecture.sql` | `prospect` … `inactive_client` |
| TS types | `lib/roles.ts`, `lib/supabase/userProfile.ts`, `lib/compliance/types.ts` | Mirrors DB |

**Auth guards:** `requireAuthenticatedUser`, `ensureUserClientProfile`, `requireAdvisorAccess`, `requireAdminAccess`, `resolveAccessibleClient`.

---

## Route audit — client financial APIs

| Route | Existing audience | Data returned (pre-9A) | Proposed audience | Remediation (9A) | Risk |
|-------|-------------------|------------------------|-------------------|----------------|------|
| `GET /api/dashboard/current` | Authenticated client (own record) | Full shield, pillars, AWRI, benchmark, stress, roadmap, income, net worth | Client: safe readiness snapshot or published overview; Adviser: `/api/advisor/clients/[id]/dashboard` | `resolveClientFinancialReadinessAccess` + envelope DTO | **Red** |
| `GET /api/shield-diagnostic/current` | Client | Shield score, pillar weaknesses, discover formData | Adviser-internal only; client fallback | `resolveRestrictedClientModuleAccess` + fallback envelope | **Red** |
| `GET /api/stress-testing/current` | Client | All stress scenarios, shield | Adviser-internal only; client fallback | Gated; kill switch `client_stress_test_visibility` | **Red** |
| `POST /api/stress-testing/run` | Client | Mutates + returns stress results | Client (self-service scenario tool) with flag off by default | Flag `client_stress_test_visibility` | **Red** |
| `GET /api/stress-testing/history` | Client | Historical stress summaries | Adviser-internal | Flag-gated (unchanged path, blocked when flag off) | **Red** |
| `GET /api/roadmap/current` | Client | Roadmap recommendations, projected shield | Published roadmap summary only | Fallback envelope; raw behind `raw_client_financial_views` | **Red** |
| `GET /api/annual-review/current` | Client | Timeline, projections, roadmap, stress exposures | Published annual review summary | Fallback envelope | **Red** |
| `GET /api/wealth-blueprint/current` | Client | Full institutional report snapshot | Published blueprint summary | Fallback envelope | **Red** |
| `GET /api/discover/current` | Client | Full discover form (submitted information) | Client (own submitted data) | No change — Green | **Green** |
| `POST /api/discover/save` | Client | Writes discover + triggers scoring | Client (data submission) | No change | **Green** |
| `GET /api/budget-optimiser/current` | Client | Income, expenses, user-controlled entries | Client (user-controlled calculations) | No change | **Green** |
| `POST /api/budget-optimiser/save` | Client | Saves budget + analysis | Client; analysis is educational/self-service | No change | **Amber** |
| `GET /api/documents/list` | Client | Document metadata | Client (limited/prospect) or full (active) | Entitlement-based nav; RLS unchanged | **Amber** |
| `GET /api/promotions` | Client | Published promotions | Client (educational) | Entitlement `insights_and_updates` | **Green** |
| `GET /api/my-adviser/*` | Client | Adviser profile, booking | Client | No change | **Green** |

---

## Route audit — adviser financial APIs (Phase 8C preserved)

| Route | Audience | Data returned | Proposed audience | Remediation | Risk |
|-------|----------|---------------|-------------------|-------------|------|
| `GET /api/advisor/clients/[clientId]/dashboard` | Assigned adviser / admin | Full `DashboardSnapshot` read-only | Adviser-internal | Unchanged + access audit log | **Red** (adviser-only) |
| `GET /api/advisor/clients/[clientId]/shield-diagnostic` | Assigned adviser / admin | Full shield diagnostic | Adviser-internal | Unchanged | **Red** |
| `GET /api/advisor/clients/[clientId]/stress-tests` | Assigned adviser / admin | Stress snapshot + history | Adviser-internal | Unchanged (no run) | **Red** |
| `GET /api/advisor/clients/[clientId]/budget` | Assigned adviser / admin | Budget + analysis | Adviser-internal | Unchanged | **Amber** |
| `GET /api/advisor/clients/[clientId]` | Assigned adviser / admin | Workspace aggregate | Adviser-internal | Unchanged | **Red** |
| `GET /api/advisor/clients/[clientId]/file-quality` | Assigned adviser / admin | Readiness + recommended actions | Adviser-internal | Unchanged | **Red** |
| `GET /api/advisor/clients/[clientId]/task-suggestions` | Assigned adviser / admin | Recommended tasks | Adviser-internal | Unchanged | **Red** |
| `GET /api/advisor/clients/[clientId]/notes` | Assigned adviser / admin | Adviser notes | Adviser-internal | Unchanged | **Red** |
| `GET /api/advisor/overview` | Adviser / admin | Book-wide shield aggregates | Adviser-internal | Unchanged | **Red** |

---

## Route audit — admin

| Route | Data | Risk |
|-------|------|------|
| `GET /api/admin/clients` | All clients + shield scores | **Red** (admin-only) |
| `PATCH /api/admin/clients/[clientId]/advisor` | Assignment | **Amber** |
| `PATCH /api/admin/clients/[clientId]/relationship-stage` | Stage control (9A) | **Amber** |
| `GET/PATCH /api/admin/feature-controls` | Kill switches (9A) | **Amber** |

---

## Navigation generation

| Component | Pre-9A | Post-9A |
|-----------|--------|---------|
| `lib/navigation.ts` | Role flags (`advisorOnly`, `clientOnly`) | Catalogue unchanged |
| `AuthenticatedAppShell.tsx` | `getNavSectionsForRole` | `getNavSectionsForEntitlements` for clients |
| `lib/compliance/entitlements.ts` | — | Canonical entitlement resolver |

---

## Document visibility

- Archive flag `documents.is_archived` only — no adviser-only document column yet.
- RLS: `owns_client()` includes assigned adviser.
- **Gap (deferred):** granular client vs adviser document visibility → Phase 9E.

---

## Promotions

- Audience enum locked to `all_users`.
- Client API returns published promotions with signed URLs only.

---

## Audit log infrastructure

- Table: `audit_logs` (service-role writes only).
- Phase 9A additions: relationship stage changes, publication lifecycle, client viewed published output, adviser viewed internal analysis, admin feature control updates.

---

## RLS summary

- Financial SELECT via `owns_client()` or `is_admin()`.
- `published_outputs`: clients see published `client_published` rows only; advisers see assigned client rows.
- `platform_feature_controls`: admin SELECT only; writes via service role.

---

## Service-role usage

- All financial loaders use `createAdminSupabaseClient()` after API-layer auth.
- **Known gap:** duplicated `resolveAccessibleClient` in 8 modules — consolidation deferred post-9A.

---

## Compatibility notes

- Legacy `client_status` preserved; `relationship_stage` is additive.
- Temporary flag `raw_client_financial_views` (default **off**) for dev rollback of client API shapes.
- Client dashboard UI renders `FinancialReadinessSnapshotView` for envelope responses.

---

## Retirement plan

1. Remove `raw_client_financial_views` flag after Phase 9D portal redesign validates published-only client paths.
2. Retire raw snapshot branches in client module routes.
3. Consolidate duplicated `resolveAccessibleClient` implementations.
