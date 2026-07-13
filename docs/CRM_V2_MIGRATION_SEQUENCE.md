# CRM V2 — Migration Sequence

**Phase:** 00  
**Rule:** Migrations are **additive** extensions only in implementation phases; **not applied** without operator approval. Each migration ships with diagnostics.

---

## 1. Sequence overview

```text
M01  Phase 01  Feature control seeds (crm_v2_master, crm_v2_pilot_mode)
M02  Phase 03  adviser_appointments CRM lifecycle extension
M03  Phase 03  appointment_participants, appointment_state_events
M04  Phase 06  service_commitments
M05  Phase 07  protection_policies, protection_policy_versions
M06  Phase 08  relationship_moments, adviser_moment_overrides, clients.ethnicity
M07  Phase 09  advocacy_events, advocacy_score_config
M08  Phase 10  crm_communication_drafts
M09  Phase 05  calendar sync metadata extensions (if needed beyond existing columns)
M10  Phase 11  crm_v2_today + adviser_work_queue flag seeds — **implemented** `202606290018` (not applied)
M11  Phase 14  cutover flags seed
```

**No migration in Phase 00, 02, 12, 13.**

Phase 02 uses existing `clients` — read-only APIs only.

---

## 2. Migration detail

### M01 — Phase 01: CRM V2 feature seeds (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql` |
| Table | `platform_feature_controls` INSERT |
| Keys | `crm_v2_master`, `crm_v2_pilot_mode` |
| Default | `enabled = false`, `client_visible = false`, `adviser_visible = true` |
| Applied | **No** — operator Gate G2 approval required |
| Idempotency | `ON CONFLICT (feature_key) DO NOTHING` — no UPDATE |
| Dependency | Requires `platform_feature_controls` (Phase 9A); see `docs/MIGRATION_DEPENDENCY_GRAPH.md` (`202606290001`) |
| Diagnostics | `preflight_202606290001_phase01_crm_v2_feature_controls.sql`, `verify_202606290001_phase01_crm_v2_feature_controls.sql`, `verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql` |

### M01b — Phase 02: Relationships feature seed (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290002_phase02_crm_v2_relationships_feature_control.sql` |
| Table | `platform_feature_controls` INSERT |
| Keys | `crm_v2_relationships` |
| Default | `enabled = false`, `client_visible = false`, `adviser_visible = true` |
| Applied | **No** — operator Gate G3 approval required |
| Idempotency | `ON CONFLICT (feature_key) DO NOTHING` |
| Dependency | After M01 (same table); see `202606290002` in dependency graph |
| Diagnostics | `preflight_202606290002_phase02_crm_v2_relationships_feature_control.sql`, `verify_202606290002_phase02_crm_v2_relationships_feature_control.sql`, `verify_202606290002_phase02_crm_v2_relationships_feature_control_discrepancies.sql` |

### M02b — Phase 03: Appointments adviser feature seed (**applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql` |
| Keys | `crm_v2_appointments_adviser` |
| Applied | **Yes** |
| Diagnostics | `preflight_202606290003_*`, `verify_202606290003_*` |

### M02 — Phase 03: Appointment lifecycle extension (**applied after rerun-safety recovery**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290004_phase03_crm_v2_appointment_core.sql` |
| Table | `adviser_appointments` ALTER + `crm_appointment_*` supporting tables |
| Changes | `crm_lifecycle_status`, `template_key`, `title`, preparation/follow-up state, `version`, transition metadata |
| Data migration | **None** — read-time legacy mapping when `crm_lifecycle_status` IS NULL |
| Applied | **Yes** |
| Rollback | Disable feature; columns/tables retained |
| Risk | Medium — production appointments exist |

**Diagnostics:** `preflight_202606290004_phase03_crm_v2_appointment_core.sql`, `verify_202606290004_phase03_crm_v2_appointment_core.sql`, `verify_202606290004_phase03_crm_v2_appointment_core_discrepancies.sql`

**Recovery note:** Initial apply stopped due to pre-existing trigger `crm_appointment_checklist_items_set_updated_at`; migration was patched with `DROP TRIGGER IF EXISTS` and five `DROP POLICY IF EXISTS` guards, then applied successfully without data deletion or migration-history repair.

### M03 — Phase 03: Appointment participants and audit (**merged into M02 / 202606290004**)
### M03b — Phase 04: Client appointments feature seed (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290005_phase04_crm_v2_appointments_client_feature_control.sql` |
| Keys | `crm_v2_appointments_client` |
| Default | `enabled = false`, `client_visible = false`, `adviser_visible = false` |
| Applied | **No** |
| Idempotency | `ON CONFLICT (feature_key) DO NOTHING` |
| Diagnostics | `preflight_202606290005_*`, `verify_202606290005_*` |


