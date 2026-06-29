# CRM V2 Phase 03 — Existing Appointment Audit

**Phase:** 03  
**Date:** 2026-06-29  
**Branch:** `crm-v2-03-appointments-adviser`  
**Rule:** Audit completed before schema design. No migrations applied.

---

## 1. `adviser_appointments` columns (current)

| Column | Type | Classification |
|--------|------|----------------|
| `id` | UUID PK | **Authoritative** appointment identity |
| `adviser_user_id` | UUID FK users | **Authoritative** assigned adviser |
| `client_user_id` | UUID FK users | **Authoritative** client auth user |
| `client_id` | UUID FK clients | **Authoritative** relationship reference |
| `appointment_type` | TEXT | **Authoritative** type key (calendar settings JSON) |
| `starts_at` / `ends_at` | TIMESTAMPTZ | **Authoritative** schedule |
| `timezone` | TEXT | **Authoritative** display timezone |
| `status` | `adviser_appointment_status` enum | **Legacy compatibility** — pending, confirmed, cancelled, completed, failed |
| `google_event_id` | TEXT | **External mapping** (Phase 05 sync) |
| `google_calendar_id` | TEXT | **External mapping** |
| `google_event_url` | TEXT | **External mapping** — not exposed in CRM V2 DTOs |
| `client_notes` | TEXT | **Authoritative** client-visible notes (future client writer Phase 04) |
| `location_type` | TEXT | **Authoritative** delivery mode |
| `meeting_url` | TEXT | **Authoritative** safe meeting link metadata |
| `idempotency_key` | TEXT | **Supporting** deduplication |
| `created_at` / `updated_at` | TIMESTAMPTZ | **Authoritative** audit timestamps |
| `cancelled_at` | TIMESTAMPTZ | **Authoritative** cancellation time |
| `source` | TEXT | **Authoritative** origin (client_booking, adviser_created, external_import) |
| `created_by_user_id` | UUID | **Authoritative** creator |
| `external_reference` / `external_url` | TEXT | **Legacy compatibility** external import |
| `private_adviser_note` | TEXT | **Adviser-only** — never in CRM V2 public DTOs |
| `phone_instructions` | TEXT | **Authoritative** delivery metadata |
| `custom_meeting_link` | TEXT | **Authoritative** delivery metadata |
| `location_text` | TEXT | **Authoritative** safe location |
| `notification_status` / `notification_error` | TEXT | **Supporting** email lifecycle |
| `calendar_sync_status` / `calendar_sync_error` | TEXT | **External mapping** — Phase 05 |

**Phase 03 additions (migration `202606290004`):** `crm_lifecycle_status`, `title`, `template_key`, `preparation_state`, `follow_up_state`, `version`, `last_transition_at`, `last_transition_by_user_id`, `cancellation_reason_code`, `no_show_reason_code`, `updated_by_user_id`.

---

## 2. Current statuses (`adviser_appointment_status`)

| Legacy status | Writers | Readers | CRM V2 read mapping |
|---------------|---------|---------|---------------------|
| `pending` | Client booking (pre-confirm paths), legacy | Legacy adviser, client portal, work queue | `proposed` (deterministic) |
| `confirmed` | Client booking, adviser creation, legacy | All appointment surfaces | `confirmed` |
| `cancelled` | Cancel APIs (client/adviser) | Legacy lists | `legacy_cancelled` until operator distinguishes actor |
| `completed` | Legacy completion paths | Legacy | `closed` |
| `failed` | Calendar/booking failures | Legacy | `legacy_failed` |

**Classification:** Legacy enum is **legacy compatibility**. Canonical CRM lifecycle stored in `crm_lifecycle_status` after Phase 03 migration apply; null column uses deterministic legacy mapping on read only — no invented history.

---

## 3. Writers

| Writer | Path | Notes |
|--------|------|-------|
| Client booking | `lib/supabase/appointmentsPersistence.ts` | Creates confirmed + Google event |
| Adviser creation | `lib/supabase/adviserAppointmentCreation.ts` | Legacy `/api/advisor/appointments` |
| Cancel | `appointmentsPersistence.cancelAppointment`, legacy cancel route | Sets `cancelled` |
| CRM V2 (Phase 03) | `lib/crm-v2/appointments/service.ts` | Gated; does not replace legacy writers |

---

## 4. Readers

| Reader | Classification |
|--------|----------------|
| `/api/advisor/appointments` | **Legacy compatibility** |
| `/api/advisor/clients/[clientId]/appointments` | **Legacy compatibility** |
| `/api/my-adviser/book` | **Legacy compatibility** (client) |
| Work queue batch (`loadWorkQueueBatchData`) | **Projected view** |
| CRM V2 relationship list (`hasUpcomingAppointment`) | **Projected view** |
| CRM V2 appointments (Phase 03) | **Authoritative read** via service layer |

