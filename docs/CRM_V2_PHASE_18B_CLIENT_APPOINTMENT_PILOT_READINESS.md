# CRM V2 Phase 18B — Client Appointment Pilot Readiness

**Type:** Validation, operational readiness, and evidence preparation  
**Branch:** `phase18b-client-appointment-pilot-readiness`  
**Baseline commit:** `263ecc2f5614077197b9a01620389302d890bb2c`  
**Phase 18A tag:** `crm-v2-phase18a-client-appointment-request-ready`  
**Status:** Repository preparation complete — operator staging pilot **not** executed in this phase  

---

## Objective

Prepare and validate the existing Phase 18A client appointment request implementation for **one** controlled staging client appointment pilot.

This phase does **not** claim staging passed, production passed, or that a real client completed the flow.

---

## Verified baseline

See [CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_BASELINE_AUDIT.md](./CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_BASELINE_AUDIT.md).

| Check | Result |
|-------|--------|
| `main` == `origin/main` at `263ecc2` | Pass |
| Phase 18A tag present | Pass |
| Working tree clean at start | Pass |
| No prior Phase 18B work | Pass |
| No unrelated uncommitted changes | Pass |

---

## Architecture findings

| Topic | Finding |
|-------|---------|
| Canonical authority | `adviser_appointments` (unchanged) |
| Client create | `source = client_booking`, `crm_lifecycle_status = requested` |
| Client identity | Session via `assertCrmV2ClientAppointmentsAccess` → `access.client.id` |
| Adviser assignment | `access.client.advisor_user_id`; missing → 400, no insert |
| Forged IDs | Rejected on POST (`clientId`, `adviserId`, etc.) |
| Idempotency | `idempotency_key` lookup before insert |
| Adviser intake | `/advisor/workspace/appointments?view=requests` filters `requested` (+ proposed / awaiting_confirmation) |
| Adviser detail | Same id via `resolveAuthorizedAppointment` |
| Cross-adviser | `adviser_user_id !== authUserId` → `not_found` |
| Cross-client | Client load `.eq("client_id", clientId)` |
| Client DTO | Checklist `visibility` ∈ `client`/`shared` only; no adviser agenda in client service |
| Supported adviser action from `requested` | UI: **confirm**, **cancel** (`proposed`/`awaiting_confirmation` allowed in lifecycle matrix but not exposed as buttons) |
| Today | No dedicated `requested` card — accepted limitation |
| Frozen modules | Untouched |
| Phase 9F.4 | Untouched |

---

## Local automated results

Executed on 2026-07-20 from repository root (current Phase 18B branch after docs/script add). Re-run after any further edits.

| Command | Result |
|---------|--------|
| `npm run final:check` | **7/7 passed** |
| `npm run qa:crm-v2-pilot-readiness` | **382/382 passed** |
| `npm run qa:crm-v2-shell` | **174/174 passed** |
| `npm run qa:crm-v2-today` | **451/451 passed** |
| `npm run qa:adviser-workspace-regression` | **72/72 passed** |
| `npm run qa:client-appointment-request` | **33/33 passed** |
| `npx tsc --noEmit` | **passed** (exit 0) |
| `npm run qa:client-appointment-pilot-readiness` | **31/31 passed** |

Failures related to Phase 18B: **none**.

These results are **local repository checks only**. They do not substitute for staging operator evidence.

---

## Notification findings

| Item | Detail |
|------|--------|
| Call site | `createClientAppointmentRequest` after insert |
| Recipient | Requesting client (`client_id`) |
| Type | `appointment_changed` |
| Copy | Title: "Appointment request received"; Summary: "Your appointment request was submitted." |
| Reference | `appointment` + appointment id |
| Adviser notification | **None** — rely on Client requests view |
| Shared transaction with insert | **No** |
| Failure blocks create | **No** (`.catch(() => undefined)`) |
| Retry duplicates | Mitigated by `dbCreateClientNotification` lookup on client + type + reference |
| UI destination | **None** for `appointment` reference — `ClientNotificationsPanel` does not map to `/appointments` (accepted limitation; text still showable on Insights notifications panel) |

Not treated as a blocking defect: client can open Appointments nav; link absence is not unsafe.

---

## Audit findings

