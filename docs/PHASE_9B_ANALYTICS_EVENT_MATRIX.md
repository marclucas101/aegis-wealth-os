# Phase 9B — Analytics Event Matrix

Events are written via `writeAuditLog` with `entityType: prospect_journey`. Metadata is operational only — **no raw financial answers, document contents, or adviser notes**.

| Event | Trigger | Source | Metadata allowed |
|-------|---------|--------|------------------|
| `prospect_onboarding_started` | First Prospect Home load per session | `ProspectHomeClient` → `/api/prospect/events` | `surface` (optional) |
| `prospect_section_completed` | Discover step advanced | `DiscoverWizard` → `/api/prospect/events` | `sectionId` |
| `prospect_profile_submitted` | First successful submit from `prospect` stage | `submitProspectProfile` | `alreadySubmitted`, `taskCreated`, `stage`, `privacyAcknowledged` |
| `prospect_profile_resumed` | Repeat submit when already past `prospect` | `submitProspectProfile` | Same as above |
| `prospect_appointment_cta_selected` | Primary CTA clicked on Prospect Home | `ProspectHomeClient` → `/api/prospect/events` | `ctaReason` (href only) |
| `prospect_appointment_booked` | Client books via `/api/my-adviser/book` | `safeRecordProspectEvent` | `appointmentId`, `appointmentType` |
| `prospect_meeting_preparation_viewed` | Meeting prep page loaded | `/api/prospect/meeting-preparation` | None |
| `prospect_published_snapshot_viewed` | Dashboard returns `accessMode: published` | `/api/dashboard/current` | `outputType` |
| `prospect_document_uploaded` | Client uploads document | `/api/documents/upload` | `category` |

## Duplicate prevention

| Flow | Guard |
|------|-------|
| Profile submit | Stage transition only from `prospect`; task `source_key` unique |
| Appointment booked | Appointment `idempotency_key` + separate audit for booking |
| Onboarding started | Client `useRef` fires once per page mount |
| Section completed | Fires per step advance (intentional funnel metric) |

## Non-blocking guarantee

`safeRecordProspectEvent()` catches and logs failures without breaking primary user actions.

## Related audit events (not prospect_journey entity)

- `relationship_stage_changed` — stage transitions (submit, appointment)
- `client_appointment_booked` — operational appointment audit
- `discover_profile_saved` — discover save (may include score metadata for adviser ops — not exposed to prospect analytics funnel)