| Item | Detail |
|------|--------|
| Tables | `crm_appointment_participants`, `crm_appointment_state_events`, topics, agenda, checklist |
| RLS | `is_assigned_advisor(client_id)` |
| Note | Delivered in `202606290004` — no separate migration file |

### M04b — Phase 06: Service feature seeds (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290008_phase06_crm_v2_service_feature_control.sql` |
| Keys | `crm_v2_service`, `crm_v2_client_service` |
| Default | `enabled = false`; service `adviser_visible = true`, client service `client_visible = true` |
| Applied | **No** — operator Gate G7 approval required |
| Idempotency | `ON CONFLICT (feature_key) DO NOTHING` |
| Diagnostics | `preflight_202606290008_*`, `verify_202606290008_*`, `verify_202606290008_*_discrepancies.sql` |

### M04 — Phase 06: Service core (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290009_phase06_crm_v2_service_core.sql` |
| Tables | `service_commitments`, `client_service_requests`, `service_commitment_events`, `client_service_request_events` CREATE |
| Indexes | Adviser open (`due_at`), client visible, appointment FK, idempotency, source dedup |
| RLS | `is_assigned_advisor(client_id)` — assignment-scoped |
| Applied | **No** |
| Rollback | Disable flags; schema retained |
| Risk | Low — greenfield |
| Diagnostics | `preflight_202606290009_*`, `verify_202606290009_*`, `verify_202606290009_*_discrepancies.sql` |

### M05 — Phase 07: Protection portfolio (**created, not applied**)

| Item | Detail |
|------|--------|
| File (feature) | `supabase/migrations/202606290010_phase07_crm_v2_protection_feature_control.sql` |
| Keys | `crm_v2_protection_portfolio` (`client_visible = true`, `adviser_visible = true`) |
| File (core) | `supabase/migrations/202606290011_phase07_crm_v2_protection_core.sql` |
| Tables | `protection_policies`, `protection_policy_versions`, `protection_extractions`, `protection_domain_events` |
| Link | `source_document_id` → `documents` (vault authority retained) |
| Applied | **No** — operator Gate G8 approval required |
| Diagnostics | `preflight_202606290010_*`, `verify_202606290010_*`, `preflight_202606290011_*`, `verify_202606290011_*` |
| Rollback | Disable flag; schema retained; PDFs in vault retained |

### M06 — Phase 08: Relationship moments (**implemented, not applied**)

| Item | Detail |
|------|--------|
| File (feature) | `supabase/migrations/202606290012_phase08_crm_v2_relationship_moments_feature_control.sql` |
| Keys | `crm_v2_relationship_moments`, `crm_v2_client_profile` |
| File (core) | `supabase/migrations/202606290013_phase08_crm_v2_relationship_moments_core.sql` |
| Tables | `relationship_moments`, `adviser_moment_overrides`, `festive_holiday_mappings`, `crm_review_rhythm`, `crm_client_preference_updates`, `relationship_moment_events` |
| Column | `clients.ethnicity` nullable enum |
| Seed | `festive_holiday_mappings` reference table (read-only config) |
| Applied | **No** — operator approval required |
| Diagnostics | `preflight_202606290012_*`, `verify_202606290012_*`, `preflight_202606290013_*`, `verify_202606290013_*` |
| Rollback | Disable flags; schema retained |
| Risk | Low — greenfield tables, nullable ethnicity |

### M07 — Phase 09: Advocacy (**created, not applied**)

| Item | Detail |
|------|--------|
| Files | `supabase/migrations/202606290014_phase09_crm_v2_advocacy_feature_control.sql`, `supabase/migrations/202606290015_phase09_crm_v2_advocacy_core.sql` |
| Feature seed (`014`) | `crm_v2_advocacy` — `enabled=false`, `client_visible=true`, `adviser_visible=true` |
| Tables (`015`) | `advocacy_events`, `advocacy_score_config`, `crm_client_advocacy_preferences`, `advocacy_domain_events` |
| Constraint | Events soft-deactivate only (`active=false`); no adviser DELETE; no Promotions Stage 6 |
| FK deps | `clients`, `users`, `adviser_appointments`, `client_service_requests`, `relationship_moments` |
| Applied | **No** — operator approval required |
| Idempotency | `ON CONFLICT DO NOTHING` seeds; `IF NOT EXISTS` / `DROP POLICY IF EXISTS` |
| Diagnostics | `preflight_202606290014_*`, `verify_202606290014_*`, `preflight_202606290015_*`, `verify_202606290015_*` |
| Rollback | Disable `crm_v2_advocacy`; schema retained |
| Risk | Low — greenfield tables |

