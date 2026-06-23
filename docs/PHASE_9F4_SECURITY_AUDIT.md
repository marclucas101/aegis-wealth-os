# Phase 9F.4 — Security Audit (Promotions & Compliance Roles)

**Checkpoint:** 9F.4 Checkpoint 1 (audit) + Checkpoint 2 (write freeze hardening)

> Checkpoint 2 addressed SEC-9F4 gaps below via `lib/promotions/legacyPromotionsAuthorization.ts`, route guards, and `legacy_promotions_write` (default disabled). See `docs/PHASE_9F4_ROUTE_AUTHORIZATION_MATRIX.md`.

## Role escalation

| Finding | Severity | Classification |
|---------|----------|----------------|
| `users` self-role escalation blocked by trigger (`202606100014`) | — | **Mitigated** |
| Admin role assignment only via admin API | — | **Mitigated** |
| `is_advisor()` includes admin — admin can use all adviser paths | — | **By design** |
| No `compliance` role — admins hold approval power | Low | **Unknown / operator decision** |
| JWT does not carry role — server loads DB | — | **Mitigated** |

---

## Compliance-only actions

| Action | Enforced role | Gap |
|--------|---------------|-----|
| Approve governed content | `admin` + `admin_content_approval` | None — but **admin ≠ compliance officer** in policy terms |
| Reject / request changes | `admin` | Same |
| Promotions migration | `admin` | None |
| Legacy promotion publish | **Any adviser** | **Mitigated (Checkpoint 2)** — write freeze + ownership when re-enabled |

---

## Adviser access to campaign records

| Finding | Detail | Classification |
|---------|--------|----------------|
| Any adviser can list **all** promotions | `listAdvisorPromotions()` — no `created_by` filter | **Mitigated (Checkpoint 2)** |
| Any adviser can edit **any** promotion | `updatePromotion()` — no ownership check | **Mitigated (Checkpoint 2)** |
| RLS permits adviser DELETE on any row | Defense-in-depth; app uses service role | Medium if direct Supabase access |

---

## Client exposure

| Finding | Detail | Classification |
|---------|--------|----------------|
| Published promotions visible to **all authenticated users** | RLS `promotions_select_published_active` — not client-scoped | **Replace before removal** |
| `GET /api/promotions` lacks entitlement check | Nav hidden but API callable | **Mitigated (Checkpoint 2)** — fail-closed empty list |
| `app/promotions/page.tsx` lacks `requireClientFeaturePage` | Direct URL access | **Partial** — API gated; page still reachable (Stage 4 removal) |
| Global `audience: all_users` only | No per-adviser or per-client scoping | **Intentionally obsolete** in replacement |
| Insights feed respects communication preferences | `promotional_content` opt-out | **Mitigated** (replacement path) |

---

## Cross-client campaign data

| Finding | Classification |
|---------|----------------|
| Legacy promotions are firm-wide — not cross-client leak but **over-broad** | **Replace before removal** |
| Governed content audience targeting enforces assignment | **Actively required** |
| `governed_content` has no client RLS — API enforces access | **Actively required** |

---

## Public routes

| Route | Auth | Notes |
|-------|------|-------|
| `/api/promotions` | Authenticated only | Not public |
| `/promotions` | Middleware auth | Not public |
| Promotion assets | Signed URLs via service role | 300s expiry — **Mitigated** |

---

## Broad authenticated RLS policies

| Policy | Concern | Classification |
|--------|---------|----------------|
| `promotions_select_published_active` | Any logged-in user sees all active promos | **Replace before removal** |
| Adviser promotion SELECT all rows | Expected for management | Low once retired |

---

## Service-role use

| Path | Pattern | Classification |
|------|---------|----------------|
| Adviser promotion CRUD | Service role bypasses RLS | **Actively required** today; standard AEGIS pattern |
| Client promotion list | User session + RLS | Appropriate |
| Signed URL generation | Service role | **Actively required** |
| Migration | Service role | **Actively required** |

**Finding:** Service-role use is intentional; authorization must remain in route guards (present for adviser routes).

---

## Arbitrary recipient / audience input

| Path | Validation | Classification |
|------|------------|----------------|
| Legacy promotions | `audience` fixed to `all_users` only | No arbitrary input — but over-broad |
| Governed content | `validateTargetClientIds`, audience scopes | **Mitigated** |

---

## Scheduled job authorization

| Job | Promotions? | Authorization |
|-----|-------------|---------------|
| `scheduledContentEligibility` | No | Re-validates approval, author≠approver, feature flags |
| Promotion date window | Client RLS only | No job |

---

## Stale signed URLs

| Finding | Classification |
|---------|----------------|
| `PROMOTION_SIGNED_URL_EXPIRY_SECONDS = 300` | **Mitigated** |
| URLs not stored in DB — generated per request | **Mitigated** |

---

## Unreviewed publication paths

| Path | Review required? | Classification |
|------|------------------|----------------|
| Governed content publish | Admin approval | **Mitigated** |
| Planning outputs | Adviser review | **By design** |
| Binder publish | Adviser confirm + flag | **By design** |
| Legacy promotion publish | **None** | **Confirmed gap — High** |

---

## Confirmed gaps summary

| ID | Gap | Severity | Action phase |
|----|-----|----------|--------------|
| SEC-9F4-01 | Legacy promotion publish without compliance approval | High | Stage 2 write freeze |
| SEC-9F4-02 | Client API `/api/promotions` without entitlement gate | Medium | Stage 4 route removal |
| SEC-9F4-03 | Firm-wide promotion visibility via RLS | Medium | Stage 4 + optional RLS tighten |
| SEC-9F4-04 | Adviser edit any promotion (no ownership) | Medium | Stage 2–4 |
| SEC-9F4-05 | No admin UI for migration API | Low | Operator runbook |

**No broad security changes implemented in this checkpoint** per scope.
