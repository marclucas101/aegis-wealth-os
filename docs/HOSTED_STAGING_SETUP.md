# Hosted Staging Setup (No Docker)

Minimal path for operators who cannot run local Supabase via Docker.

**This guide describes steps only — do not execute infrastructure creation from CI without approval.**

## 1. Create a new Supabase project

- Supabase Dashboard → New project
- Name clearly: e.g. `aegis-wealth-os-staging`
- Record project reference (20-char ref, **not** service role key)
- Choose region matching production policy

## 2. Link repository to staging project

```powershell
cd C:\Users\User\Desktop\aegis-wealth-os-git
git checkout migration-reconciliation
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

## 3. Confirm the link

```powershell
$env:EXPECTED_SUPABASE_PROJECT_REF = "<STAGING_PROJECT_REF>"
npm run supabase:confirm-target -- --env staging
```

Verify:
- Printed project reference matches Dashboard
- Script exits 0
- No secrets printed

## 4. Migration list

```powershell
npx supabase migration list
```

On **fresh staging**, expect:
- All local migrations shown as pending/local-only until push
- No drift from production

## 5. Dry-run (when approved)

```powershell
npx supabase db push --dry-run
```

Review SQL that would execute. On clean staging, expect full chain 001→007 without errors.

## 6. Apply full clean migration chain (when approved)

```powershell
# After backup policy satisfied and operator checklist complete
npx supabase db push
```

**Only on staging project** — never first attempt on production with drift.

## 7. Run verification SQL

In Supabase SQL Editor (read-only role if available):

1. Paste `supabase/diagnostics/verify_pending_migrations.sql`
2. Export section O results as JSON
3. Classify:
   ```powershell
   npx tsx scripts/classify-migration-drift.ts --snapshot .\staging-drift-export.json
   ```

Expected on clean staging: all pending migrations **EXACT_MATCH** with history applied.

## 8. Connect Vercel Preview

- Vercel project → Settings → Environment Variables
- Preview environment:
  - `NEXT_PUBLIC_SUPABASE_URL` → staging project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging anon key
  - `SUPABASE_SERVICE_ROLE_KEY` → staging service role (server only)
- Deploy preview branch; run smoke tests

## Staging vs production discipline

| Rule | Rationale |
|------|-----------|
| Never use production ref as staging | Prevents accidental drift repair on live data |
| Set `EXPECTED_SUPABASE_PROJECT_REF` | `confirm-supabase-target` blocks wrong target |
| Run verification SQL before repair | Table existence ≠ migration applied |
| Keep staging disposable | Reset by creating new project if corrupted |

## If staging push fails at 019

Same as production drift — run diagnostics before repair. Staging may be reset by creating a new project if easier than remediation.
