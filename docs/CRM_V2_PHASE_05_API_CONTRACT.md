# CRM V2 Phase 05 — API Contract

## Integration APIs

- `GET /api/advisor-v2/integrations/google-calendar/status`
- `POST /api/advisor-v2/integrations/google-calendar/connect`
- `GET /api/advisor-v2/integrations/google-calendar/calendars`
- `POST /api/advisor-v2/integrations/google-calendar/select`
- `POST /api/advisor-v2/integrations/google-calendar/disconnect`

## Appointment sync APIs

- `POST /api/advisor-v2/appointments/[appointmentId]/google-calendar/sync`
- `POST /api/advisor-v2/appointments/[appointmentId]/google-calendar/retry`
- `GET /api/advisor-v2/appointments/[appointmentId]/google-calendar/status`

## Contract rules

- Adviser auth and ownership required.
- Master + pilot + adviser appointments + Google feature gates required.
- Cache policy: `private, no-store`.
- Safe request IDs returned on gated responses.
- No token fields in DTOs.
- Provider errors are redacted to safe categories.
