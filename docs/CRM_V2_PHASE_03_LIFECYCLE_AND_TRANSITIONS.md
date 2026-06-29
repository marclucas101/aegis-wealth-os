# CRM V2 Phase 03 — Lifecycle and Transitions

**Module:** `lib/crm-v2/appointments/lifecycle.ts`

---

## Canonical states

```text
requested, proposed, awaiting_confirmation, confirmed, rescheduled,
preparing, ready, in_progress, follow_up_required, closed,
cancelled_by_client, cancelled_by_adviser, no_show,
legacy_cancelled, legacy_failed, legacy_unknown
```

## Primary flow

```text
requested → proposed → confirmed → preparing → ready → in_progress
  → follow_up_required → closed
```

## `rescheduled`

- **Status:** Intermediate state after adviser reschedule when confirmation may be needed
- **Event:** `crm_appointment_state_events.event_type = 'rescheduled'` retains previous `starts_at`/`ends_at`
- **Transitions from rescheduled:** `proposed`, `awaiting_confirmation`, `confirmed`, `cancelled_by_adviser`

## Terminal states

`closed`, `cancelled_by_client`, `cancelled_by_adviser`, `no_show`, `legacy_cancelled`, `legacy_failed`

Terminal → active transitions are rejected.

## Adviser-permitted transitions (summary)

| From | To (subset) |
|------|-------------|
| requested | proposed, awaiting_confirmation, confirmed, cancelled_by_adviser |
| proposed | awaiting_confirmation, confirmed, cancelled_by_* |
| confirmed | preparing, rescheduled, cancelled_by_* |
| preparing | ready, cancelled_by_adviser |
| ready | in_progress, no_show, rescheduled, cancelled_by_adviser |
| in_progress | follow_up_required, closed, cancelled_by_adviser |
| follow_up_required | closed, preparing |

Full matrix enforced in `validateAppointmentTransition`.

## Creation

Allowed initial states: `requested`, `proposed`, `awaiting_confirmation`, `confirmed`.

## Legacy mapping (read-only when `crm_lifecycle_status` IS NULL)

| Legacy | CRM read |
|--------|----------|
| pending | proposed |
| confirmed | confirmed |
| cancelled | legacy_cancelled |
| completed | closed |
| failed | legacy_failed |

## Client transitions (Phase 04)

Defined in `CLIENT_TRANSITIONS` — not writable in Phase 03 APIs.
