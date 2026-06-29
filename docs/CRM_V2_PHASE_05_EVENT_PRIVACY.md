# CRM V2 Phase 05 — Event Privacy

## Event template

- **Title:** appointment-safe title from AEGIS (`title` fallback `AEGIS <appointment_type>`).
- **Description:** `Managed in AEGIS. Open the secure appointment workspace for preparation and details.`

## Allowed outbound fields

- Safe title
- Schedule (`starts_at`, `ends_at`, `timezone`)
- Delivery mode and safe location text
- Optional client email attendee
- Optional Google Meet link (for `google_meet` delivery mode)

## Explicitly excluded data

- Ethnicity, advocacy, protection details
- Policy numbers, financial values, goals
- Adviser agenda and private notes
- Meeting notes, internal checklist, audit metadata
- Document names and storage paths
- NRIC and sensitive identifiers
- Cancellation reason details
