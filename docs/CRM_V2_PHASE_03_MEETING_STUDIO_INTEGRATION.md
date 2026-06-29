# CRM V2 Phase 03 — Meeting Studio Integration

**Relationship:** One-to-many at DB; **one active CRM link** enforced in service.

---

## Authority split

| Domain | Authority |
|--------|-----------|
| Schedule + lifecycle | `adviser_appointments` |
| Meeting execution | `meeting_sessions` |

## Link rules (Phase 03)

1. Transition to `in_progress` triggers `linkMeetingSessionForAppointment`
2. If session already linked to appointment — verify `client_id` and `adviser_user_id` match
3. Else link unlinked `draft`/`prepared` session for same client+adviser
4. Else create new session with `appointment_id` FK
5. No second appointment row created
6. No Meeting Studio content copied into appointment columns

## UI

Detail panel shows `meetingSessionLinkState` and allowlisted href via `buildMeetingStudioHref(clientId)` → `/advisor/clients/[clientId]/meeting-studio`

## Feature dependency

Meeting Studio itself remains gated by `adviser_meeting_studio` on legacy routes. CRM V2 only links and displays readiness.
