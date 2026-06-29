# CRM V2 Phase 03 — Security Review

**Date:** 2026-06-29  
**Scope:** Adviser CRM V2 appointment core

---

## Controls

| Control | Implementation |
|---------|----------------|
| Master + pilot gates | `assertCrmV2AppointmentsAccess` |
| Sub-feature | `crm_v2_appointments_adviser` |
| Assignment | `resolveAuthorizedAppointment` + `resolveAccessibleClient` |
| IDOR masking | 404 for forged / cross-adviser IDs |
| Browser adviser ID | Rejected in API body validation |
| Fail closed | Feature defaults false |
| No existence leak | List scoped by adviser; detail independent auth |
| Optimistic concurrency | `version` on transition/reschedule |
| Invalid transition | No DB write |
| GET no writes | List/detail routes read-only |
| DTO redaction | No private notes, paths, URLs, tokens |
| RLS | Supporting tables `is_assigned_advisor(client_id)` |
| Audit | Bounded metadata only |

## Out of scope (confirmed)

- Client appointment APIs (Phase 04)
- Google Calendar from CRM V2 (Phase 05)
- Service-role expansion beyond existing admin client pattern

## Residual risk

- Legacy `cancelled` rows map to `legacy_cancelled` — operator decision before migration apply
- Meeting Studio one-to-many at DB — service enforces single active link for CRM workflow
