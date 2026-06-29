# CRM V2 — Route Map

**Phase:** 00  
**Convention:** V2 portal at `/advisor-v2`; legacy at `/advisor` until Phase 14 cutover.

---

## 1. Adviser V2 navigation structure

Primary nav labels: **Today**, **Relationships**, **Appointments**, **Service**, **Communications**, **More**.

```text
/advisor-v2
├── /today                          Phase 11
├── /relationships                  Phase 02
│   └── /[relationshipId]           Phase 02 — Relationship 360
├── /appointments                   Phase 03
│   ├── /inbox                      Phase 03 — client requests
│   ├── /[appointmentId]            Phase 03 — detail
│   └── /follow-up                  Phase 03
├── /service                        Phase 06
│   ├── /my-work
│   ├── /client-requests
│   ├── /reviews
│   ├── /commitments
│   ├── /documents-required
│   ├── /workflow-cases
│   └── /completed
├── /communications                 Phase 10
│   ├── /drafts
│   └── /history
└── /more                           Phase 01 shell
    ├── /reports                    Phase 12
    ├── /operations                 Phase 12
    ├── /templates                  Phase 10
    └── /settings                   Phase 01 (profile link-out)
```

**Phase 03 status:** Appointment list, new, and detail implemented at `/advisor-v2/appointments`, `/advisor-v2/appointments/new`, `/advisor-v2/appointments/[appointmentId]`. APIs: `GET/POST /api/advisor-v2/appointments`, detail, transition, reschedule. Gated by `crm_v2_appointments_adviser` in addition to master + pilot.

**Phase 02 status:** Relationship list and Relationship 360 implemented at `/advisor-v2/relationships` and `/advisor-v2/relationships/[relationshipId]`. APIs: `GET /api/advisor-v2/relationships`, `GET /api/advisor-v2/relationships/[relationshipId]`. Gated by `crm_v2_relationships` in addition to master + pilot.

**Phase 01 shell (implemented):** Nine placeholder pages at `/advisor-v2` plus `GET /api/advisor-v2/shell`. Settings links to `/advisor/my-profile`. Access via `assertCrmV2Access()` in layout.

---

## 2. Relationship 360 tabs

Route: `/advisor-v2/relationships/[relationshipId]?tab=`

| Tab | Phase | Legacy equivalent |
|-----|-------|-------------------|
| `overview` | 02 | `/advisor/clients/[clientId]?tab=overview` |
| `financial-plan` | 02 | planning outputs + dashboard |
| `engagement` | 02 | meetings + timeline |
| `service` | 06 | tasks + commitments |
| `documents` | 02 | document vault tab |
| `profile` | 02, 08 | personal + moments |

---

## 3. Legacy adviser routes (unchanged until Phase 14)

| Legacy route | Status | CRM V2 mapping |
|--------------|--------|----------------|
| `/advisor` | Active | → `/advisor-v2/today` at cutover |
| `/advisor/clients` | Active | → `/advisor-v2/relationships` |
| `/advisor/clients/[clientId]` | Active | → `/advisor-v2/relationships/[id]` |
| `/advisor/appointments` | Active | → `/advisor-v2/appointments` |
| `/advisor/insights` | Active | Communications authoring; V2 integrates Phase 10 |
| `/advisor/protection-report` | Active | Feeds Phase 07 extraction |
| `/advisor/my-profile` | Active | Calendar OAuth; linked from V2 settings |
| `/advisor/calendar` | Redirect | → my-profile calendar section |
| `/advisor/promotions` | Retired redirect | → insights (9F.4) |
| `/advisor/feedback` | Active | Unchanged Phase 00–13 |
| `/advisor/setup` | Active | Unchanged |

**Phase 14 cutover:**

```text
/advisor           → CRM V2 (primary)
/advisor-legacy    → restricted fallback (audited, time-limited)
/advisor-v2        → redirect to /advisor (optional alias)
```

---

## 4. Client portal routes (additive, not replaced)

