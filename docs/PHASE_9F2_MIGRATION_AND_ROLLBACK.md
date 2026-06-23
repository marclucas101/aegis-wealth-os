# Phase 9F.2 Migration and Rollback

## Migration

**Version:** `202606200009_phase9f2_lifecycle_notifications.sql`

**Adds to `client_notifications`:**

| Column | Type | Purpose |
|--------|------|---------|
| `lifecycle_event` | TEXT NULL | Event name for operational queries |
| `source_entity_type` | TEXT NULL | document / governed_content / etc. |
| `source_lifecycle_version` | TEXT NULL | Transition token (ISO timestamp or status) |
| `idempotency_key` | TEXT NULL | Deterministic dedupe key |
| `metadata` | JSONB DEFAULT `{}` | Allowlisted destination metadata |

**Indexes:**

- `idx_client_notifications_lifecycle_idempotent` — UNIQUE on `idempotency_key` WHERE NOT NULL
- `idx_client_notifications_lifecycle_event` — operational listing

## Safety

- Additive only; existing rows remain valid (NULL new columns)
- No CHECK constraint changes required
- No destructive DDL
- RLS policies unchanged

## Rollback (staging only)

```sql
DROP INDEX IF EXISTS idx_client_notifications_lifecycle_event;
DROP INDEX IF EXISTS idx_client_notifications_lifecycle_idempotent;
ALTER TABLE client_notifications
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS source_lifecycle_version,
  DROP COLUMN IF EXISTS source_entity_type,
  DROP COLUMN IF EXISTS lifecycle_event;
```

Application code rolled back to Phase 9F.1 tag if lifecycle columns absent (legacy idempotent index still applies).

## Dry-run

Run `npx supabase db push --dry-run` — should list only `202606200009` as pending. Do not execute real push without staging validation.
