# Phase 9F.2 Migration Audit — `202606200009`

## Version and ordering

| Field | Value |
|-------|-------|
| Version | `202606200009` |
| Filename | `202606200009_phase9f2_lifecycle_notifications.sql` |
| Predecessor | `202606200008_phase9f_scheduled_publishing.sql` |
| Unique | Yes — no other migration uses `202606200009` |
| Historical migrations modified | None |

## Objects changed

Migration alters existing table `client_notifications` only. No new tables. No destructive DDL.

### Columns added

| Column | Type | Nullable | Default | Constraint |
|--------|------|----------|---------|------------|
| `lifecycle_event` | `TEXT` | YES | none | none |
| `source_entity_type` | `TEXT` | YES | none | none |
| `source_lifecycle_version` | `TEXT` | YES | none | none |
| `idempotency_key` | `TEXT` | YES | none | unique via partial index |
| `metadata` | `JSONB` | NO | `'{}'::jsonb` | none |

All new columns use `ADD COLUMN IF NOT EXISTS` — safe re-run on staging.

### Indexes added

| Index | Type | Columns | Predicate |
|-------|------|---------|-----------|
| `idx_client_notifications_lifecycle_idempotent` | UNIQUE | `idempotency_key` | `WHERE idempotency_key IS NOT NULL` |
| `idx_client_notifications_lifecycle_event` | non-unique | `lifecycle_event`, `created_at DESC` | `WHERE lifecycle_event IS NOT NULL` |

Existing Phase 9E indexes preserved:

- `idx_client_notifications_client`
- `idx_client_notifications_unread`
- `idx_client_notifications_idempotent` (Phase 9E hardening)

### Comments

| Object | Comment |
|--------|---------|
| `client_notifications.lifecycle_event` | Phase 9F.2 governed lifecycle event name |
| `client_notifications.idempotency_key` | SHA-256 hex digest of canonical lifecycle tuple |
| `client_notifications` (table) | Phase 9E/9F.2 client in-app notifications |

### CHECK constraints

No new CHECK constraints on lifecycle columns. Existing `client_notifications_type_check` unchanged.

### RLS impact

**No policy changes.** Migration does not `CREATE POLICY`, `DROP POLICY`, or `ALTER POLICY`.

Existing policies from `202606200006`:

- `client_notifications_select_owner` — SELECT for authenticated client owner
- `client_notifications_update_owner` — UPDATE (mark read) for owner

RLS remains enabled. Clients cannot INSERT notifications. Advisers have no notification policies.

### Feature-control dependency

Lifecycle notifications reuse `document_event_notifications` seeded in `202606200006` (`enabled: true`). Migration 009 does not seed or alter feature controls.

### Existing-row compatibility

| Scenario | Outcome |
|----------|---------|
| Pre-009 rows | Valid — new columns NULL except `metadata` receives default `{}` on insert only; existing rows get `metadata = '{}'` when column added with NOT NULL DEFAULT |
| NULL `idempotency_key` | Allowed — partial unique index excludes NULL |
| Duplicate NULL keys | Allowed — partial index does not constrain |
| Duplicate non-null `idempotency_key` | **Would block index creation** — preflight warns; clean installs have zero rows with column absent |

### Idempotency index safety

Before first apply, `idempotency_key` column does not exist — no duplicate risk. After apply, application stores SHA-256 hex keys (64 chars) via service layer; collisions are cryptographically negligible.

### Sensitive data

Migration does not introduce content bodies, financial values, emails, or signed URLs into schema. `metadata` defaults to empty object; application allowlists keys at write time.

### Destructive operations

None. No `DROP`, `TRUNCATE`, or `ALTER COLUMN ... DROP`.

## Rollback order (staging only)

Documented in migration file:

1. `DROP INDEX IF EXISTS idx_client_notifications_lifecycle_event`
2. `DROP INDEX IF EXISTS idx_client_notifications_lifecycle_idempotent`
3. `ALTER TABLE client_notifications DROP COLUMN` (metadata, idempotency_key, source_lifecycle_version, source_entity_type, lifecycle_event)

Application code rolled back to pre-9F.2 tag if columns absent. Phase 9E idempotent index on `(client_id, notification_type, reference_type, reference_id)` remains.

## Diagnostics

| File | Purpose |
|------|---------|
| `preflight_202606200009_phase9f2.sql` | Pre-apply readiness probes |
| `verify_202606200009_phase9f2_lifecycle_notifications.sql` | Post-apply schema verification + rollup |
| `verify_202606200009_phase9f2_discrepancies.sql` | Discrepancy-only view |
| `phase9f2_202606200009_resolved_core.sql` | Shared inventory |

## Verdict

Migration is additive, ordering-correct, and compatible with existing notification rows. Safe to apply after Phase 9F.1 (`202606200008`) and Phase 9E communications stack.
