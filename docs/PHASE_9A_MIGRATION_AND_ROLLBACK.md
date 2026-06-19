# Phase 9A — Migration and Rollback

## Migration file

```
supabase/migrations/202606200001_phase9a_compliance_access_architecture.sql
```

**Do not apply automatically to production.** Apply via controlled Supabase migration process.

---

## Schema changes (additive)

### Enums

- `relationship_stage`
- `output_audience`
- `publication_status`

### Columns

- `clients.relationship_stage` — backfilled from legacy `client_status`

### Tables

- `published_outputs` — client-safe publication store
- `platform_feature_controls` — server-side feature kill switches

### Indexes

- `idx_clients_relationship_stage`
- `idx_published_outputs_client_id`
- `idx_published_outputs_client_type_status`
- `idx_published_outputs_published_at`
- `idx_published_outputs_audience`

### RLS

- `published_outputs_select_client`
- `published_outputs_select_adviser`
- `published_outputs_select_admin`
- `platform_feature_controls_select_admin`

---

## Backfill mapping

| Legacy `client_status` | `relationship_stage` |
|------------------------|----------------------|
| `prospect` | `prospect` |
| `onboarding` | `fact_find_complete` |
| `active` | `active_client` |
| `review_due` | `active_client` |
| `archived` | `inactive_client` |

Legacy `client_status` column is **not** removed.

---

## Production apply steps

1. Take database backup
2. Apply migration in staging; run `npm run qa:phase9a-access`
3. Verify feature control seed rows exist
4. Confirm client APIs return envelope (not raw shield) with defaults
5. Apply to production in maintenance window
6. Smoke-test client login, adviser Phase 8C views, appointments

---

## Rollback procedure

### Application rollback (immediate, no DB change)

1. Deploy previous application version **or**
2. Admin sets `raw_client_financial_views.enabled = true` via `/api/admin/feature-controls` (emergency only — compliance risk)
3. Disable client features via kill switches without affecting adviser access

### Database rollback (if required)

```sql
-- 1. Drop RLS policies
DROP POLICY IF EXISTS published_outputs_select_client ON published_outputs;
DROP POLICY IF EXISTS published_outputs_select_adviser ON published_outputs;
DROP POLICY IF EXISTS published_outputs_select_admin ON published_outputs;
DROP POLICY IF EXISTS platform_feature_controls_select_admin ON platform_feature_controls;

-- 2. Drop new tables
DROP TABLE IF EXISTS published_outputs;
DROP TABLE IF EXISTS platform_feature_controls;

-- 3. Drop column (only if no production data depends on it)
ALTER TABLE clients DROP COLUMN IF EXISTS relationship_stage;

-- 4. Drop enums (only when no dependencies remain)
DROP TYPE IF EXISTS publication_status;
DROP TYPE IF EXISTS output_audience;
DROP TYPE IF EXISTS relationship_stage;
```

**Note:** Rollback drops publication history. Export `published_outputs` before rollback if needed.

---

## Pre-migration application compatibility

Application code tolerates missing `relationship_stage` column:

- `fetchClientByUserId` falls back to `CLIENT_COLUMNS_BASE` on PostgreSQL error `42703`
- `resolveRelationshipStage` derives stage from legacy `status` when column absent

---

## Feature control defaults (seeded)

| Key | enabled | client_visible | adviser_visible |
|-----|---------|----------------|-----------------|
| `raw_client_financial_views` | false | false | true |
| `prospect_readiness_snapshot` | true | true | true |
| `client_published_financial_overview` | true | true | true |
| `client_stress_test_visibility` | false | false | true |
| `adviser_publication_workflow` | true | false | true |
| `insights_and_updates` | true | true | true |

---

## Post-apply verification SQL

Run in staging after applying `202606200001` and `202606200002`:

```sql
-- Relationship stage backfill complete
SELECT status, relationship_stage, COUNT(*)
FROM clients
GROUP BY status, relationship_stage
ORDER BY status;

-- No null relationship_stage
SELECT COUNT(*) AS null_stages FROM clients WHERE relationship_stage IS NULL;

-- Feature controls seeded (fail-closed defaults)
SELECT feature_key, enabled, client_visible, adviser_visible
FROM platform_feature_controls
ORDER BY feature_key;

-- RLS enabled on new tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('published_outputs', 'platform_feature_controls');

-- Unique current-publication index present
SELECT indexname FROM pg_indexes
WHERE indexname = 'idx_published_outputs_one_current_published';

-- Sample: draft not visible via client RLS policy semantics
-- (authenticated client SELECT should return zero rows for draft)
SELECT publication_status, COUNT(*) FROM published_outputs GROUP BY publication_status;
```

### Enum rollback limitation

PostgreSQL cannot `DROP TYPE` for `relationship_stage`, `output_audience`, or `publication_status` while columns or tables reference them. Rollback requires dropping dependent tables/columns first (see rollback procedure above). Enum values cannot be removed in-place without recreating the type.
