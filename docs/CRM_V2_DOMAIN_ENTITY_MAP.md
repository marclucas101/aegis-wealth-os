# CRM V2 — Domain Entity Map

**Phase:** 00

---

## 1. Entity relationship overview

```text
                    ┌─────────────────┐
                    │ users           │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌──────────────┐  ┌─────────────────┐
     │ adviser_   │  │ clients      │  │ adviser_profiles│
     │ profiles   │  │ (=relationship│  │                 │
     └────────────┘  │  v1)         │  └─────────────────┘
                     └──────┬───────┘
                            │
     ┌──────────────────────┼──────────────────────────────┐
     ▼                      ▼                              ▼
┌─────────────┐   ┌──────────────────┐        ┌──────────────────┐
│ adviser_    │   │ meeting_sessions │        │ service_         │
│ appointments│◄──│ (appointment_id) │        │ commitments      │
└─────────────┘   └──────────────────┘        └──────────────────┘
     │                      │                              │
     ▼                      ▼                              ▼
┌─────────────┐   ┌──────────────────┐        ┌──────────────────┐
│ appointment_│   │ published_outputs│        │ protection_      │
│ participants│   │ roadmap_items    │        │ policies         │
│ state_events│   │ documents        │        │ policy_versions  │
└─────────────┘   │ binder_exports   │        └──────────────────┘
                  └──────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │ relationship_     │
                  │ moments           │
                  │ advocacy_events   │
                  │ crm_comm_drafts   │
                  └───────────────────┘
```

---

## 2. Reused entities (no schema replacement)

### 2.1 `clients` — Relationship identity (Phase 02)

| Column (existing) | CRM use |
|-------------------|---------|
| `id` | `relationshipId` |
| `display_name` | List + 360 header |
| `email`, `phone` | Profile (adviser-only in list) |
| `advisor_user_id` | Assignment |
| `relationship_stage` | Lifecycle badge |
| `status` | Legacy compatibility |
| `date_of_birth` | Birthday moments (Phase 08) |
| `last_review_at`, `next_review_due` | Review state |
| `user_id` | Client portal link |

**Not rewritten** in Phase 02 — read model wraps existing row.

### 2.2 `adviser_appointments` — Appointment SOT (Phase 03 EXT)

Existing columns retained: `adviser_user_id`, `client_id`, `client_user_id`, `starts_at`, `ends_at`, `google_event_id`, `notification_status`, `calendar_sync_status`, `private_adviser_note`, `source`.

New/extended (Phase 03 migration `202606290004`): `crm_lifecycle_status`, `template_key`, `title`, `preparation_state`, `follow_up_state`, `version`, transition metadata. Supporting tables: `crm_appointment_participants`, `crm_appointment_state_events`, `crm_appointment_client_topics`, `crm_appointment_agenda_items`, `crm_appointment_checklist_items`.

### 2.3 `meeting_sessions` — Meeting Studio (unchanged ownership)

| Link | Rule |
|------|------|
| `appointment_id` | Optional FK; one session may link one appointment |
| `adviser_user_id`, `client_id` | Must match appointment when linked |

### 2.4 `advisor_tasks` — Legacy tasks (retained)

Birthday reminders (`task_type = client_birthday`), general tasks. Phase 06 introduces `service_commitments` for CRM-native items; tasks adapter remains in work queue.

### 2.5 `roadmap_items`, `published_outputs`, `binder_exports`, `documents`

Read in Relationship 360; mutations continue via existing APIs until V2 service layer routes equivalents (Phase 06+).

### 2.6 `governed_content`, `communication_deliveries`, `client_notifications`

Communications domain SOT; CRM drafts feed into this pipeline (Phase 10).

### 2.7 `discover_profiles`, `shield_scores`, `pillar_scores`, `stress_tests`, `annual_reviews`

Advice domain — read-only in CRM list views; full detail in Relationship 360 sections.

### 2.8 `adviser_calendar_connections`, `adviser_calendar_settings`

Google OAuth and booking configuration — extended in Phase 05, not replaced.

### 2.9 `audit_logs`, `meeting_session_events`

Audit trail sources for timeline projection and appointment transition immutability.

### 2.10 `platform_feature_controls`

CRM V2 flags added via seed migrations per phase; code defaults in `featureFlags.ts`.

---

## 3. New entities (approved — NEW tables)

### 3.1 `service_commitments` (Phase 06)