| Route | CRM V2 enhancement | Phase | Flag |
|-------|-------------------|-------|------|
| `/my-adviser` | Legacy adviser profile + booking touchpoint | Existing | existing |
| `/appointments` | Client appointment dashboard | 04 | `crm_v2_appointments_client` |
| `/appointments/request` | Client appointment request form | 04 | `crm_v2_appointments_client` |
| `/appointments/[appointmentId]` | Client appointment detail/actions | 04 | `crm_v2_appointments_client` |
| `/meeting-preparation` | Prep questions from appointment | 04 | `crm_v2_client_appointments` |
| `/document-vault` | Document requests from service | 06 | `crm_v2_client_service` |
| `/profile` | Ethnicity (optional), moments | 08 | `crm_v2_client_profile` |
| `/insights` | Unchanged governed feed | — | existing |
| `/dashboard`, `/my-plan`, `/roadmap`, etc. | Unchanged | — | existing |

**No client route rewrites** in Phase 01–13.

---

## 5. API route map (new V2 namespace)

**Phase 01 status:** Shell routes implemented at `/advisor-v2`. `GET /api/advisor-v2/shell` available for safe gate probe.

| API | Method | Phase | Purpose |
|-----|--------|-------|---------|
| `/api/advisor-v2/shell` | GET | 01 | Gate status, pilot check |
| `/api/advisor-v2/relationships` | GET | 02 | List |
| `/api/advisor-v2/relationships/[id]` | GET | 02 | 360 aggregate |
| `/api/advisor-v2/relationships/[id]/timeline` | GET | 02 | Engagement projection |
| `/api/advisor-v2/appointments` | GET, POST | 03 | CRUD + lifecycle |
| `/api/advisor-v2/appointments/[id]` | GET, PATCH | 03 | Detail + transitions |
| `/api/advisor-v2/appointments/[id]/transitions` | POST | 03 | State machine |
| `/api/advisor-v2/calendar/google/**` | * | 05 | OAuth, sync, retry |
| `/api/advisor-v2/service/commitments` | GET, POST | 06 | Service layer |
| `/api/advisor-v2/service/commitments/[id]` | PATCH | 06 | Complete/update |
| `/api/advisor-v2/protection/**` | * | 07 | Portfolio, verification |
| `/api/advisor-v2/moments/**` | * | 08 | Moments engine |
| `/api/advisor-v2/advocacy/**` | * | 09 | Events, scores |
| `/api/advisor-v2/communications/drafts` | * | 10 | CRM → governed bridge |
| `/api/advisor-v2/today` | GET | 11 | Today projection |
| `/api/advisor-v2/work-queue` | GET | 11 | Queue assembly |
| `/api/advisor-v2/reports/**` | GET | 12 | Reporting |
| `/api/advisor-v2/operations/**` | GET | 12 | Diagnostics |

**Client APIs (additive):**

| API | Phase | Flag |
|-----|-------|------|
| `/api/client/appointments/**` | 04 (legacy note) | `crm_v2_appointments_client` |
| `/api/appointments/**` | 04 | `crm_v2_appointments_client` |
| `/api/client/service/**` | 06 | `crm_v2_client_service` |

**Legacy APIs:** All `/api/advisor/**` routes remain until Phase 15 dependency audit.

---

## 6. Work queue action href allowlist

Phase 10.2: `/advisor/**` only.

Phase 11 extension:

```text
/advisor/**           — legacy deep links (retained)
/advisor-v2/**        — primary CRM V2 links
```

Validated by extended `isAllowlistedWorkQueueHref`.

---

## 7. Admin routes

| Route | CRM relevance | Phase |
|-------|---------------|-------|
| `/admin` | Client assignment | Existing |
| `/admin/communications` | Governed content | Phase 10 |
| `/admin/promotions-migration` | 9F.4 only — not CRM | Observation |
| `/admin` (future ops) | Feature flags, sync failures | Phase 12 |

No broad admin impersonation of adviser CRM sessions.

---

## 8. Error and fallback routes

| Route | Behavior |
|-------|----------|
| `/advisor-v2/*` (flag off) | `AdvisorV2Disabled` — safe message, no data leak |
| `/advisor-v2/*` (non-pilot adviser) | Same as flag off |
| `/advisor-v2/*` (client user) | Access denied |
| `/advisor-v2/error` | Route-level error boundary Phase 01 |

---

## 9. Request ID convention

All V2 API responses include `X-Request-Id` (UUID v4) — generated server-side, logged without PII. Phase 01 establishes pattern.
