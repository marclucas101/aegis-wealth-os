# CRM V2 Phase 18B — Client Appointment Pilot Evidence Template

**Instructions:** Complete during the staging operator pilot.  
**Commit policy:** Redact before any commit. Prefer storing filled copies outside the repository or in a private operator store.

## Prohibited in committed copies

Do **not** commit:

- Real client names  
- NRIC / passport numbers  
- Phone numbers or emails  
- Financial amounts or account numbers  
- Access tokens, API keys, OAuth secrets  
- Unredacted UUIDs (use `client-A`, `adviser-1`, or last-4 only)  
- Full `CRM_V2_PILOT_USER_IDS` values  

---

## Header

| Field | Value |
|-------|-------|
| Environment | staging / other (specify) |
| Date (local) | |
| Time (local) + timezone | |
| Deployed commit (short SHA) | |
| Operator name | |
| Pilot purpose | One controlled appointment request cycle |

---

## Feature-control snapshot (redacted)

Paste **keys and booleans only** (no secrets):

| feature_key | enabled | client_visible |
|-------------|---------|----------------|
| crm_v2_master | | |
| crm_v2_pilot_mode | | |
| crm_v2_appointments_adviser | | |
| crm_v2_appointments_client | | |
| crm_v2_google_calendar | | |
| crm_v2_communications | | |
| crm_v2_client_service | | |

Allowlist configured: Yes / No (do not paste IDs)

---

## Participants (redacted)

| Role | Redacted id | Notes |
|------|-------------|-------|
| Pilot adviser | `adviser-…` | In allowlist: Y/N |
| Pilot client | `client-…` | Has `advisor_user_id`: Y/N |

Assignment verified: ☐ Yes ☐ No  

---

## Appointment request

| Field | Value |
|-------|-------|
| Request timestamp | |
| Preferred starts_at (local) | |
| Topics submitted (sanitised) | |
| Confirmation screen OK | ☐ |
| No UUID on confirmation | ☐ |
| Client list shows request | ☐ |
| Client-safe lifecycle label | |

Canonical appointment id (redacted): `appt-…`  

Lifecycle after create: `requested` ☐ confirmed in DB/UI  

---

## Adviser intake

| Check | Pass |
|-------|------|
| Visible under Client requests | ☐ |
| Same appointment id | ☐ |
| Client name + preferred time clear | ☐ |
| Topics visible | ☐ |
| Adviser-only agenda not required for pilot | ☐ |
| Not relying on Today card | ☐ |

---

## Lifecycle transition tested

| Field | Value |
|-------|-------|
| Action taken | confirm / cancel / other (supported only) |
| From status | requested |
| To status | |
| Same appointment id preserved | ☐ |
| Client sees updated safe label | ☐ |
| State event / history OK (if checked) | ☐ |

---

## Notification result

| Check | Result |
|-------|--------|
| In-app notification present for client | Yes / No / Not checked |
| Title/summary match expected copy | ☐ |
| Deep-link to appointment (expected: none) | None / Unexpected link |
| Adviser in-app notification (expected: none) | None / Unexpected |

---

## Audit result

| Check | Result |
|-------|--------|
| `crm_client_appointment_requested` found | Yes / No / Not checked |
| Metadata limited (appointment_type) | ☐ |
| No sensitive fields in metadata | ☐ |

---

## Idempotency result

| Check | Result |
|-------|--------|
| Retry with same key | same id / new id (fail) |
| Row count for request | 1 / >1 (fail) |

---

## Privacy / IDOR

| Check | Pass |
|-------|------|
| Other client cannot open appointment | ☐ |
| Other adviser cannot open appointment | ☐ |
| Client cannot see adviser private notes/agenda | ☐ |

---

## Google Calendar

| Check | Result |
|-------|--------|
| Auto event on client request | None / Found (fail) |
| Auto event on confirm (if tested) | None / Found |
| Manual Sync used | No / Yes (note why) |

---

## External communication

| Channel | Unexpected send? |
|---------|------------------|
| Email | No / Yes |
| SMS | No / Yes |
| WhatsApp | No / Yes |
| Governed publish | No / Yes |

---

## Rollback

| Check | Result |
|-------|--------|
| Client flag disabled | ☐ |
| Client routes unavailable | ☐ |
| Appointment row retained | ☐ |
| Adviser tools still usable (if intended) | ☐ |

---

## Screenshots / evidence references

Store privately. List filenames only (no PII in names):

1.  
2.  
3.  

---

## Defects discovered

| ID | Severity | Description | Action |
|----|----------|-------------|--------|
| | | | |

---

## Final decision

Select one:

- ☐ Continue observation (one client)  
- ☐ Pause  
- ☐ Rollback client appointments  

**Staging pilot completed with evidence?** ☐ Yes ☐ No  

Operator sign-off: _________________ Date: _________
