# CRM V2 Phase 05 — Security Review

## Key controls

- Central gate: `assertCrmV2GoogleCalendarAccess`.
- Session-derived adviser identity only.
- Appointment ownership enforced by `resolveAuthorizedAppointment`.
- Tokens encrypted at rest and never returned to browser.
- Provider calls are server-only through centralized service boundary.

## Threat outcomes

- **IDOR:** blocked by adviser ownership and safe `not_found` semantics.
- **Feature bypass:** blocked by chained master/pilot/appointments/google gates.
- **Token exposure:** blocked by encrypted persistence and DTO redaction.
- **Replay/state misuse:** blocked by signed state validation and adviser/session match.
- **Inbound overwrite risk:** blocked by one-way reconciliation policy.

## Residual risks (deferred)

- Persistent consumed-state replay ledger should be enforced in runtime callback path.
- Background retry worker is deferred; explicit retry is current safe fallback.
