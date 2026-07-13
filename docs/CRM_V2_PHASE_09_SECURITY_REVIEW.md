# CRM V2 Phase 09 — Security Review

**Scope:** `advocacy_events`, `crm_client_advocacy_preferences`, `advocacy_score_config`, `advocacy_domain_events`, adviser/client APIs, work-queue `advocacyEventAdapter`.

---

## 1. Threat table

| Threat | Control | Residual risk |
|--------|---------|---------------|
| IDOR — cross-adviser advocacy access | `resolveAccessibleClient` + RLS `is_assigned_advisor(client_id)` | Low |
| IDOR — eventId from other client | Query filters `client_id` + `relationshipId` match | Low |
| IDOR — cross-client preference read | Client session `client.id` only | Low |
| Forged `relationshipId` | Assignment resolution → 404/403 | Low |
| Browser-supplied `clientId` | Server resolves from session/route | None |
| Feature flag bypass | `assertCrmV2AdvocacyAccess` / `assertCrmV2ClientAdvocacyAccess` fail closed | Low |
| Client accesses adviser workspace | Separate gates; client lacks master/pilot | None |
| Score → queue priority | Fixed `priority: normal`; `assertAdvocacyScoreNotUsedForPriority` | None |
| Score in client DTO | Client API returns preferences only | None |
| Stale concurrent update | `expectedVersion` → 409 | Low |
| Queue adapter mutation | Read-only `load()` — no complete handler | None |
| Consent bypass after withdraw | `validateConsentTransition` blocks withdrawn→granted | Low |
| Do-not-ask bypass | Server rejects `introduction_offered` when `do_not_ask` | Low |
| SQL injection | Parameterised Supabase client | Low |
| XSS in safe_title | `sanitizeTitle` trim + length cap | Low |
| Promotions reactivation | No Phase 09 writes to `promotions`; `legacy_promotions_write` stays false | Low |
| Admin overreach | `is_admin()` in RLS; adviser APIs use assignment | Low |
| Rate limit abuse | Platform middleware on API routes | Medium |

---

## 2. Feature gates (fail-closed)

### Adviser advocacy

```text
requireAdvisorAccess()
  → crm_v2_master.enabled
  → crm_v2_pilot_mode.enabled
  → CRM_V2_PILOT_USER_IDS non-empty allowlist
  → auth user in allowlist
  → crm_v2_advocacy.enabled
```

Disabled at any step → 403 — **no advocacy workspace data loaded**.

### Client advocacy preferences

```text
ensureUserClientProfile()
  → role === client
  → crm_v2_advocacy.enabled AND client_visible
```

Does not grant `/advisor-v2` access. Single key `crm_v2_advocacy` — no `crm_v2_client_advocacy`.

---

## 3. Assignment model

- `advocacy_events.adviser_user_id` set from `client.advisor_user_id` or authenticated adviser on create
- All adviser queries scoped by `client_id` after `resolveAccessibleClient`
- `relationshipId === clients.id` — no household-ID proof
- Work queue filters `advocacy_events` by book `clientIds` and adviser assignment

---

## 4. RLS summary

| Table | Policy |
|-------|--------|
| `advocacy_events` | `is_assigned_advisor(client_id) OR is_admin()` ALL |
| `advocacy_score_config` | SELECT all authenticated |
| `crm_client_advocacy_preferences` | Assignment OR admin OR owning client |
| `advocacy_domain_events` | SELECT assignment/admin; INSERT assignment/admin/client own |

---

## 5. IDOR test list

| # | Test | Expected |
|---|------|----------|
| 1 | Adviser A GET workspace for Adviser B client | 403/404 |
| 2 | Adviser A PATCH event on B client with guessed eventId | 404 |
| 3 | Client A GET preferences | 200 own data only |
| 4 | Client A cannot GET adviser advocacy workspace | 403 |
| 5 | Unauthenticated GET advocacy | 401 |
| 6 | Feature disabled GET advocacy | 403, no data leak |

---

## 6. Promotions Stage 6 — explicit non-scope

Phase 09 security posture **requires**:

| Item | Status |
|------|--------|
| Promotions Stage 6 DROP | **Not in Phase 09 migrations** |
| `legacy_promotions_write` | Remains **false** |
| Phase 9F.4 observation | **Continues** per `PHASE_9F4_OBSERVATION_PLAN.md` |
| Advocacy → promotions writes | **None** |
| Campaign automation | **None** |
| Sales ranking APIs | **None** |

---

## 7. Score abuse prevention

| Vector | Mitigation |
|--------|------------|
| Client infers score from API | Score excluded from all client routes |
| Adviser sorts book by score | No list API exposes score |
| Queue prioritization | Adapter hardcodes `normal` |
| Automated outreach from high score | No automation tables |

---

## 8. Consent security

- Withdrawal requires authenticated client session
- `expectedVersion` prevents silent overwrites
- Domain events append-only — tamper-evident history
- Notifications contain truncated generic text — no PII

---

## 9. Dependency on Phase 9F.4

CRM V2 Phase 09 does not shorten or bypass Promotions observation. Operator must confirm 9F.4 monitoring remains active before production advocacy pilot.

---

## 10. Residual risks and mitigations

| Risk | Mitigation |
|------|------------|
| Adviser enters PII in `referred_person_label` | Training; bounded field; adviser-only visibility |
| High event volume | `CRM_V2_ADVOCACY_MAX_ITEMS` bound |
| Config tampering | Score config RLS read-only for advisers; operator-only writes |

---

## 11. Security sign-off checklist

- [ ] IDOR tests executed on staging
- [ ] Feature-off returns 403 with empty body
- [ ] Client DTO inspected — no score fields
- [ ] Queue response inspected — `priority: normal` for advocacy items
- [ ] Migration grep — no `DROP TABLE promotions`
- [ ] 9F.4 observation plan still active