### M08 — Phase 10: Communication drafts

| Item | Detail |
|------|--------|
| Table | `crm_communication_drafts` |
| FK | Optional `governed_content_id` |
| Rollback | DROP |
| Risk | Low |

### M03c — Phase 05: Google Calendar feature seed (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290006_phase05_crm_v2_google_calendar_feature_control.sql` |
| Keys | `crm_v2_google_calendar` |
| Default | `enabled = false`, `client_visible = false`, `adviser_visible = true` |
| Applied | **No** |
| Diagnostics | `preflight_202606290006_*`, `verify_202606290006_*` |

### M09 — Phase 05: Google Calendar authority core (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290007_phase05_crm_v2_google_calendar_core.sql` |
| Changes | Extend `adviser_calendar_connections`; add `crm_google_oauth_states`; add `crm_google_calendar_event_mappings` |
| Rollback | Disable feature and keep additive schema retained |
| Risk | Medium |
| Diagnostics | `preflight_202606290007_*`, `verify_202606290007_*` |

### M10 — Phase 11: Today feature seeds (**created, not applied**)

| Item | Detail |
|------|--------|
| File | `supabase/migrations/202606290018_phase11_crm_v2_today_feature_control.sql` |
| Keys | `crm_v2_today`, `adviser_work_queue` |
| Default | `enabled = false`; today `adviser_visible = true`, `client_visible = false` |
| Tables | **None** — feature control seeds only |
| Applied | **No** — operator approval required |
| Idempotency | `ON CONFLICT (feature_key) DO NOTHING` |
| Diagnostics | `preflight_202606290018_*`, `verify_202606290018_*`, `verify_202606290018_*_discrepancies.sql` |
| Rollback | Disable flags; no schema to revert |
| Risk | Low — no schema changes |

---

## 3. Migrations explicitly excluded

| Item | Reason |
|------|--------|
| `households` table | Deferred |
| `crm_relationships` table | clients.id sufficient |
| `engagement_events` table | Projection only |
| `advisor_work_items` table | Virtual queue |
| Promotions Stage 6 DROP | 9F.4 observation |
| Rename `advisor_*` columns | Breaking — forbidden |
| Bulk legacy appointment import | Requires operator approval per import batch |

---

## 4. Per-migration artifact checklist

Each implementation migration must include:

```text
supabase/migrations/YYYYMMDDHHMMSS_<name>.sql
supabase/diagnostics/preflight_<name>.sql
supabase/diagnostics/verify_<name>.sql
supabase/diagnostics/verify_<name>_discrepancies.sql
```

Phase 03+ run `npx supabase db push --dry-run` before operator apply.

---

## 5. Index strategy

| Table | Index | Phase |
|-------|-------|-------|
| `adviser_appointments` | `(adviser_user_id, starts_at)` WHERE status active | Exists — verify |
| `service_commitments` | `(adviser_user_id, due_at)` WHERE open | 06 |
| `relationship_moments` | `(adviser_user_id, next_occurrence_date)` WHERE active | 08 |
| `advocacy_events` | `(adviser_user_id, event_date)` | 09 |
| `protection_policy_versions` | `(policy_id, version)` | 07 |

---

## 6. RLS pattern

All new tables use existing helpers:

```sql
-- Adviser: assigned clients only
USING (is_assigned_advisor(client_id))

-- Client: own client_id via owns_client
USING (owns_client(client_id))
```

Admin: service-role APIs only — no broad RLS bypass in adviser routes.

---

## 7. Rollback philosophy

| Tier | Strategy |
|------|----------|
| Feature off | Stop writes; schema retained |
| Migration revert | New down migration or manual SQL documented per phase |
| Cutover rollback | `crm_v2_cutover = false` + legacy routes |
| Data | Never delete client/audit data on rollback |

---

## 8. Dependency order

```text
M01 (flags) before any V2 UI
M02–M03 before appointment UI writes
M04 before service UI writes
M05 before protection verification UI
M06 before moments UI
M07 before advocacy UI
M08 before CRM comms UI
M09 can parallel M02 if column-only
M10 after Today implementation
M11 only after Phase 13 pilot approval
```

---

## 9. Phase 9F.4 interaction

- No migration may DROP `promotions` or `promotion-assets`
- No migration may re-enable `legacy_promotions_write` by default
- CRM migrations must not alter governed_content retirement paths
