# CRM V2 Phase 18A — Client Appointment Request Reintroduction

**Type:** Limited client-facing reintroduction — appointment requests only  
**Status:** Ready for controlled pilot after QA passes  
**Verdict:** This is **appointment request reintroduction only**, not full client portal rollout.

---

## Objective

Reintroduce the first client-facing CRM V2 module in a controlled way: **client appointment requests**.

- Clients can request appointments safely.
- Advisers see and manage those requests from `/advisor/workspace/appointments`.
- No automatic outreach, Google Calendar events, or calendar invites.
- All other client-facing CRM V2 modules remain frozen.

**Not in scope:** full client portal launch, schema changes, messaging launch, Google Calendar launch, protection portfolio launch.

---

## Scope

### In scope

| Area | Detail |
|------|--------|
| Client routes | `/appointments`, `/appointments/request`, `/appointments/[id]` |
| Adviser routes | `/advisor/workspace/appointments` (Requests view + detail) |
| Feature gating | `crm_v2_master` + `crm_v2_appointments_client` (+ adviser flags) |
| UX polish | Client-friendly copy; adviser request callouts |
| QA | `npm run qa:client-appointment-request` |

### Out of scope

- `/actions`, `/requests`, `/protection`, `/preferences`, `/messages`
- Automatic emails, SMS, WhatsApp
- Google Calendar auto-sync
- Schema migrations
- `.env` changes in this phase

---

## Routes involved

### Client

```
/appointments              — list + link to request
/appointments/request      — submit one appointment request
/appointments/[id]         — view own appointment / request status
```

### Adviser

```
/advisor/workspace/appointments?view=requests   — client requests queue
/advisor/workspace/appointments/[id]            — manage single request
/advisor/today                                  — projection only (limited request surfacing)
/advisor/relationships/[id]                     — next appointment summary
/advisor/classic                                — fallback preserved
```

---

## Flags to enable

Enable **only** these for Phase 18A appointment request pilot:

```sql
-- Operator SQL (staging) — enable adviser + client appointment flow only
UPDATE platform_feature_controls
SET enabled = true, updated_at = now()
WHERE feature_key IN (
  'crm_v2_master',
  'crm_v2_pilot_mode',
  'crm_v2_relationships',
  'crm_v2_today',
  'adviser_work_queue',
  'crm_v2_appointments_adviser',
  'crm_v2_reports',
  'crm_v2_operations'
);

UPDATE platform_feature_controls
SET enabled = true, client_visible = true, updated_at = now()
WHERE feature_key = 'crm_v2_appointments_client';
```

Also required (not a DB flag):

- `CRM_V2_PILOT_USER_IDS` in server env with pilot adviser UUID(s)
- Server restart after env change

Verify:

```sql
SELECT feature_key, enabled, client_visible, adviser_visible
FROM platform_feature_controls
WHERE feature_key LIKE 'crm_v2_%'
   OR feature_key = 'adviser_work_queue'
ORDER BY feature_key;
```

---

## Flags to keep disabled

```sql
-- Confirm these remain off unless explicitly approved for a later phase
SELECT feature_key, enabled, client_visible
FROM platform_feature_controls
WHERE feature_key IN (
  'crm_v2_client_service',
  'crm_v2_protection_portfolio',
  'crm_v2_client_profile',
  'crm_v2_advocacy',
  'crm_v2_communications',
  'crm_v2_google_calendar'
);
```

| Flag | Reason to keep off |
|------|-------------------|
| `crm_v2_client_service` | `/actions`, `/requests` frozen |
| `crm_v2_protection_portfolio` | `/protection` frozen |
| `crm_v2_client_profile` | `/preferences` frozen |
| `crm_v2_advocacy` | `/preferences/advocacy` frozen |
| `crm_v2_communications` | `/messages` frozen |
| `crm_v2_google_calendar` | Manual sync only; disable unless explicitly testing adviser manual sync |

---

## Client test script

Use after flags enabled and one pilot client assigned to pilot adviser.