| Item | Detail |
|------|--------|
| Action | `crm_client_appointment_requested` |
| Actor | Client user id |
| Entity | `adviser_appointments` / appointment id |
| Metadata | `{ appointment_type }` |
| Sensitive logging | Not observed beyond type |
| Failure | `writeAuditLog` never throws to client |

---

## Calendar boundary findings

| Path | Auto Google Calendar? |
|------|----------------------|
| Client POST `/api/appointments` | **No** |
| `createClientAppointmentRequest` | **No** google-calendar imports/calls |
| Adviser confirm transition | Does not auto-sync (manual Sync route remains explicit) |

Keep `crm_v2_google_calendar` disabled for this pilot unless a separate manual sync test is approved.

---

## External communication findings

Client request create path: **no** email, SMS, WhatsApp, or governed communication publication.

In-app notification only (see above).

---

## Feature-control requirements

### Client access

- `crm_v2_master` enabled  
- `crm_v2_appointments_client` enabled **and** `client_visible`  

### Adviser access

- `crm_v2_master` enabled  
- `crm_v2_pilot_mode` enabled  
- `CRM_V2_PILOT_USER_IDS` includes pilot adviser  
- `crm_v2_appointments_adviser` enabled  

### Supporting workspace (recommended for intake)

- `crm_v2_relationships`, `crm_v2_today`, `adviser_work_queue`, `crm_v2_reports`, `crm_v2_operations`  

### Keep disabled

- `crm_v2_client_service`, `crm_v2_protection_portfolio`, `crm_v2_client_profile`, `crm_v2_advocacy`, `crm_v2_communications`, `crm_v2_google_calendar`  

Operator SQL: see runbook §3. **Not executed** in this phase.

---

## Test-account requirements

### Pilot adviser

- Authenticated adviser  
- In `CRM_V2_PILOT_USER_IDS`  
- Can open `/advisor/workspace/appointments`  
- Assigned to pilot client  

### Pilot client

- Authenticated client  
- Valid client profile  
- Non-null `advisor_user_id` pointing at pilot adviser  
- No need for real financial data  
- No reliance on frozen modules  

Accounts **not** created in this phase.

---

## Manual checks outstanding

All operator/staging steps in [CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_RUNBOOK.md](./CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_RUNBOOK.md) remain **INCOMPLETE**, including:

- Feature flag enablement on staging  
- Allowlist / assignment verification  
- Real client submit → adviser confirm → client update  
- Notification / audit / IDOR / calendar / rollback evidence  

Evidence template: [CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_EVIDENCE_TEMPLATE.md](./CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_EVIDENCE_TEMPLATE.md).

---

## Accepted limitations

1. No complete real client↔adviser cycle evidenced yet (by design of this phase).  
2. `/advisor/today` does not dedicate a card for `requested`.  
3. Advisers monitor **Appointments → Client requests**.  
4. Client Appointments nav may remain visible when feature unavailable (safe empty state).  
5. In-app notification has **no** deep-link to `/appointments/[id]`.  
6. Propose/awaiting_confirmation transitions exist in lifecycle matrix but are not UI buttons from `requested`.  
7. Other client CRM V2 modules remain frozen.  

---

## Blocking defects

**None** found in repository inspection that require application-code changes before operator staging pilot.

Optional UX improvement (notification → `/appointments/...`) deferred — not a safety blocker.

---

## Rollback

Non-destructive:

```sql
UPDATE platform_feature_controls
SET enabled = false, client_visible = false, updated_at = now()
WHERE feature_key = 'crm_v2_appointments_client';
```

Appointment rows are retained. No data deletion required.

---

## Application code / migrations / env

| Category | This phase |
|----------|------------|
| Application code changes | **None** |
| Migrations proposed | **None** |
| Migrations applied | **None** |
| `.env` / Vercel changes | **None** |
| Feature flags executed | **None** |

---

## Final readiness decision

**READY FOR OPERATOR STAGING PILOT**

Meaning:

- Repository baseline and Phase 18A integrity verified  
- Automated local gates pass  
- Flow, privacy, calendar, and communication boundaries verified in code  
- Runbook + evidence template ready  
- **Operator must still execute staging steps and fill evidence** before claiming the pilot passed  

Not claimed: staging passed, production passed, real-client completion, remote flag enablement, observed live notifications, or remote rollback.