| Field group | Purpose |
|-------------|---------|
| Identity | `id`, `client_id`, `adviser_user_id` |
| Type | commitment_type enum |
| Ownership | `owner` (adviser, client, shared) |
| Lifecycle | status, due_at, completed_at |
| Visibility | `client_visible`, `internal_note` |
| Links | `source_type`, `source_id` (appointment, meeting_session, etc.) |
| Audit | `created_at`, `updated_at`, `created_by_user_id` |

### 3.2 `crm_appointment_participants` (Phase 03)

| Field | Purpose |
|-------|---------|
| `appointment_id` | FK |
| `participant_type` | client, adviser, guest |
| `user_id` / `display_name` | Identity |
| `visibility` | client_visible boolean |

### 3.3 `crm_appointment_state_events` (Phase 03)

Immutable: `appointment_id`, `from_status`, `to_status`, `actor_user_id`, `actor_role`, `occurred_at`, `metadata` (safe JSONB).

### 3.4 `protection_policies` + `protection_policy_versions` (Phase 07)

Policy identity, insurer, type, status; versions hold coverage, premium, riders, verification_state, source_document_id, extraction_payload.

### 3.5 `relationship_moments` (Phase 08)

| moment_type | birthday, festive_holiday, relationship_anniversary, wedding_anniversary, policy_anniversary, client_returning, review_date, custom_milestone |
|-------------|---|
| Fields | `client_id`, `moment_date`, `moment_type`, `source`, `status`, `adviser_acknowledged_at` |

**Availability (travel):** `away date`, `return date`, contactability, and appointment impact — no itinerary storage.

`adviser_user_id`, `client_id`, `moment_type`, `holiday_key`, `override_action` (include, exclude), persistent.

### 3.7 `advocacy_events` (Phase 09)

Append-only: `event_type`, `event_date`, `points`, `client_id`, `referred_client_id`, `consent_state`, `thank_you_status`, `source`, `metadata`.

### 3.8 `advocacy_score_config` (Phase 09)

Operator-configurable weights, category caps, max score — versioned.

### 3.9 `crm_communication_drafts` (Phase 10)

Staging: `source_type`, `source_id`, `channel`, `template_key`, `draft_body`, `approval_status`, `governed_content_id` (after submit).

### 3.10 `clients.ethnicity` (Phase 08 EXT)

Enum column on existing `clients` table — optional, for festive suggestions only.

---

## 4. Deferred entities (not approved Phase 00)

| Entity | Reason |
|--------|--------|
| `households` / `household_members` | Premature; single-person relationships sufficient for pilot |
| `advisor_work_items` | Virtual queue sufficient per Phase 10.2 |
| `engagement_events` | Timeline projection sufficient initially |
| `crm_relationships` table | `clients.id` is relationship ID in v1 |
| Insurer API integration | Out of scope Phase 07 |

---

## 5. Relationship vs client vs household

| Term | Definition | Phase 00 decision |
|------|------------|-------------------|
| **Client** | `clients` row — portal subject, may be prospect or active | Existing record |
| **Relationship** | CRM operational unit for adviser book management | **Same as `clients.id` in v1** (`relationshipId = clients.id`) |
| **Household** | Multi-person wealth unit | **Deferred** — no forced migration; protection report `householdName` is label only |

When household model is approved later: introduce `households` table, `clients.household_id` nullable FK, Relationship list groups by household — **non-destructive** additive migration.

---

## 6. Canonical read models (not tables)

| Read model | Sources | Phase |
|------------|---------|-------|
| `RelationshipListItem` | clients, appointments, reviews, commitments (counts) | 02 |
| `Relationship360` | clients, discover, publications, roadmap, documents, binder, meetings, tasks | 02 |
| `EngagementTimelineEntry` | audit, meetings, appointments, comms, moments | 02 |
| `AdviserWorkItem` | Phase 10.2 adapters + CRM adapters | 11 |
| `ProtectionPortfolioSummary` | confirmed policy versions | 07 |
| `AdvocacyYearScore` | advocacy_events filtered by year | 09 |

---

## 7. Entity naming reference

| Entity | DB name | API path segment | UI label |
|--------|---------|------------------|----------|
| Relationship | `clients` | `relationships` | Relationship |
| Appointment | `adviser_appointments` | `appointments` | Appointment |
| Commitment | `service_commitments` | `commitments` | Commitment |
| Moment | `relationship_moments` | `moments` | Relationship moment |
| Advocacy event | `advocacy_events` | `advocacy` | Advocacy |