1. Log in as pilot client (existing secure login).
2. Open **Appointments** from menu → `/appointments`.
3. Confirm page loads (not "unavailable").
4. Click **Request an appointment** → `/appointments/request`.
5. Fill in:
   - What you would like to discuss
   - Preferred date/time (future)
   - Optional topics
6. Submit once — see **Request received** confirmation (no raw ID shown).
7. Confirm copy states adviser will follow up — **not** a confirmed appointment.
8. Open **Appointments** again — request appears with "awaiting adviser review" style label.
9. Open request details — confirm no adviser agenda, internal notes, or other clients' data.
10. Confirm no unexpected email, SMS, WhatsApp, or calendar invite received.
11. Refresh submit page — do not resubmit; confirm no duplicate if returning to list.

---

## Adviser verification checklist

| # | Check | Expected |
|---|-------|----------|
| A1 | `/advisor/workspace/appointments?view=requests` | Client request visible |
| A2 | Request row shows client name, preferred time, lifecycle | Readable summary |
| A3 | Open detail | Client topics visible; adviser agenda section adviser-only |
| A4 | No auto-confirm | Status remains `requested` until adviser action |
| A5 | No Google auto-create | No calendar event without manual Sync |
| A6 | `/advisor/today` | May not show request card — use Requests view |
| A7 | Relationship 360 | Next appointment / timeline reflects data if applicable |
| A8 | Manage without duplicate | Same appointment ID through adviser review |
| A9 | `/advisor/classic` | Still works |

---

## Privacy and safety checks

| Control | Implementation |
|---------|----------------|
| Client identity | Session only — `ensureUserClientProfile()` |
| Master gate | `crm_v2_master` required for client appointments (Phase 18A) |
| Client flag | `crm_v2_appointments_client` enabled + `client_visible` |
| IDOR | `loadOwnedAppointment(clientId, appointmentId)` |
| Forged IDs in POST | `rejectUnexpectedFields` on `clientId`, `adviserId`, etc. |
| Idempotency | `idempotency_key` prevents duplicate row on retry |
| DTO minimization | Client checklist: `client`/`shared` visibility only |
| No external send | No email/SMS on create; in-app notification only |

---

## Rollback plan

### Client appointments only (preferred)

```sql
UPDATE platform_feature_controls
SET enabled = false, client_visible = false, updated_at = now()
WHERE feature_key = 'crm_v2_appointments_client';
```

Client sees "unavailable" on `/appointments` and `/appointments/request`. Adviser workspace remains usable.

### Full CRM V2 lockout

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key = 'crm_v2_master';
```

See [CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md](./CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md).

**No database rollback or data deletion required.**

---

## No-go conditions

Stop and rollback client flag if:

1. Client sees another client's appointment data
2. Unintended email, SMS, WhatsApp, or calendar invite sent
3. Client request creates duplicate records on single submit
4. Client can set another client's ID via API
5. Adviser internal notes/agenda exposed on client detail
6. Raw feature flag errors or pilot UUIDs shown to client
7. Google Calendar event auto-created on client request

---

## Automated QA

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
npm run qa:crm-v2-shell
npm run qa:crm-v2-today
npm run qa:adviser-workspace-regression
npm run qa:client-appointment-request
npx tsc --noEmit
```

---

## Explicit statement

**This phase reintroduces client appointment requests only.**

It does **not** approve:

- Full client portal rollout
- Service requests (`/actions`, `/requests`)
- Protection summaries (`/protection`)
- Preferences or advocacy (`/preferences`)
- Client messages (`/messages`)
- Automatic outreach or Google Calendar auto-sync

Passing Phase 18A QA is required but not sufficient for broader client CRM V2 enablement.

---

## Related documents

- [CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_AUDIT.md](./CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_AUDIT.md)
- [CRM_V2_PHASE_13_DAY_1_CLIENT_SCRIPT.md](./CRM_V2_PHASE_13_DAY_1_CLIENT_SCRIPT.md)
- [CRM_V2_PHASE_17_ADVISER_BURN_IN_HARDENING.md](./CRM_V2_PHASE_17_ADVISER_BURN_IN_HARDENING.md)
- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
