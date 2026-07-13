# CRM V2 Phase 12 — Source Integration

---

## Reports adapters

| Adapter | Source authority | Projection |
|---------|------------------|------------|
| `relationshipsAdapter` | `clients` | Assigned counts, review due |
| `appointmentsAdapter` | `adviser_appointments` | Upcoming, prep, follow-up |
| `serviceAdapter` | `service_commitments`, `client_service_requests` | Open items |
| `protectionAdapter` | `crm_protection_policies`, `crm_protection_extractions` | Verification / errors |
| `reviewRhythmAdapter` | `clients`, `crm_relationship_moments` | Review and moments due |
| `communicationsAdapter` | `crm_communication_records` | Drafts, follow-ups, failures |
| `operationsSummaryAdapter` | Google Calendar status | Sync summary |
| `workQueueAdapter` | Phase 10.2 `buildAdviserWorkQueue` | Virtual queue counts |

## Operations adapters

| Adapter | Source | Notes |
|---------|--------|-------|
| `featureControlsAdapter` | `platform_feature_controls` | CRM V2 keys only |
| `migrationDiagnosticsAdapter` | Runbook | No runtime CLI |
| `googleCalendarAdapter` | `loadGoogleCalendarIntegrationStatus` | No tokens |
| `communicationsAdapter` | `crm_communication_records` | Failure counts |
| `workQueueAdapter` | `buildAdviserWorkQueue` | Adapter health |
| `todaySourcesAdapter` | `loadAdviserTodayProjection` | Source failures |
| `protectionExtractionAdapter` | `crm_protection_extractions` | Error counts |
| `securityBoundariesAdapter` | `pilotConfig` | Allowlist configured — contents hidden |
| `manualAcceptanceAdapter` | Documentation | Checklist reference |

## Rules

- Source remains authoritative
- No source lifecycle mutation on read
- No duplicate authority
- No provider API on generic reports read
