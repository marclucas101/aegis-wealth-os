# CRM V2 Phase 08 — Security Review

**Scope:** `relationship_moments`, `crm_review_rhythm`, `crm_client_preference_updates`, `adviser_moment_overrides`, `relationship_moment_events`, adviser/client APIs, work queue adapters.

---

## 1. Threat table

| Threat | Control | Residual risk |
|--------|---------|---------------|
| IDOR — cross-adviser moment access | `resolveAccessibleClient` + RLS `is_assigned_advisor(client_id)` | Low |
| IDOR — cross-client preference read | Client session `client.id` match only | Low |
| Forged `relationshipId` | Assignment resolution → 404/403 | Low |
| Browser-supplied `clientId` | Resolved server-side from session/route | None |
| Feature flag bypass | `assertCrmV2RelationshipMomentsAccess` / `assertCrmV2ClientProfileAccess` fail closed | Low |
| Client accesses adviser CRM | Separate gates; client profile ≠ master gate | None |
| Ethnicity → queue priority | Fixed `priority: "normal"`; `assertEthnicityUseAllowed` | None |
| Auto festive outreach | Suggestions only; confirm required | None |
| Stale concurrent moment update | `expectedVersion` → 409 | Low |
| Queue adapter mutation | Read-only `load()` — no complete handler | None |
| Timeline ethnicity leak | Projection excludes ethnicity fields | Low |
| Notification PII leak | Truncated generic text; no ethnicity | Low |
| SQL injection | Parameterised Supabase client | Low |
| XSS in moment title | `sanitizeTitle` trim + length cap | Low |
| Admin overreach | `is_admin()` in RLS; APIs use assignment for advisers | Low |
| Rate limit abuse | Existing platform middleware on API routes | Medium |

---

## 2. Feature gates (fail-closed)

### Adviser moments

```text
requireAdvisorAccess()
  → crm_v2_master.enabled
  → crm_v2_pilot_mode.enabled
  → CRM_V2_PILOT_USER_IDS non-empty allowlist
  → auth user in allowlist
  → crm_v2_relationship_moments.enabled
```

Disabled at any step → 403 `feature_disabled` / `pilot_not_eligible` — **no workspace data loaded**.

### Client profile

```text
ensureUserClientProfile()
  → role === client
  → crm_v2_client_profile.enabled AND client_visible
```

Does not bypass adviser gates. Enabling client profile alone does not expose `/advisor-v2`.

---

## 3. Assignment model

- `relationship_moments.adviser_user_id` set from authenticated adviser on create
- `crm_review_rhythm.assigned_adviser_user_id` set on lazy create
- `crm_client_preference_updates.adviser_user_id` from `client.advisor_user_id`
- All queries scoped by `client_id` after assignment resolution
- No household-ID as access proof (`relationshipId === clients.id`)

---

## 4. RLS summary

| Table | Policy |
|-------|--------|
| `relationship_moments` | `is_assigned_advisor(client_id) OR is_admin()` |
| `adviser_moment_overrides` | Same |
| `crm_review_rhythm` | Same |
| `crm_client_preference_updates` | Assignment OR client owns row |
| `relationship_moment_events` | SELECT assignment; INSERT assignment OR actor match |
| `festive_holiday_mappings` | SELECT all authenticated |

---

## 5. IDOR test list

Execute on staging with advisers A/B and clients C1 (A), C2 (B).

### 5.1 Adviser moments

| # | Action | Expected |
|---|--------|----------|
| 1 | A GET moments for C1 | 200 |
| 2 | B GET moments for C1 | 403/404 |
| 3 | A PATCH moment on C1 with B's session | 403/404 |
| 4 | A POST moment with random UUID relationshipId | 404 |
| 5 | A GET with flags off | 403 |

### 5.2 Client preferences

| # | Action | Expected |
|---|--------|----------|
| 6 | C1 GET `/api/preferences` | 200 when flag on |
| 7 | C1 GET with flag off | 403 |
| 8 | Adviser GET `/api/preferences` | 403 |
| 9 | C1 PATCH preference for C2 (if forged) | Not possible — session bound |

### 5.3 Review rhythm

| # | Action | Expected |
|---|--------|----------|
| 10 | B PATCH review-rhythm for C1 | 403/404 |
| 11 | Stale `expectedVersion` | 409 |

### 5.4 Cross-domain

| # | Action | Expected |
|---|--------|----------|
| 12 | Client POST adviser acknowledge URL | 403 |
| 13 | Unauthenticated GET moments | 401 |

---

## 6. Concurrency and idempotency

| Operation | Mechanism |
|-----------|-----------|
| Moment update/deactivate | `version` column optimistic lock |
| Moment create | `(client_id, idempotency_key)` unique partial index |
| Preference update | `(client_id, idempotency_key)` pending unique |
| Review request | Service request idempotency (Phase 06) |
| Acknowledge | `isIdempotentAcknowledgement` window |

Stale writes return 409 — no silent overwrite.

---

## 7. Prohibited data flows

| Flow | Status |
|------|--------|
| Ethnicity → work queue priority | **Blocked** |
| Ethnicity → timeline text | **Blocked** |
| Ethnicity → notification body | **Blocked** |
| Moment → automatic email/SMS | **Not implemented** |
| Moment → financial advice engine | **No integration** |
| Queue → moment state mutation | **No handler** |
| GET → database writes | **None** |

---

## 8. Audit and logging

- `relationship_moment_events` — immutable append
- `writeAuditLog` on moment create
- `safe_metadata` — moment type, entity ids only
- Request IDs in `X-Request-Id` — logged without client ethnicity

---

## 9. Residual risks and mitigations

| Risk | Mitigation | Owner |
|------|------------|-------|
| Adviser manually exports ethnicity from UI | Policy/training; no bulk export API in Phase 08 | Operator |
| Lunar festive dates wrong | Adviser sets date on confirm; no false precision | Product |
| `clients.next_review_due` drift from rhythm | Documented; future sync phase | Engineering |
| Client preference pending backlog | Queue adapter + data quality warning | Adviser ops |

---

## 10. Security QA scripts

| Script | Phase 08 coverage |
|--------|-------------------|
| `npm run qa:crm-v2-relationship-moments` | Gates, RLS patterns, sensitivity module, adapter read-only |
| `npm run security:advisor-access` | Assignment helpers |
| `npm run security:api` | Route registration scan |

Manual IDOR scenarios: `docs/CRM_V2_PHASE_08_MANUAL_TESTS.md` items 20–22, 32–33.
