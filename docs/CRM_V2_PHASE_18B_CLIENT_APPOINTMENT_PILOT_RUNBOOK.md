# CRM V2 Phase 18B — Client Appointment Pilot Runbook

**Purpose:** Operator checklist for **one** controlled staging client appointment request cycle.  
**Not:** Production launch. Not full client portal rollout.

**Repository decision state:** See [CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_READINESS.md](./CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_READINESS.md).

---

## Step ownership legend

| Label | Meaning |
|-------|---------|
| **Cursor (local)** | Completed in repository preparation; re-run if code changes |
| **Operator** | Human must execute |
| **Staging** | Requires staging deployment / environment |
| **Credentials** | Requires test-user login |
| **Database** | Requires DB/SQL visibility (operator) |
| **INCOMPLETE** | Not executed in Phase 18B repository work |

---

## 1. Environment and deployment verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

- Confirm staging deploy includes commit `263ecc2` or later Phase 18B commit on this branch after merge.
- Confirm app health (login page loads).
- Confirm no production enablement planned for this run.

---

## 2. Commit and tag verification

| Owner | Status |
|-------|--------|
| Cursor (local) | Done for baseline; Operator re-check on staging |

```bash
git fetch --all --prune
git rev-parse HEAD
git tag --points-at HEAD
# Expect Phase 18A tag on baseline: crm-v2-phase18a-client-appointment-request-ready
```

Record deployed commit in the evidence template (redacted if needed).

---

## 3. Required feature-control verification

| Owner | Status |
|-------|--------|
| Operator + Database | **INCOMPLETE** |

### Read current state (safe — no secrets)

```sql
SELECT feature_key, enabled, client_visible, adviser_visible, updated_at
FROM platform_feature_controls
WHERE feature_key IN (
  'crm_v2_master',
  'crm_v2_pilot_mode',
  'crm_v2_relationships',
  'crm_v2_today',
  'adviser_work_queue',
  'crm_v2_appointments_adviser',
  'crm_v2_appointments_client',
  'crm_v2_reports',
  'crm_v2_operations',
  'crm_v2_client_service',
  'crm_v2_protection_portfolio',
  'crm_v2_client_profile',
  'crm_v2_advocacy',
  'crm_v2_communications',
  'crm_v2_google_calendar'
)
ORDER BY feature_key;
```

### Enable only approved pilot flags (staging only)

```sql
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

### Keep disabled

`crm_v2_client_service`, `crm_v2_protection_portfolio`, `crm_v2_client_profile`, `crm_v2_advocacy`, `crm_v2_communications`, `crm_v2_google_calendar`.

**Do not commit query results containing environment-specific values into git without redaction.**

---

## 4. Adviser allowlist verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

- Confirm `CRM_V2_PILOT_USER_IDS` includes the pilot adviser auth user ID.
- Restart server after any env change.
- Confirm `/api/advisor-v2/shell` returns available for pilot adviser.
- **Do not** paste allowlist UUIDs into committed docs.

---

## 5. Adviser–client assignment verification

| Owner | Status |
|-------|--------|
| Operator + Database | **INCOMPLETE** |

Safe operator check pattern (no real IDs in repo):

```sql
-- Replace placeholders locally; do not commit results with real UUIDs
SELECT c.id AS client_id,
       c.advisor_user_id IS NOT NULL AS has_adviser,
       (c.advisor_user_id = '<pilot-adviser-auth-user-id>'::uuid) AS assigned_to_pilot_adviser