---

## 5. Google Calendar relationships

| Record | Classification |
|--------|----------------|
| `adviser_calendar_connections` | **External mapping** — OAuth tokens, server-only |
| `adviser_calendar_settings` | **Supporting** adviser preferences |
| `google_event_id` on appointment | **External mapping** — not authoritative for lifecycle |
| `calendar_sync_status` | **External mapping** — Phase 05 extends |

**Phase 03:** No Google API calls from CRM V2 appointment service. External mapping columns untouched.

---

## 6. `meeting_sessions` relationship

| Aspect | Decision |
|--------|----------|
| FK | `meeting_sessions.appointment_id` → `adviser_appointments.id` (nullable) |
| Cardinality | **One-to-many** permitted at DB level; CRM V2 enforces **one active link** per appointment for `in_progress` workflow |
| Authority | Appointment = schedule/lifecycle; session = execution content |
| Classification | `meeting_sessions` = **supporting child record** (execution) |

---

## 7. Meeting Studio

| Item | Classification |
|------|----------------|
| Meeting Studio UI | **Legacy route** `/advisor/clients/[clientId]/meeting-studio` |
| `meetingStudioWorkflow.ts` | **Authoritative** session lifecycle |
| CRM V2 link | **Deferred integration** — read-only readiness + allowlisted href |

---

## 8. Binder and meeting packs

| Item | Classification |
|------|----------------|
| `binder_exports` | **Authoritative** binder lineage (Phase 9F.3) |
| Generation workflow | **Existing** — CRM V2 reads status only |
| CRM V2 projection | **Projected view** — Not generated / Preparing / Ready / Failed |

---

## 9. Audit behavior (existing)

| Mechanism | Classification |
|-----------|----------------|
| `audit_logs` via `writeAuditLog` | **Supporting** platform audit |
| Legacy appointment create | Writes `adviser_appointment_created` |
| CRM V2 | Adds `crm_appointment_state_events` **supporting child** + bounded `audit_logs` entries |

---

## 10. Rescheduling (existing)

Legacy `updateAdviserAppointment` updates same row (`starts_at`, `ends_at`) — **same ID preserved**. May sync Google (Phase 03 CRM reschedule does not). CRM V2 reschedule records prior schedule in `crm_appointment_state_events`.

---

## 11. Cancellation (existing)

`cancelAppointment` sets `status = cancelled`, `cancelled_at`. Does not distinguish client vs adviser in enum. Phase 03 CRM transitions use `cancelled_by_client` / `cancelled_by_adviser` in `crm_lifecycle_status`.

---

## 12. Timezone behavior

- Stored: `timezone` TEXT (IANA), `starts_at`/`ends_at` TIMESTAMPTZ (UTC instant).
- Default: `Asia/Singapore` in calendar settings.
- CRM V2 validates IANA names; displays in appointment timezone.
- DST: Stored instants are UTC-safe; display uses appointment timezone (relevant for external attendees).

---

## 13. Duplicate-identity risks

| Risk | Mitigation |
|------|------------|
| New `crm_appointments` table | **Forbidden** — extend `adviser_appointments` only |
| Reschedule creating new row | **Rejected** — same ID required |
| Duplicate Meeting Studio session link | **Rejected** in service layer |
| Google event as identity | **Not authoritative** |

---

## 14. Compatibility constraints

- Legacy `/advisor` appointment routes **unchanged**.
- Legacy enum `status` **retained**; CRM V2 syncs mapped legacy value on write.
- Existing rows **readable** via legacy mapping when `crm_lifecycle_status` IS NULL.
- No backfill of lifecycle history for historical rows.
- Operator decision before apply: confirm `legacy_cancelled` mapping acceptable for indistinguishable cancellations.

---

## 15. Record classification summary

| Record / surface | Classification |
|------------------|----------------|
| `adviser_appointments` | **Authoritative** |
| `crm_appointment_state_events` | **Supporting child record** |
| `crm_appointment_participants` | **Supporting child record** |
| `crm_appointment_client_topics` | **Supporting child record** (future client writer) |
| `crm_appointment_agenda_items` | **Supporting child record** (adviser-only) |
| `crm_appointment_checklist_items` | **Supporting child record** |
| `meeting_sessions` | **Supporting child record** (execution) |
| `binder_exports` | **Authoritative** (binder domain) |
| Google Calendar event | **External mapping** |
| Work queue appointment items | **Projected view** |
| CRM V2 appointment list views | **Projected view** |
| Legacy `/advisor/appointments` | **Legacy compatibility** |
| Client booking UI | **Legacy compatibility** (Phase 04 adds collaboration) |
| Google Calendar sync (Phase 05) | **Deferred** |
