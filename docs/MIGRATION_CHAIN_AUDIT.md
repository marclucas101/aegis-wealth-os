# Migration Chain Audit

Evidence-based inventory of every file under `supabase/migrations/`.  
**Remote state (reported):** history applied through `202606100018`; push failed at `202606100019` (`relation "adviser_profiles" already exists`).

## Legend

| Column | Meaning |
|--------|---------|
| Clean DB | Safe on empty database from migration 001 |
| Existing DB | Safe when prior migrations already applied |
| Destructive | DROP, data loss, or irreversible change |
| Assumes absent | Uses bare `CREATE TABLE` / `CREATE TYPE` without guard |

---

## Applied on remote (through 202606100018)

| Timestamp | Filename | Purpose | Tables | Destructive | Assumes absent |
|-----------|----------|---------|--------|-------------|----------------|
| 202606100001 | extensions_and_enums.sql | Extensions, enums | — | No | Yes (enums) |
| 202606100002 | core_functions.sql | `set_updated_at`, auth helpers | — | No | No (CREATE OR REPLACE) |
| 202606100003 | users_and_clients.sql | Core identity tables | users, clients | No | Yes |
| 202606100004 | discover_and_profiles.sql | Discover + client profiles | discover_profiles, client_profiles | No | Yes |
| 202606100005 | financial_and_shield.sql | Financial + shield | financial_profiles, shield_scores | No | Yes |
| 202606100006 | pillar_and_stress.sql | Pillar + stress | pillar_scores, stress_tests | No | Yes |
| 202606100007 | roadmap_and_reviews.sql | Roadmap, reviews, blueprints | roadmap_items, annual_reviews, wealth_blueprints | No | Yes |
| 202606100008 | documents_and_notes.sql | Document vault | documents, advisor_notes | No | Yes |
| 202606100009 | rls_policies.sql | RLS on core tables | — (policies) | No | Yes (policies) |
| 202606100010 | storage_policies.sql | Storage buckets/policies | storage | No | Partial ON CONFLICT |
| 202606100011 | audit_logs.sql | Audit log table | audit_logs | No | Yes |
| 202606100012 | advisor_notes_note_type.sql | Note type column | advisor_notes | No | ALTER additive |
| 202606100013 | advisor_tasks.sql | Adviser tasks | advisor_tasks | No | Yes |
| 202606100014 | fix_users_role_self_escalation.sql | RLS fix C-1 | users | No | Policy replace |
| 202606100015 | client_budgets.sql | Budget optimiser | client_budgets | No | Yes |
| 202606100016 | promotions.sql | Legacy promotions | promotions | No | Yes |
| 202606100017 | adviser_phone.sql | users.phone | users | No | IF NOT EXISTS |
| 202606100018 | adviser_feedback.sql | Feedback + client prompt cols | adviser_feedback, clients cols | No | Mixed |

---

## Pending on remote (reconciliation scope)

### 202606100019 — adviser_profiles.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Adviser public profiles + adviser-photos storage |
| **Tables** | `adviser_profiles` |
| **Columns** | 11 columns (see verify SQL) |
| **Indexes** | PK on `adviser_user_id` |
| **Constraints** | FK → users; `years_experience >= 0` check |
| **Triggers** | `adviser_profiles_set_updated_at` |
| **Functions** | `adviser_id_from_storage_path(text)` |
| **RLS** | Enabled; 4 policies (select/insert/update/delete) |
| **Storage** | Bucket `adviser-photos`; 4 storage policies |
| **Feature seeds** | None |
| **Depends on** | 002 (set_updated_at), 003 (users), 009 (is_admin, is_advisor) |
| **Clean DB** | Safe |
| **Existing DB** | **UNSAFE if table exists** — bare `CREATE TABLE` |
| **Destructive** | No |
| **Assumes absent** | **Yes** — table, policies, function |
| **Drift risk** | **HIGH** — remote reports table exists; history not applied |

