# Phase 9 Remote Schema Audit

Scope: `202606200001` through `202606200007` on branch `migration-reconciliation`.

This audit enumerates expected schema/runtime objects from each migration for read-only verification. It is used by the dedicated `supabase/diagnostics/verify_202606200*.sql` scripts and `supabase/diagnostics/verify_phase9_migrations.sql`.

## Dependency graph

1. `202606200001_phase9a_compliance_access_architecture.sql`
2. `202606200002_phase9a_publication_hardening.sql` depends on `202606200001`
3. `202606200003_phase9c_meeting_studio.sql` depends on `202606200001` and pre-Phase-9 appointments
4. `202606200004_phase9c_meeting_studio_rls_documentation.sql` depends on `202606200003`
5. `202606200005_phase9d_converted_client_portal.sql` depends on `202606200001`
6. `202606200006_phase9e_communications_governance.sql` depends on `202606200001`
7. `202606200007_phase9e_hardening.sql` depends on `202606200006`

## 202606200001 expected objects

- Enums: `relationship_stage`, `output_audience`, `publication_status` (+ exact label sets)
- `clients.relationship_stage` with default/non-null + index `idx_clients_relationship_stage`
- Table `published_outputs`:
  - columns, nullable/default semantics
  - checks `published_outputs_output_type_check`, `published_outputs_safe_payload_is_object`
  - indexes `idx_published_outputs_client_id`, `idx_published_outputs_client_type_status`, `idx_published_outputs_published_at`, `idx_published_outputs_audience`
  - trigger `published_outputs_set_updated_at`
  - RLS enabled + policies `published_outputs_select_client`, `published_outputs_select_adviser`, `published_outputs_select_admin`
- Table `platform_feature_controls`:
  - defaults for visibility/enabled fields
  - trigger `platform_feature_controls_set_updated_at`
  - RLS enabled + policy `platform_feature_controls_select_admin`
  - seed keys:
    - `raw_client_financial_views`
    - `prospect_readiness_snapshot`
    - `client_published_financial_overview`
    - `client_stress_test_visibility`
    - `adviser_publication_workflow`
    - `insights_and_updates`

## 202606200002 expected objects

- Partial unique index `idx_published_outputs_one_current_published`:
  - exact indexed columns `(client_id, output_type, output_audience)`
  - predicate `publication_status='published' AND withdrawn_at IS NULL AND superseded_at IS NULL`
  - uniqueness semantics
- Comment on that index

## 202606200003 expected objects

- Enums: `meeting_session_status`, `meeting_summary_status` (+ exact labels)
- Tables: `meeting_sessions`, `meeting_session_events`
- `meeting_sessions`:
  - lifecycle columns (`status`, `started_at`, `completed_at`, `summary_status`)
  - linkage columns (`appointment_id`, `published_output_id`)
  - snapshot/summary columns (`summary_payload`, `data_snapshot_version`, `algorithm_version`)
  - JSON constraints and `meeting_type` constraint
  - indexes and trigger `meeting_sessions_set_updated_at`
  - RLS enabled + adviser/admin SELECT policy
- `meeting_session_events`:
  - metadata constraint and indexes
  - RLS enabled + adviser/admin SELECT policy
- Meeting Studio feature-control seeds:
  - `adviser_meeting_studio`
  - `meeting_presentation_mode`
  - `meeting_exact_amount_presentations`
  - `meeting_client_acknowledgements`
  - `meeting_summary_publication`

## 202606200004 expected objects

- Policy comments:
  - `meeting_sessions_select_adviser`
  - `meeting_session_events_select_adviser`
- No client write policy is introduced by the migration.

## 202606200005 expected objects

- `published_outputs_output_type_check` extended values (`client_plan_summary`, `goal_plan_summary`, `meeting_summary`)
- `roadmap_items` columns:
  - `task_owner` default/check
  - `client_visible` default false
  - `client_status_label`, `display_category`
- New table `client_goals`:
  - indexes, trigger `client_goals_set_updated_at`
  - RLS enabled + select/insert/update owner policies
- New table `client_review_submissions`:
  - unique source key (`client_review_submissions_source_key_unique`)
  - index and trigger `client_review_submissions_set_updated_at`
  - RLS enabled + select/insert policies
- Data compatibility probes:
  - duplicate `source_key` rows (must be zero)

## 202606200006 expected objects

- Tables: `governed_content`, `client_notifications`, `communication_preferences`,
  `communication_deliveries`, `binder_exports`, `promotion_migration_reviews`
- Lifecycle/category/audience constraints across governance tables
- Indexes for published/status/retry/unread paths
- Triggers:
  - `governed_content_set_updated_at`
  - `communication_preferences_set_updated_at`
  - `communication_deliveries_set_updated_at`
  - `binder_exports_set_updated_at`
- RLS enabled state:
  - `governed_content`, `client_notifications`, `communication_preferences`,
    `communication_deliveries`, `binder_exports`
- Policies:
  - `client_notifications_select_owner`, `client_notifications_update_owner`
  - `communication_preferences_select_owner`, `communication_preferences_update_owner`
- Feature-control seeds:
  - `adviser_insight_authoring`, `admin_content_approval`, `market_updates`,
    `product_related_content`, `client_in_app_notifications`,
    `client_email_notifications`, `document_event_notifications`,
    `communication_preferences`, `binder_export`, `binder_client_publication`

## 202606200007 expected objects

- Unique idempotency indexes:
  - `idx_client_notifications_idempotent`
  - `idx_communication_deliveries_idempotent`
- Exact predicates on both partial unique indexes
- Hardening comments on:
  - `governed_content`
  - `communication_deliveries`
  - `binder_exports`
  - `promotion_migration_reviews`

## Classification rule

`EXACT_MATCH` requires:

- every required check present
- zero absent
- zero conflicting
- zero unknown

Any migration failing those criteria is classified as `PARTIAL_MATCH`, `CONFLICTING`, `ABSENT`, `UNKNOWN`, or `BLOCKED_BY_DEPENDENCY` by the consolidated rollup.
