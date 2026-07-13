# CRM V2 Phase 07 — Security Review

**Scope:** Protection policies, versions, extractions, domain events, adviser portfolio APIs, client protection APIs, work queue adapters.

---

## 1. Threat table

| Threat | Control | Residual risk |
|--------|---------|---------------|
| IDOR — cross-adviser policy access | `resolveAccessibleClient`, `is_assigned_advisor` RLS | Low |
| IDOR — cross-client policy access | Client session `client.id` match on policy `client_id` | Low |
| IDOR — extraction by UUID | Load row then assignment check on `client_id` | Low |
| Forged relationshipId | Assignment resolution → 404/403 | Low |
| Browser-supplied clientId | `rejectUnexpectedFields` + `rejectClientId` | None |
| Browser-supplied adviserUserId | Rejected on all protection POST bodies | None |
| Feature flag bypass | `assertCrmV2ProtectionPortfolioAccess` fail closed | Low |
| Client confirms extraction | No client confirm route; `assertClientCannotVerify` | None |
| Client sees provisional data | API filters confirmed/corrected only | None |
| Stale concurrent confirm | `expectedVersion` → 409 | Low |
| Invalid state transition | `validateVerificationTransition` before write | None |
| Queue adapter mutation | Read-only `load()` — no complete handler | None |
| Document path leak | No paths in DTOs | Low |
| Full policy number leak | `maskPolicyNumber` at ingress | Low — adviser could type full number in correct fields; re-masked |
| Silent dedup merge | Candidates only — adviser `matchPolicyId` required | None |
| Admin overreach | `is_admin()` in RLS; APIs still use assignment checks for advisors | Low |
| Rate limit abuse | `writeHeavy` on POST | Medium |
| SQL injection | Parameterised Supabase client | Low |
| XSS in text fields | `sanitizeText` strips HTML | Low |

---

## 2. Feature gates

| Surface | Required flags |
|---------|----------------|
| `/advisor-v2/relationships/[id]/protection` | `crm_v2_master`, `crm_v2_pilot_mode`, pilot allowlist, `crm_v2_protection_portfolio` |
| `/api/advisor-v2/protection/**` | Same |
| `/api/advisor-v2/relationships/[id]/protection/**` | Same |
| `/protection` client UI | `crm_v2_protection_portfolio` enabled + `client_visible` |
| `/api/protection` GET | Same |
| `/api/protection/**` correction/review POST | Above + `crm_v2_client_service` |

Master enabled without pilot does **not** grant adviser access.

---

## 3. Assignment model

- `protection_policies.adviser_user_id` set from client relationship on create
- `protection_extractions.adviser_user_id` copied from client row on create
- Adviser role queries scoped via `resolveAccessibleClient`
- Admin role per existing platform pattern
- No household-ID as access proof

---

## 4. RLS summary

Tables: `protection_policies`, `protection_policy_versions`, `protection_extractions`, `protection_domain_events`

Policy pattern (all tables):

```sql
FOR ALL
USING (is_assigned_advisor(client_id) OR is_admin())
WITH CHECK (is_assigned_advisor(client_id) OR is_admin())
```

Versions table policy subqueries parent policy for `client_id` join.

Client portal uses service-role API layer with explicit `client_id` match — authenticated client JWT does not query protection tables directly.

---

## 5. IDOR test list

Execute on staging with two advisers (A, B) and two clients (C1 assigned to A, C2 assigned to B).

### 5.1 Adviser portfolio

| # | Test | Expected |
|---|------|----------|
| 1 | A GET `/api/advisor-v2/relationships/C2/protection` | 403 or 404 |
| 2 | B GET `/api/advisor-v2/relationships/C1/protection` | 403 or 404 |
| 3 | A GET own C1 portfolio | 200 |
| 4 | Unauthenticated GET adviser portfolio | 401 |

### 5.2 Extraction detail and mutations

