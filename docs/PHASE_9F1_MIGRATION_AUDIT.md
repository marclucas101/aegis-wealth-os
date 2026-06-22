# Phase 9F.1 Migration Audit — 202606200008

**File:** `supabase/migrations/202606200008_phase9f_scheduled_publishing.sql`  
**Depends on:** `202606200007_phase9e_hardening.sql`  
**Version uniqueness:** Next after `202606200007`; no duplicate timestamp in chain.

---

## Tables

### `automation_job_runs`

Operational job-run records (no content bodies, emails, or financial values).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `job_name` | TEXT | — | CHECK: `scheduled_publishing` only |
| `trigger_source` | TEXT | — | CHECK: `scheduler`, `admin_manual` |
| `status` | TEXT | `'running'` | CHECK: `running`, `success`, `partial`, `failed`, `skipped` |
| `started_at` | TIMESTAMPTZ | `now()` | |
| `completed_at` | TIMESTAMPTZ | null | |
| `items_examined` | INTEGER | `0` | |
| `items_succeeded` | INTEGER | `0` | |
| `items_skipped` | INTEGER | `0` | |
| `items_failed` | INTEGER | `0` | |
| `sanitized_error` | TEXT | null | |
| `metadata` | JSONB | `'{}'` | Sanitized server-side |
| `created_at` | TIMESTAMPTZ | `now()` | |

### `automation_job_items`

Per-item outcomes (reference UUID + sanitized reason only).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `job_run_id` | UUID | — | FK → `automation_job_runs(id)` ON DELETE CASCADE |
| `reference_type` | TEXT | — | CHECK: `governed_content` |
| `reference_id` | UUID | — | |
| `outcome` | TEXT | — | CHECK: `succeeded`, `skipped`, `failed` |
| `sanitized_reason` | TEXT | null | |
| `created_at` | TIMESTAMPTZ | `now()` | |

---

## Constraints

| Name | Table | Purpose |
|------|-------|---------|
| `automation_job_runs_job_name_check` | runs | Single allowed job name |
| `automation_job_runs_trigger_source_check` | runs | Scheduler vs admin manual |
| `automation_job_runs_status_check` | runs | Lifecycle statuses |
| `automation_job_items_reference_type_check` | items | Governed content only |
| `automation_job_items_outcome_check` | items | Item outcomes |
| `automation_job_items_job_run_id_fkey` | items | Parent run FK |

---

## Indexes

| Index | Type | Definition |
|-------|------|------------|
| `idx_automation_job_runs_single_active` | **Partial UNIQUE** | `(job_name) WHERE status = 'running'` — one active run per job |
| `idx_automation_job_runs_job_started` | B-tree | `(job_name, started_at DESC)` — admin history |
| `idx_automation_job_items_run` | B-tree | `(job_run_id)` — item lookup |

---

## RLS

| Table | RLS | Policies |
|-------|-----|----------|
| `automation_job_runs` | **Enabled** | **None** — intentional; service-role writes; admin reads via sanitized API |
| `automation_job_items` | **Enabled** | **None** — same |

No client or adviser policies are created.

---

## Feature control seed

```sql
INSERT ... ('scheduled_content_automation', false, false, true, ...)
ON CONFLICT (feature_key) DO NOTHING;
```

- Default: **disabled**
- `client_visible`: false
- `adviser_visible`: true (admin visibility for control UI only)

---

## Comments

- `automation_job_runs`: documents RLS + service-role + admin API read path
- `automation_job_items`: documents sanitized reasons only

---

## Dependencies

- `platform_feature_controls` (Phase 9A) — feature seed target
- `gen_random_uuid()` / `now()` — core extensions (Phase 9A baseline)
- Phase 9E `governed_content` — logical dependency for job purpose (not FK)

---

## Rollback order

1. Disable `scheduled_content_automation`
2. `DROP TABLE automation_job_items`
3. `DROP TABLE automation_job_runs`
4. `DELETE FROM platform_feature_controls WHERE feature_key = 'scheduled_content_automation'`
5. Remove `202606200008` from `supabase_migrations.schema_migrations` if repairing history

See [PHASE_9F1_MIGRATION_AND_ROLLBACK.md](./PHASE_9F1_MIGRATION_AND_ROLLBACK.md).

---

## Diagnostics

| File | Purpose |
|------|---------|
| `verify_202606200008_phase9f_scheduled_publishing.sql` | Post-apply schema verification + strict rollup |
| `preflight_202606200008_phase9f.sql` | Pre-apply readiness probes |
