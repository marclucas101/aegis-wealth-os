# CRM V2 Phase 04 — Client Lifecycle Actions

## Canonical lifecycle reuse

Phase 04 reuses the Phase 03 canonical lifecycle in `lib/crm-v2/appointments/lifecycle.ts`. No client-specific competing lifecycle is created.

## Client display mapping

- `requested` → Request submitted
- `proposed` / `awaiting_confirmation` / `rescheduled` → Awaiting your response
- `confirmed` / `preparing` / `ready` → Upcoming / preparation
- `follow_up_required` → Follow-up pending
- `closed` → Completed
- `cancelled_by_client` / `cancelled_by_adviser` → Cancelled

## Client-permitted actions

- `confirm_proposal`
- `decline_proposal`
- `request_another_time`
- `request_reschedule`
- `cancel_appointment`
- `submit_topics`
- `complete_checklist`

## Explicitly prohibited for clients

- `mark_ready`
- `start_meeting`
- `move_to_follow_up`
- `close`
- `record_no_show`
- Adviser cancellation flows

Invalid transitions perform no writes and return safe validation/conflict responses.
