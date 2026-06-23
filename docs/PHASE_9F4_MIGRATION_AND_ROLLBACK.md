# Phase 9F.4 — Migration and Rollback (Write Freeze)

## Migration

| File | Purpose |
|------|---------|
| `202606200011_phase9f4_legacy_promotions_write_freeze.sql` | Seed `legacy_promotions_write` (disabled) |

### Preconditions

- `202606200010` applied.
- `platform_feature_controls` and `promotions` exist.

### Apply (operator)

```bash
npx supabase db push
```

Run diagnostics:

- `supabase/diagnostics/preflight_202606200011_phase9f4.sql`
- `supabase/diagnostics/verify_202606200011_phase9f4_legacy_promotions_write_freeze.sql`
- `supabase/diagnostics/verify_202606200011_phase9f4_discrepancies.sql`

## Rollback priority

1. **Application rollback:** deploy previous app build (write guards removed) if needed.
2. **Feature re-enable:** set `legacy_promotions_write.enabled = true` via admin API for emergency adviser mutations.
3. **Do not** drop `promotions`, `promotion-assets`, or `promotion_migration_reviews` in this checkpoint.

### Optional DB rollback (discouraged)

```sql
-- Operator-only: remove seed if migration must be reversed without app deploy
DELETE FROM platform_feature_controls
WHERE feature_key = 'legacy_promotions_write';
```

Removing the migration history row requires explicit DBA procedure — prefer feature-flag rollback.

## Reversibility

Migration is additive (`INSERT … ON CONFLICT DO NOTHING`). No tables, policies, or rows deleted.

## Not in scope

- Asset migration or bucket removal
- Route/UI removal (Stage 4)
- Remote apply in Checkpoint 2 implementation PR
