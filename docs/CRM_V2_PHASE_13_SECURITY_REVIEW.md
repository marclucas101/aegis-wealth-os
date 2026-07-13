# CRM V2 Phase 13 — Security Review

**Branch:** `crm-v2-13-pilot-activation`  
**Scope:** Pilot activation readiness — runbooks, diagnostics, QA — no new product code paths

---

## 1. Review summary

Phase 13 adds operator documentation, read-only SQL diagnostics, and repository QA validation. No new access guards, no new business authorities, no feature activation, no production secrets. Existing Phase 01–12 security controls remain authoritative.

**No unresolved security defects identified** in Phase 13 deliverables.

---

## 2. Threat model (pilot activation)

| Threat | Control | Status |
|--------|---------|--------|
| Unauthorized CRM V2 access | `assertCrmV2Access()` master + pilot + allowlist | Existing — pass |
| Allowlist bypass via browser | Server-only `pilotConfig.ts` | Existing — pass |
| Client gains adviser CRM | Separate client gates; role check | Existing — pass |
| Premature client-visible exposure | Activation order + data safety doc | Phase 13 — pass |
| Production accidental enable | All defaults false; runbook staging-only | Phase 13 — pass |
| Secrets in runbooks | No production secrets documented | Phase 13 — pass |
| Destructive rollback | Prohibited in rollback runbook | Phase 13 — pass |
| Pilot allowlist disclosure | Generic denial messages | Existing — pass |
| SQL diagnostics mutation | Read-only SELECT only | Phase 13 — pass |
| Promotions Stage 6 | `legacy_promotions_write` stays false | Existing — pass |

---

## 3. Control inventory

### Feature control

| Control | Implementation |
|---------|----------------|
| Fail-closed defaults | `FEATURE_DEFAULTS` all CRM V2 `enabled: false` |
| No enable in migrations | All seeds `enabled = false` |
| Admin-only toggle | `PATCH /api/admin/feature-controls` |
| Dependency diagnostics | Phase 13 discrepancy SQL |

### Pilot gating

| Control | Implementation |
|---------|----------------|
| Env allowlist | `CRM_V2_PILOT_USER_IDS` |
| Parse fail-closed | Missing/empty/malformed → deny all |
| No client pilot path | Clients use client-specific gates |

### Documentation safety

| Control | Implementation |
|---------|----------------|
| No real UUIDs in repo | Manual tests use placeholders |
| Staging-only activation | Staging runbook explicit |
| Rollback preserves data | No DELETE guidance |

---

## 4. Client-visible module risks

| Module | Risk | Mitigation |
|--------|------|------------|
| `crm_v2_appointments_client` | Client sees appointment data | Test clients only; one-at-a-time enable |
| `crm_v2_client_service` | Client creates service requests | Staging data only |
| `crm_v2_protection_portfolio` | Policy summary exposure | Confirmed policies only in projection |
| `crm_v2_advocacy` | Consent/preferences | No testimonial publication without consent |
| `crm_v2_communications` | Message surface | No external send in pilot smoke tests |
| `crm_v2_client_profile` | Ethnicity data | Festive-only rules; no targeting |

---

## 5. Residual risks

| Risk | Severity | Owner |
|------|----------|-------|
| Operator enables client flags on production without staging sign-off | High | Operator go/no-go |
| Staging OAuth misconfiguration leaks calendar events | Medium | Operator — staging OAuth only |
| Pending migrations not applied before pilot | Medium | Operator migration runbooks |
| Manual tests not executed | Medium | Operator acceptance |

---

## 6. Security scripts (repository)

| Script | Phase 13 relevance |
|--------|-------------------|
| `npm run security:api` | API auth patterns |
| `npm run security:advisor-access` | Adviser route guards |
| `npm run security:service-role` | No service role in client paths |

All must pass before staging pilot.

---

## 7. Prohibited in Phase 13

- Production feature activation
- Production secrets in repository
- External email/SMS/WhatsApp sends from smoke tests
- Destructive rollback SQL
- New business authority tables
- Promotions Stage 6
- Campaign automation

---

## 8. Sign-off

| Role | Status |
|------|--------|
| Engineering (Phase 13 deliverables) | Complete |
| Operator staging pilot | Pending |
| Operator production go/no-go | Pending — Phase 13 prepares checklist only |
