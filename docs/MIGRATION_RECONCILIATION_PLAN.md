# Migration Reconciliation Plan

Operator playbook for classifying and resolving schema/history drift.  
**This document does not authorize any remote write.** Execute only after backup and explicit approval.

## Classifications

| Status | Meaning |
|--------|---------|
| **ABSENT** | Expected objects not present remotely |
| **EXACT_MATCH** | All expected objects present and structurally equivalent |
| **PARTIAL_MATCH** | Some objects present; others missing or differ |
| **CONFLICTING** | Objects exist but definitions conflict with migration |
| **BLOCKED_BY_DEPENDENCY** | Upstream pending migration not EXACT_MATCH |
| **UNKNOWN** | Insufficient diagnostic evidence |

---

## ABSENT

**Indicators:** Rollup checks all `present = false`; table/column queries return no rows.

**Later action (operator):**
1. Confirm migration not in `supabase_migrations.schema_migrations`
2. Validate on clean local or hosted staging project (`db reset`)
3. Apply migration normally via `supabase db push` on approved staging target

**Do not:** assume absence without running `verify_pending_migrations.sql`

---

## EXACT_MATCH

**Indicators:** All required checks present; column types/nullability match; policies/triggers/indexes match; migration **not** in history.

**Later action (operator):**
1. Re-run full `verify_202606100019_adviser_profiles.sql` (or per-migration verify)
2. Export results and attach to change record
3. **Only then** consider `supabase migration repair --status applied <version>` for that version
4. Re-run `supabase migration list` and dry-run before next push

**Do not:** repair based on table existence alone

---

## PARTIAL_MATCH

**Indicators:** Table exists but policies missing; bucket exists but storage policies missing; columns differ.

**Example risk (019):** `adviser_profiles` exists from manual SQL but RLS policies or `adviser-photos` policies differ.

**Later action (operator):**
1. Document each missing/differing object from diagnostic SQL
2. Create **additive remediation migration** (new timestamp) that adds only missing pieces
3. Validate remediation on staging
4. Apply remediation + reconcile history for original migration only after full verify

**Do not:** add `IF NOT EXISTS` to historical `202606100019` file  
**Do not:** `migration repair` until structural equivalence proven

---

## CONFLICTING

**Indicators:** Column types differ; constraint definitions differ; incompatible enum values; wrong FK target.

**Later action (operator):**
1. **Stop** — do not push or repair
2. Document exact conflict (expected vs actual from diagnostics)
3. Design dedicated transformation migration or manual DBA script
4. Full backup; compliance approval
5. Test transformation on clone/staging

---

## BLOCKED_BY_DEPENDENCY

**Indicators:** Classifier marks migration because upstream pending migration is not EXACT_MATCH.

**Later action:** Resolve upstream migration first (see dependency graph).

---

## UNKNOWN

**Indicators:** No diagnostic export; partial SQL results only.

**Later action:**
1. Run `verify_pending_migrations.sql` section O on remote
2. Export JSON for `classify-migration-drift.ts`
3. Do not push or repair

---

## Specific guidance: 202606100019 failure

Remote error: `relation "adviser_profiles" already exists`.

| Scenario | Classification | Operator path |
|----------|----------------|---------------|
| Table + all 4 RLS policies + bucket + 4 storage policies + function + trigger | EXACT_MATCH | Repair 019 after verify |
| Table only, missing policies/bucket | PARTIAL_MATCH | Remediation migration |
| Table with different columns | CONFLICTING | Transformation required |
| Table absent in diagnostics but error seen | UNKNOWN | Re-check schema/search_path |

---

## Remediation migration naming convention

```
YYYYMMDDHHMM_phase<N>_remediation_<short_description>.sql
```

Content rules:
- Additive only (`CREATE POLICY`, `ALTER TABLE ADD COLUMN`, etc.)
- Reference docs/MIGRATION_CHAIN_AUDIT.md conflict ID
- Include verification comment pointing to diagnostic SQL

---

## History reconciliation order

After all pending migrations are structurally verified:

1. Repair/mark 019 only if EXACT_MATCH or after remediation proves equivalence
2. Dry-run push for 020
3. Continue timestamp order through 007
4. Never batch-repair without per-migration verify

---

## Prohibited shortcuts

- Blind `migration repair` on all pending versions
- Broad `CREATE TABLE IF NOT EXISTS` on 019/020
- Dropping `adviser_profiles` to unblock push
- Pushing to production without staging proof
- Using production as drift experimentation target
