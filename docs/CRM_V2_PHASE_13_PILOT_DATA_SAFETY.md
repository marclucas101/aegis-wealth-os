# CRM V2 Phase 13 — Pilot Data Safety

**Branch:** `crm-v2-13-pilot-activation`  
**Audience:** Operators running staging pilot

---

## 1. Core rules

| Rule | Rationale |
|------|-----------|
| Use staging or dedicated test clients first | Prevents real client data exposure during smoke tests |
| Do not use real client sensitive data for initial smoke tests | PII, financial details, health data |
| Avoid production Google accounts for first OAuth test | Calendar sync risk |
| No external sends | Email, SMS, WhatsApp must not reach real recipients |
| Manual observation required | Automated QA does not replace operator eyes on client-visible modules |
| Rollback does not delete pilot-created records | Data retained for audit; flags stop new access |

---

## 2. Test client selection

| Criterion | Requirement |
|-----------|-------------|
| Client account | Staging-only or synthetic test client |
| Assignment | Assigned to pilot adviser only |
| Sensitive data | Minimal — fake names acceptable |
| Real phone/email | Avoid for communications module tests |
| Document uploads | Test files only; no real identity documents |

---

## 3. Adviser test book

| Criterion | Requirement |
|-----------|-------------|
| Pilot adviser | Single UUID in `CRM_V2_PILOT_USER_IDS` initially |
| Book size | Small — 1–3 test relationships |
| Non-pilot advisers | Must remain blocked throughout pilot |
| Cross-adviser test | Use second test adviser **not** in allowlist to verify denial |

---

## 4. Module-specific cautions

### Client-visible modules

| Module | Caution |
|--------|---------|
| `crm_v2_appointments_client` | Client sees appointment details — test client only |
| `crm_v2_client_service` | Service requests create real rows — use test descriptions |
| `crm_v2_protection_portfolio` | Policy summaries — no real policy numbers in test |
| `crm_v2_client_profile` | Ethnicity/preferences — test data only; never use for targeting |
| `crm_v2_advocacy` | Consent states — no real testimonial publication |
| `crm_v2_communications` | **No send** — drafts only unless explicit governed send test approved |

### Google Calendar

- Staging OAuth app only
- Test calendar — not adviser's production calendar
- Disable flag before revoking OAuth if issues occur

### Communications

- Draft creation allowed on staging with test content
- **Do not** trigger external delivery pipelines
- `legacy_promotions_write` must remain false

---

## 5. No external sending

During Phase 13 pilot preparation and initial staging pilot:

| Channel | Rule |
|---------|------|
| Email | No production SMTP sends to real addresses |
| SMS | Disabled unless staging sandbox confirmed |
| WhatsApp | Disabled unless staging sandbox confirmed |
| Push notifications | Test device only |
| Google Calendar API | Staging OAuth only when flag enabled |

---

## 6. Manual observation requirements

Operator must visually confirm:

| Observation | When |
|-------------|------|
| Client sees only own data | Each client-visible module enable |
| Adviser sees only assigned book | Relationships, appointments, service |
| Denied users see generic message | No allowlist leakage |
| Legacy `/advisor` unchanged | After every activation step |
| No advocacy score in client UI | Advocacy module |
| No ethnicity in reports | Reports module |

---

## 7. Data retention after pilot

| Data | Retention |
|------|-----------|
| Pilot test appointments | Retained in staging DB |
| Pilot test service requests | Retained |
| Pilot test advocacy events | Retained |
| Feature-control change history | Retained via `updated_at` |
| Operator logs | Retain per compliance policy |

**Disabling flags does not delete pilot data.** Rollback does not delete pilot-created records.

To clean staging test data, use a separate approved data hygiene process — not rollback.

---

## 8. Production data prohibition

| Action | Prohibited in Phase 13 |
|--------|------------------------|
| Enable flags on production | Yes |
| Point staging pilot at production DB | Yes |
| Copy production client export to staging without redaction | Yes |
| Use production secrets in staging | Yes |

---

## 9. Incident response

If real client data was exposed during pilot:

1. Disable `crm_v2_master` immediately
2. Disable relevant client-visible flag
3. Document scope in operator incident log
4. Escalate per `CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md` §9
5. Do not delete records — preserve for investigation

---

## 10. Checklist before first client-visible enable

| # | Check |
|---|-------|
| 1 | Test client account confirmed staging-only |
| 2 | Pilot adviser is only user in allowlist |
| 3 | Communications external send paths disabled or sandboxed |
| 4 | Rollback runbook accessible |
| 5 | Master manual acceptance row ready for evidence link |