### 202606100020 — google_calendar_booking.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Google Calendar OAuth + appointments |
| **Tables** | adviser_calendar_connections, adviser_calendar_settings, adviser_appointments |
| **Enums** | adviser_appointment_status |
| **Indexes** | 3 btree + 1 partial unique + GiST exclude overlap |
| **RLS** | connections deny-all; settings + appointments policies |
| **Depends on** | 003, 002, btree_gist extension |
| **Clean DB** | Safe |
| **Existing DB** | Unsafe if any table/type exists |
| **Assumes absent** | Yes (bare CREATE) |

### 202606100021 — phase6f_performance_indexes.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | My Clients / feedback performance |
| **Indexes** | 3 partial indexes (IF NOT EXISTS) |
| **Depends on** | adviser_feedback, clients, discover_profiles |
| **Clean DB** | Safe |
| **Existing DB** | Safe (IF NOT EXISTS) |
| **Assumes absent** | No |

### 202606150001 — clients_user_id_unique.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | One client row per auth user |
| **Indexes** | clients_user_id_unique |
| **Depends on** | clients |
| **Clean DB** | Safe |
| **Existing DB** | Safe (IF NOT EXISTS; may already exist manually) |
| **Assumes absent** | No |

### 202606180001 — phase8a_client_birthday_reminders.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Birthday reminders |
| **Columns** | clients.date_of_birth; advisor_tasks source_key, dismissed_at, metadata |
| **Constraints** | DOB not future; task_type check extended |
| **Indexes** | source_key unique; birthday partial |
| **Depends on** | clients, advisor_tasks |
| **Clean DB** | Safe |
| **Existing DB** | Mostly safe (IF NOT EXISTS / DROP IF EXISTS constraint) |

### 202606180002 — phase8b_adviser_created_appointments.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Adviser-created / external appointments |
| **Columns** | 12 new columns on adviser_appointments |
| **Depends on** | **202606100020** (adviser_appointments must exist) |
| **Clean DB** | Safe after 020 |
| **Existing DB** | Safe (IF NOT EXISTS columns) |
| **Blocked if** | 020 not applied |

### 202606200001 — phase9a_compliance_access_architecture.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Relationship stages, published outputs, feature controls |
| **Enums** | relationship_stage, output_audience, publication_status |
| **Tables** | published_outputs, platform_feature_controls |
| **RLS** | published_outputs client/adviser/admin select; feature controls admin |
| **Seeds** | 6 feature control rows |
| **Depends on** | clients, helper functions |
| **Clean DB** | Safe |
| **Existing DB** | Mixed — IF NOT EXISTS on tables; guarded enums |

### 202606200002 — phase9a_publication_hardening.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | One current published output per client/type/audience |
| **Indexes** | idx_published_outputs_one_current_published |
| **Depends on** | **202606200001** |
| **Clean DB** | Safe |
| **Existing DB** | Safe (IF NOT EXISTS) |

### 202606200003 — phase9c_meeting_studio.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Meeting Studio sessions + events |
| **Tables** | meeting_sessions, meeting_session_events |
| **Enums** | meeting_session_status, meeting_summary_status |
| **RLS** | Adviser/admin SELECT only |
| **Seeds** | 5 feature controls |
| **Depends on** | **202606200001**, **202606100020** (appointment_id FK), relationship_stage |
| **Clean DB** | Safe |
| **Existing DB** | IF NOT EXISTS tables |

### 202606200004 — phase9c_meeting_studio_rls_documentation.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | COMMENT ON POLICY only |
| **Depends on** | **202606200003** policies must exist |
| **Destructive** | No |
| **Existing DB** | Safe |

### 202606200005 — phase9d_converted_client_portal.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Client goals, review submissions, roadmap presentation |
| **Tables** | client_goals, client_review_submissions |
| **Alters** | published_outputs output_type check; roadmap_items columns |
| **Depends on** | **202606200001**, roadmap_items |
| **Destructive** | DROP/REPLACE constraint on published_outputs |

