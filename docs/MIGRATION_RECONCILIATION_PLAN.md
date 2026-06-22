# Migration Reconciliation Plan

Operator playbook for classifying and resolving schema/history drift.  
**This document does not authorize any remote write.** Execute only after backup and explicit approval.

## Finalised state (2026-06-22)

| Item | Status |
|------|--------|
| Pre-Phase-9 schema vs historical migrations | **EXACT_MATCH** (operator-verified) |
| Additive remediation migrations `202606220001`–`004` | **Removed** — not required |
| Required operator action | **History repair only** for six versions |
| Phase 9 migrations | **Pending** — separate approval window |

See `docs/REMOTE_MIGRATION_EVIDENCE_REVIEW.md` and `docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md`.

**No additive remediation migration is required.**

---

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

## EXACT_MATCH (current pre-Phase-9 state)

**Indicators:** All required checks present; column types/nullability match; policies/triggers/indexes match; migration **not** in history.

**Operator action:**
1. Re-run dedicated verify SQL if uncertain
2. Record operator classification (screenshots acceptable; do not fabricate JSON)
3. **Only then** run `supabase migration repair --status applied <version>` for that version

`migration repair` updates **migration history only**. It does **not** apply schema DDL.

**Exact repair order:**

```text
202606100019 → 202606100020 → 202606100021 → 202606150001 → 202606180001 → 202606180002
```

After all six repairs:

```text
npx supabase migration list
npx supabase db push --dry-run
```

Dry run should begin with Phase 9 (`202606200001`+), not pre-Phase-9 migrations.

---

## PARTIAL_MATCH

**Indicators:** Table exists but policies missing; bucket exists but storage policies missing; columns differ.

**Later action (operator):**
1. Document each missing/differing object from diagnostic SQL
2. Create **additive remediation migration** (new timestamp) that adds only missing pieces
3. Validate remediation on staging
4. Apply remediation + reconcile history for original migration only after full verify

**Do not:** add `IF NOT EXISTS` to historical migration files  
**Do not:** `migration repair` until structural equivalence proven

*(Not applicable to current pre-Phase-9 chain — all six migrations are EXACT_MATCH.)*

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
1. Run dedicated verify SQL on remote
2. Export JSON when available
3. Do not push or repair

---

## History reconciliation order (final)

After pre-Phase-9 structural verification (complete):

1. Repair 019 → 020 → 021 → 150001 → 180001 → 180002 (history only)
2. Confirm `migration list` and `db push --dry-run`
3. Phase 9 apply in separate approved window

Never batch-repair without per-migration verify.

---

## Prohibited shortcuts

- Blind `migration repair` on all pending versions
- Treating `migration repair` as schema application
- Broad `CREATE TABLE IF NOT EXISTS` on historical files to mask drift
- Dropping production objects to unblock push
- Pushing to production without staging proof
- Fabricating diagnostic JSON evidence

---

## Remediation migration naming convention

Only if future drift requires additive fixes:

```
YYYYMMDDHHMM_phase<N>_remediation_<short_description>.sql
```

Content rules:
- Additive only
- Reference `docs/MIGRATION_CHAIN_AUDIT.md` conflict ID
- Include verification comment pointing to diagnostic SQL