| # | Test | Expected |
|---|------|----------|
| 5 | A GET extraction belonging to C2 | 404 |
| 6 | B POST confirm on C1 extraction | 403/404 |
| 7 | A POST confirm on own extraction with wrong `expectedVersion` | 409 |
| 8 | A POST reject on already rejected | 400 |

### 5.3 Policy detail

| # | Test | Expected |
|---|------|----------|
| 9 | B GET `/api/advisor-v2/protection/policies/{C1-policyId}` | 404 |
| 10 | A GET own policy | 200 |
| 11 | B GET versions for C1 policy | 404 |

### 5.4 Client APIs

| # | Test | Expected |
|---|------|----------|
| 12 | C1 GET `/api/protection` | 200 (if enabled) |
| 13 | C1 GET `/api/protection/{C2-policyId}` | 404 |
| 14 | Client session hit adviser extraction API | 403 |
| 15 | C1 GET unconfirmed policy detail | 404 |

### 5.5 Service request bridge

| # | Test | Expected |
|---|------|----------|
| 16 | C1 POST correction for C2 policyId | 404 |
| 17 | C1 POST correction without client service flag | 403 |
| 18 | C1 POST correction with `clientId` in body | 400 |

### 5.6 Feature flag

| # | Test | Expected |
|---|------|----------|
| 19 | All protection APIs with flag disabled | 403 |
| 20 | Client GET with `client_visible=false` | 403 |
| 21 | Legacy vault save with flag disabled | 200 (unchanged) |

### 5.7 Enumeration

| # | Test | Expected |
|---|------|----------|
| 22 | Random UUID policy GET as adviser | 404 not 403 differential |
| 23 | Random UUID extraction confirm | 404 |

### 5.8 Work queue

| # | Test | Expected |
|---|------|----------|
| 24 | A queue load contains only A book extractions | Pass |
| 25 | Queue complete endpoint for protection source | N/A — not supported |

### 5.9 Field injection

| # | Test | Expected |
|---|------|----------|
| 26 | POST confirm with `clientId` field | 400 |
| 27 | POST confirm with `adviserUserId` field | 400 |
| 28 | POST extractions with HTML in report strings | Stripped/saved sanitised |

### 5.10 Concurrency

| # | Test | Expected |
|---|------|----------|
| 29 | Double confirm same extraction same version | Second idempotent 200 |
| 30 | Concurrent confirm with staggered versions | One 409 |

---

## 6. Prohibited (confirmed absent)

- OCR pipeline writing to protection tables
- Insurer API credentials in codebase
- Client confirm/correct API
- `CREATE TABLE documents` in Phase 07 migration
- Generic `advisor_work_items` table
- Remote `enabled = true` in migration SQL
- Email/SMS/WhatsApp from protection events
- Queue adapter direct policy UPDATE

---

## 7. Audit and forensics

- `protection_domain_events` append-only — no UPDATE policy
- `writeAuditLog` for extraction batch creation
- Vault save retains separate audit action
- Service requests retain Phase 06 event history for corrections

---

## 8. Residual operator actions

- Apply migrations only after Gate G8
- Enable `crm_v2_protection_portfolio` after staging IDOR suite passes
- Pilot single adviser before book-wide enable
- Run `npm run security:advisor-access` after deploy

---

## 9. Automated security scripts

| Script | Relevance |
|--------|-----------|
| `npm run security:advisor-access` | Assignment model |
| `npm run security:api` | Route guard patterns |
| `npm run security:service-role` | Admin client usage |
| `npm run qa:crm-v2-protection` | Structural checks |

---

## 10. Cross-references

- Manual tests: `docs/CRM_V2_PHASE_07_MANUAL_TESTS.md`
- Privacy: `docs/CRM_V2_PHASE_07_VISIBILITY_AND_PRIVACY.md`
- Migration: `docs/CRM_V2_PHASE_07_MIGRATION_RUNBOOK.md`