FROM clients c
WHERE c.id = '<pilot-client-id>'::uuid;
```

**No-go if `advisor_user_id` is null** — POST returns "Assigned adviser required" and must not create an orphan.

---

## 6. Client login

| Owner | Status |
|-------|--------|
| Operator + Credentials + Staging | **INCOMPLETE** |

- Log in as staging pilot client with existing secure login.
- Confirm client role (not adviser).

---

## 7. Client appointment request submission

| Owner | Status |
|-------|--------|
| Operator + Credentials + Staging | **INCOMPLETE** |

1. Open `/appointments`.
2. Open `/appointments/request`.
3. Submit **one** request with future preferred time and short topic (e.g. "Pilot test").
4. Expect confirmation: **Request received** — not a confirmed appointment.

---

## 8. Confirmation-screen verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

- No raw appointment UUID shown.
- No "CRM V2" / pilot / feature-flag wording.
- Copy states adviser will follow up.

---

## 9. Client appointment-list verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

- Return to `/appointments`.
- Request visible with client-safe lifecycle label (awaiting adviser review).

---

## 10. Client appointment-detail privacy verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

Open `/appointments/[appointmentId]`:

- Own request only.
- No adviser private notes / internal agenda.
- No other client's data.
- Optional: preparation items only if client/shared visibility.

---

## 11. Adviser Client requests verification

| Owner | Status |
|-------|--------|
| Operator + Credentials + Staging | **INCOMPLETE** |

1. Log in as pilot adviser.
2. Open `/advisor/workspace/appointments?view=requests`.
3. Confirm the same client request appears (name, preferred time, lifecycle).

**Note:** `/advisor/today` may **not** show a dedicated request card — accepted limitation. Use Client requests view.

---

## 12. Adviser appointment-detail verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

- Open the same appointment ID.
- Client-requested topics visible.
- Adviser agenda section remains adviser-only (empty for client-created requests unless seeded later).
- Callout: client request — no automatic message/calendar.

---

## 13. Existing supported lifecycle action

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

From `requested`, UI exposes **confirm** and **cancel** (via `deriveAdviserActions`).

**Recommended pilot action:** **Confirm** (or Cancel if aborting the test meeting).

Do **not** press Google Calendar Sync during this pilot unless a separate calendar test is approved.

---

## 14. Client lifecycle update verification

| Owner | Status |
|-------|--------|
| Operator + Credentials + Staging | **INCOMPLETE** |

- Client refreshes appointment detail/list.
- Label updates to a client-safe confirmed (or cancelled) state.
- Same appointment ID preserved.

---

## 15. In-app notification verification

| Owner | Status |
|-------|--------|
| Operator + Staging + Database (optional) | **INCOMPLETE** |

### Code behaviour (Cursor verified)

| Field | Value |
|-------|-------|
| Recipient | Pilot client (`client_id` of requester) |
| Type | `appointment_changed` |
| Title | `Appointment request received` |
| Summary | `Your appointment request was submitted.` |
| Reference | `appointment` + appointment id |
| Failure handling | `.catch(() => undefined)` — does **not** block create |
| Transaction | **Not** shared with appointment insert |
| Dedupe | Same client + type + reference_type + reference_id → reuse row |
| Adviser notification | **None** — adviser uses Client requests view |

### Destination route limitation (accepted)

`ClientNotificationsPanel` allowlists `/document-vault`, `/insights`, `/goals-reviews`, `/dashboard` only. Reference type `appointment` resolves to **no destination link**. Notification text still appears (e.g. on Insights panel). Client uses **Appointments** nav for the record.

Operator: confirm in-app notification row and/or UI presence; do not expect deep-link to `/appointments/[id]`.

---

## 16. Audit-event verification

| Owner | Status |
|-------|--------|
| Operator + Database | **INCOMPLETE** |

| Field | Value |
|-------|-------|
| Action | `crm_client_appointment_requested` |
| Actor | Client auth user id |
| Entity | `adviser_appointments` + appointment id |
| Metadata | `{ appointment_type }` only |
| Timing | After successful insert |
| Failure | Logged server-side; does not throw to client |

```sql
-- Operator only; redact before any commit
SELECT action, entity_type, entity_id, metadata, created_at
FROM audit_logs
WHERE action = 'crm_client_appointment_requested'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 17. Idempotency retry verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

- Replay same POST with same `idempotencyKey` (or re-submit via UI without generating a new key — form holds key in ref for the attempt).
- Expect same appointment id; **one** row in `adviser_appointments`.

---

## 18. Cross-client IDOR verification

| Owner | Status |
|-------|--------|
| Operator + Credentials + Staging | **INCOMPLETE** |

- Second client (or forged appointment id) must not open the pilot appointment.
- Expect not found / unavailable — no leak of existence details beyond safe empty/error.

---

## 19. Cross-adviser IDOR verification

| Owner | Status |
|-------|--------|
| Operator + Credentials + Staging | **INCOMPLETE** |

- Non-assigned adviser must not open the appointment detail.
- Resolver returns `not_found` pattern.

---

## 20. Google Calendar non-creation verification

| Owner | Status |
|-------|--------|
| Operator + Staging | **INCOMPLETE** |

- After client submit (and after confirm if tested): no new Google Calendar event without manual Sync.
- Keep `crm_v2_google_calendar` disabled unless explicitly testing manual sync separately.

---

## 21. External communication non-send verification

| Owner | Status |
|-------|--------|
| Operator | **INCOMPLETE** |

- Confirm no email / SMS / WhatsApp / governed publish from the request create path.
- Ask client: any unexpected external message? Expect **No**.

---

## 22. Rollback verification

| Owner | Status |
|-------|--------|
| Operator + Database | **INCOMPLETE** |

```sql
UPDATE platform_feature_controls
SET enabled = false, client_visible = false, updated_at = now()
WHERE feature_key = 'crm_v2_appointments_client';
```

- Client `/appointments` and `/appointments/request` show unavailable.
- Existing appointment row **remains** (non-destructive).
- Adviser workspace can remain enabled.

---

## 23. Evidence collection

| Owner | Status |
|-------|--------|
| Operator | **INCOMPLETE** |

Fill [CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_EVIDENCE_TEMPLATE.md](./CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_EVIDENCE_TEMPLATE.md). Redact all identifiers.

---

## 24. No-go conditions

Stop and disable `crm_v2_appointments_client` if:

1. Cross-client data visible  
2. Cross-adviser appointment access  
3. Duplicate appointment on single intentional submit  
4. Orphan request without assigned adviser  
5. External email/SMS/WhatsApp/calendar invite sent  
6. Adviser-only notes/agenda exposed to client  
7. Raw feature-flag / pilot UUID errors shown to client  
8. Cannot rollback client flag within 15 minutes  

---

## 25. Final decision

| Owner | Status |
|-------|--------|
| Operator | **INCOMPLETE** |

After evidence:

- **Continue observation** (one client only)  
- **Pause**  
- **Rollback client appointments flag**  

Repository Phase 18B alone does **not** mark staging pilot complete.

---

## Cursor-completed local automated checks

Re-run before operator pilot:

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
npm run qa:crm-v2-shell
npm run qa:crm-v2-today
npm run qa:adviser-workspace-regression
npm run qa:client-appointment-request
npm run qa:client-appointment-pilot-readiness
npx tsc --noEmit
```

Results at repository preparation time are recorded in the readiness report.