### 202606200006 — phase9e_communications_governance.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Governed communications layer |
| **Tables** | governed_content, client_notifications, communication_preferences, communication_deliveries, binder_exports, promotion_migration_reviews |
| **RLS** | Enabled; limited client policies on notifications/preferences |
| **Seeds** | 10 feature controls |
| **Depends on** | **202606200001**, promotions (FK on migration reviews) |
| **Clean DB** | Safe |
| **Existing DB** | IF NOT EXISTS tables |

### 202606200007 — phase9e_hardening.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Idempotency indexes + table comments |
| **Indexes** | 2 unique partial indexes |
| **Depends on** | **202606200006** |
| **Clean DB** | Safe |
| **Existing DB** | Safe (IF NOT EXISTS) |

### 202606200008 — phase9f_scheduled_publishing.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Scheduled publishing automation — job runs, item evidence, feature control |
| **Tables** | `automation_job_runs`, `automation_job_items` |
| **Indexes** | Partial unique active-run index + history indexes |
| **RLS** | Enabled; no client/adviser policies |
| **Seeds** | `scheduled_content_automation` (disabled) |
| **Depends on** | **202606200007**, `platform_feature_controls` |
| **Clean DB** | Safe |
| **Existing DB** | Safe (IF NOT EXISTS) |

### 202606200009 — phase9f2_lifecycle_notifications.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Lifecycle notification columns, metadata, idempotency index on `client_notifications` |
| **Tables altered** | `client_notifications` (additive columns only) |
| **Indexes** | `idx_client_notifications_lifecycle_idempotent`, `idx_client_notifications_lifecycle_event` |
| **RLS** | Unchanged — policies from 006 remain |
| **Seeds** | None (reuses `document_event_notifications` from 006) |
| **Depends on** | **202606200008**, `client_notifications` from 006 |
| **Clean DB** | Safe |
| **Existing DB** | Safe (IF NOT EXISTS) |

### 202606200010 — phase9f3_binder_pdf_client_vault.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Binder PDF generation metadata, publication linkage, private `binder-exports` storage bucket |
| **Tables altered** | `binder_exports` (additive columns, CHECK constraints, indexes) |
| **Storage** | Bucket `binder-exports` (private, PDF-only); no authenticated storage policies |
| **Indexes** | `idx_binder_exports_generation_idempotent`, `idx_binder_exports_lineage_version`, `idx_binder_exports_client_status`, `idx_binder_exports_client_lineage`, `idx_binder_exports_published_document`, `idx_binder_exports_client_published_current` |
| **RLS** | Unchanged — `binder_exports` service-role only from 006 |
| **Seeds** | None (reuses `binder_export`, `binder_client_publication` from 006) |
| **Depends on** | **202606200009**, `binder_exports`, `documents` |
| **Clean DB** | Safe |
| **Existing DB** | Safe (IF NOT EXISTS); legacy rows backfill `binder_lineage_id = id`, `generation_status = legacy_manifest` |

### 202606200011 — phase9f4_legacy_promotions_write_freeze.sql

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Legacy Promotions write freeze feature control |
| **Tables** | None |
| **Seeds** | `legacy_promotions_write` (disabled, adviser-visible) |
| **Depends on** | **202606200010**, `platform_feature_controls` |
| **Clean DB** | Safe |
| **Existing DB** | Safe (`ON CONFLICT DO NOTHING`) |
| **Destructive** | No |

---

## Historical migration edit policy

**Default:** preserve all existing migration files.  
**No broad IF NOT EXISTS retrofits** on 019/020 — would conceal structural drift.  
**Remediation:** additive migrations after drift verification (see `MIGRATION_RECONCILIATION_PLAN.md`).

## Proposed edits

| File | Edit | Justification |
|------|------|---------------|
| None at this time | — | Pending remote diagnostic evidence |
