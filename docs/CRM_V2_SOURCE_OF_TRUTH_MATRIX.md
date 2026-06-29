# CRM V2 — Source of Truth Matrix

**Phase:** 00  
**Principle:** One authoritative record per domain. Projections and queues are never SOT.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **SOT** | Authoritative — mutations go here |
| **PROJ** | Projection — assembled read model |
| **REUSE** | Existing table, extended in place |
| **NEW** | New table approved in blueprint |
| **EXT** | Extension migration on existing table |

---

## Core domains

| Domain | SOT | Table / store | CRM V2 role | Phase |
|--------|-----|---------------|-------------|-------|
| Relationship identity (v1) | **SOT REUSE** | `clients` | `relationshipId = clients.id` | 02 |
| Relationship profile | **SOT REUSE** | `clients`, `discover_profiles`, `client_profiles` | Read aggregate; ethnicity column EXT Phase 08 | 02, 08 |
| Household grouping | **DEFERRED** | — | Display-only `householdName` in reports until operator approves `households` | Post-pilot |
| Adviser assignment | **SOT REUSE** | `clients.advisor_user_id` | Unchanged | All |
| Lifecycle stage | **SOT REUSE** | `clients.relationship_stage` | Canonical; `status` legacy read-only | All |
| Appointment | **SOT REUSE EXT** | `adviser_appointments` | CRM lifecycle enum extension | 03 |
| Appointment participants | **SOT NEW** | `appointment_participants` | Additive | 03 |
| Appointment audit | **SOT NEW** | `appointment_state_events` | Immutable transitions | 03 |
| Meeting session | **SOT REUSE** | `meeting_sessions` | Linked via `appointment_id` | 03 |
| Meeting audit | **SOT REUSE** | `meeting_session_events` | Unchanged | 03 |
| Service commitment | **SOT NEW** | `service_commitments` | Canonical action/request | 06 |
| Adviser task (legacy) | **SOT REUSE** | `advisor_tasks` | Retained; adapter to queue | 06, 11 |
| Roadmap action | **SOT REUSE** | `roadmap_items` | Unchanged | 02 |
| Planning output | **SOT REUSE** | `published_outputs` | Unchanged | 02 |
| Review pipeline | **SOT REUSE** | `clients` + `annual_reviews` | Computed rules, not new table | 02 |
| Document vault | **SOT REUSE** | `documents` | Unchanged | 02 |
| Binder export | **SOT REUSE** | `binder_exports` | Unchanged | 02 |
| Protection PDF | **SOT REUSE** | `documents` (category insurance) | Report generator output | 07 |
| Protection policy (structured) | **SOT NEW** | `protection_policies` | Post-verification authoritative | 07 |
| Policy version | **SOT NEW** | `protection_policy_versions` | Includes extraction + confirmed | 07 |
| Governed communication | **SOT REUSE** | `governed_content` | Published client comms | 10 |
| Communication delivery | **SOT REUSE** | `communication_deliveries` | Delivery state | 10 |
| CRM comm draft | **SOT NEW** | `crm_communication_drafts` | Staging before governed content | 10 |
| Relationship moment | **SOT NEW** | `relationship_moments` | Birthdays, holidays, travel, etc. | 08 |
| Moment override | **SOT NEW** | `adviser_moment_overrides` | Adviser add/exclude | 08 |
| Advocacy event | **SOT NEW** | `advocacy_events` | Immutable, append-only | 09 |
| Advocacy config | **SOT NEW** | `advocacy_score_config` | Weights, caps (operator) | 09 |
| Google connection | **SOT REUSE** | `adviser_calendar_connections` | OAuth tokens | 05 |
| Calendar settings | **SOT REUSE** | `adviser_calendar_settings` | Slots, types | 05 |
| Google event mapping | **SOT REUSE** | `adviser_appointments.google_*` | Per-appointment | 05 |
| Feature control | **SOT REUSE** | `platform_feature_controls` | CRM flags added via seed migrations | 01+ |
| Audit log | **SOT REUSE** | `audit_logs` | Cross-cutting | All |
| Shield / stress | **SOT REUSE** | `shield_scores`, `stress_tests` | Advice domain read-only in CRM | 02 |
| Discover facts | **SOT REUSE** | `discover_profiles` | Advice domain | 02 |
| Client notification | **SOT REUSE** | `client_notifications` | Client-visible delivery | 10 |
| Work queue item | **PROJ** | — (virtual) | `AdviserWorkItem` assembly | 11 |
| Engagement timeline | **PROJ** | — (virtual) | Multi-source projection | 02 |
| Today dashboard | **PROJ** | — (virtual) | Sectioned aggregation | 11 |
| Protection portfolio summary | **PROJ** | — (derived) | From confirmed policy versions | 07 |
| Advocacy yearly score | **PROJ** | — (computed) | From `advocacy_events` | 09 |

---

## Explicit non-duplication rules

| Prohibited duplicate | Authoritative instead |
|---------------------|----------------------|
| Second appointment table | `adviser_appointments` |
| Queue-owned work records | Source tables (`service_commitments`, `advisor_tasks`, etc.) |
| Timeline event table (initial) | Projection from sources |
| Second promotions/insights store | `governed_content` |
| Competing meeting identity | `meeting_sessions` linked to appointment |
| Auto-confirmed protection extraction | `protection_policy_versions` with `confirmed` state only after adviser action |
| Client-visible internal notes | `private_adviser_note`, adviser agenda — adviser-only columns |

---

## Dual-model handling

| Legacy field | Canonical field | CRM V2 rule |
|--------------|-----------------|-------------|
| `clients.status` | `clients.relationship_stage` | Write `relationship_stage`; read both for transition period |
| `adviser_appointments.status` (legacy enum) | CRM lifecycle status | Map on read; migrate enum Phase 03 migration |
| `advisor_*` DB names | `adviser` UI copy | No rename migration |

---

## Cash flow / goals dual SOT

Per Phase 10 recommendation: **exclude** from cross-domain CRM rules until operator resolves canonical goals SOT. CRM may link to `published_outputs` and `client_goals` read-only but must not merge amounts across sources.

---

## Promotions / legacy content

| Store | Status during CRM V2 |
|-------|-------------------|
| `promotions` | Schema retained; observation only |
| `governed_content` | SOT for all new CRM communications |
| `legacy_promotions_write` | Remains **false** |
