# Supabase Migration Operator Checklist

Use before any remote `db push`, `migration repair`, or schema-altering operation.

## Before any remote push

- [ ] Confirm Git branch (`migration-reconciliation` or approved release branch)
- [ ] Confirm clean working tree (`git status`)
- [ ] Confirm linked project reference:
  ```powershell
  npm run supabase:confirm-target -- --env staging
  ```
- [ ] Confirm project **name** in Supabase Dashboard matches expected staging
- [ ] Confirm environment classification (staging vs production)
- [ ] Confirm backup status (Dashboard backup or PITR policy documented)
- [ ] Run `npx supabase migration list`
- [ ] Run `npx supabase db push --dry-run` (when approved for writes)
- [ ] Inspect all pending migrations in `docs/MIGRATION_CHAIN_AUDIT.md`
- [ ] Run read-only drift diagnostics:
  - `supabase/diagnostics/verify_pending_migrations.sql`
  - `supabase/diagnostics/verify_202606100019_adviser_profiles.sql`
- [ ] Export diagnostic section O → `classify-migration-drift.ts`
- [ ] Receive explicit human approval recorded in change ticket

## Prohibited shortcuts

- **Blind migration repair** — never repair all pending versions without per-migration verify
- **Blind `IF NOT EXISTS`** — do not retrofit historical migrations to hide drift
- **Unknown linked target** — always run `supabase:confirm-target`
- **Production as staging** — use dedicated staging project ref
- **History edit without schema proof** — `migration repair` requires EXACT_MATCH evidence
- **Drop existing tables** to make migrations pass (e.g. `adviser_profiles`)

## After push (when authorized)

- [ ] Re-run verification SQL
- [ ] Run application QA suites on connected preview
- [ ] Document migration versions now in `schema_migrations`
- [ ] Update drift classification record

## Emergency stop conditions

Stop and escalate if:

- `CONFLICTING` classification on any migration
- Column type mismatch on `adviser_profiles` or `adviser_appointments`
- Unexpected data loss in dry-run output
- `confirm-supabase-target` fails
- Production classification detected unintentionally

## Reference documents

| Document | Purpose |
|----------|---------|
| `MIGRATION_CHAIN_AUDIT.md` | Full migration inventory |
| `MIGRATION_DEPENDENCY_GRAPH.md` | Order and blocking |
| `MIGRATION_RECONCILIATION_PLAN.md` | Classification actions |
| `LOCAL_MIGRATION_VALIDATION.md` | Docker clean DB test |
| `HOSTED_STAGING_SETUP.md` | No-Docker staging path |
