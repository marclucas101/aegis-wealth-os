# Migration History Repair Rollback

Rollback guidance when pre-Phase-9 **migration history** was repaired in error.  
**No additive remediation migrations** were applied for this reconciliation — remote schema already matched historical files.

## General principles

| Principle | Guidance |
|-----------|----------|
| Backup | Full logical backup before any history repair |
| History vs schema | `migration repair` changes `schema_migrations` only — it does **not** undo or apply DDL |
| Schema rollback | Requires restore from backup or explicit forward-fix migration |
| Feature flags | Prefer disabling features in app config over schema tear-down |

---

## Reverting incorrect history repair

If a version was marked applied in `schema_migrations` but should remain pending:

```text
Human only (staging first):
  supabase migration repair --status reverted 202606180002
  supabase migration repair --status reverted 202606180001
  supabase migration repair --status reverted 202606150001
  supabase migration repair --status reverted 202606100021
  supabase migration repair --status reverted 202606100020
  supabase migration repair --status reverted 202606100019
```

Revert in **reverse** of the apply order if multiple versions were repaired incorrectly.

Repairing history **does not** change remote schema. If schema was modified separately, coordinate schema rollback independently.

---

## Removed reconciliation migrations (202606220001–004)

These additive files were **removed from the repository** because operator verification proved EXACT_MATCH against the original historical migrations. They were never required for the linked Supabase project.

If similar files are reintroduced in future drift scenarios:

| Change type | Reversible? | Notes |
|-------------|-------------|-------|
| New indexes | Yes | `DROP INDEX` |
| New constraints | Partial | Validate data before drop |
| New columns | Partial | Avoid `DROP COLUMN` with populated data |
| New tables | Yes (empty only) | Never drop populated production tables casually |

**Recommended rollback:** disable affected features in application; retain schema unless compliance requires removal.

---

## Backup requirement

| Environment | Minimum backup |
|-------------|----------------|
| Staging | Point-in-time or full dump before history repair |
| Production | PITR + verified restore test before any history change |

Restore from backup is the only guaranteed full rollback when schema was modified outside history repair.

---

## Post-rollback validation

After reverting history entries:

```text
npx supabase migration list
npx supabase db push --dry-run
```

Confirm pre-Phase-9 versions show as pending again and dry-run behaviour matches expectations.
