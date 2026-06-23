# Phase 9F.3 Deployment and Enablement

## Current state (2026-06-24)

- Migration `202606200010_phase9f3_binder_pdf_client_vault.sql` is **already applied** on remote
- `npx supabase db push --dry-run` reports: **Remote database is up to date**
- Application deploy and feature enablement remain

## Remaining deployment sequence

### 1. Schema contract (read-only SQL Editor)

Run `supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql`

**Expected:**

```text
65 present | 0 absent | 0 conflicting | 0 unknown | EXACT_MATCH
```

### 2. Zero discrepancy rows

Run `supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql`

**Expected:** zero rows

### 3. Migration history

```bash
npx supabase migration list
```

Confirm `202606200010` recorded on remote.

### 4. Commit and push Phase 9F.3 branch

```bash
git push origin phase-9f3-binder-client-vault
```

### 5. Merge into main

**Operator approval required.** Do not merge without sign-off (`docs/PHASE_9F3_RELEASE_SIGNOFF.md`).

### 6. Deploy application

Deploy build after merge so code matches applied schema.

### 7. Leave client publication disabled

Default: `binder_client_publication` = false

### 8. Enable adviser binder generation first

```sql
UPDATE platform_feature_controls SET enabled = true WHERE feature_key = 'binder_export';
```

### 9. Execute adviser-only acceptance tests

Tests 1–6 in `docs/PHASE_9F3_FINAL_MANUAL_ACCEPTANCE_TESTS.md`

### 10. Enable publication

```sql
UPDATE platform_feature_controls SET enabled = true WHERE feature_key = 'binder_client_publication';
```

### 11. Execute client-vault tests

Tests 7–14

### 12. Enable document lifecycle notifications last

```sql
UPDATE platform_feature_controls SET enabled = true WHERE feature_key = 'document_event_notifications';
```

### 13. Monitor audits and errors

Watch for `binder_generation_failed`, `binder_publication_consistency_risk`, `binder_storage_orphan_risk`, `binder_lifecycle_notification_failed`.

### 14. Complete acceptance sign-off

Fill `docs/PHASE_9F3_RELEASE_SIGNOFF.md`.

---

## Feature enablement order

| Order | Feature | Effect |
|-------|---------|--------|
| 1 | `binder_export` | Adviser generation, list, download |
| 2 | `binder_client_publication` | Publish, withdraw, client vault access |
| 3 | `document_event_notifications` | Lifecycle in-app notifications |

**Policy:** Already-published binders remain client-readable when `binder_client_publication` is disabled. Use withdrawal to revoke.

---

## Rollback guidance

### Application rollback

- Revert to prior application deployment
- Schema remains at `202606200010` (additive migration — no routine destructive rollback)
- Disable features immediately if rolling back code

### Disable `binder_export`

```sql
UPDATE platform_feature_controls SET enabled = false WHERE feature_key = 'binder_export';
```

Blocks new generation. Existing ready rows and storage objects preserved.

### Disable `binder_client_publication`

```sql
UPDATE platform_feature_controls SET enabled = false WHERE feature_key = 'binder_client_publication';
```

Blocks new publish/withdraw API calls. **Already-published binders remain readable** until withdrawn.

### Disable `document_event_notifications`

```sql
UPDATE platform_feature_controls SET enabled = false WHERE feature_key = 'document_event_notifications';
```

Stops new lifecycle notifications. Publication and access unaffected.

### Preserve binder rows and objects

- Do **not** delete `binder_exports` rows or storage objects in routine incidents
- Withdraw to revoke client access
- Orphan objects: follow `binder_storage_orphan_risk` audit procedure

### Partially linked documents

If publish fails mid-flight, check `binder_publication_consistency_risk` audits. Archive orphan document rows; binder remains unpublished.

### Migration rollback

**Not recommended for production incidents.** Migration is additive. Destructive rollback (`DROP COLUMN`, index drops) is staging-only — see `docs/PHASE_9F3_MIGRATION_AND_ROLLBACK.md`.

---

## Operator scripts

| Script | Purpose |
|--------|---------|
| `ops/phase9f3/verify-schema.ps1` | Print diagnostic paths; migration list; dry-run |
| `ops/phase9f3/run-local-gates.ps1` | Full automated gate suite |
| `ops/phase9f3/post-deploy-checklist.ps1` | Human acceptance sequence |
