# Local Migration Validation (Docker)

**Status:** Prepared for future execution — Docker not currently available on operator workstation.

This procedure affects **only the local Supabase Docker database**, not the linked remote project.

## Prerequisites

- Docker Desktop running
- Supabase CLI installed (`npx supabase` via devDependency)
- No remote `db push` during this test

## Validation sequence

```powershell
cd C:\Users\User\Desktop\aegis-wealth-os-git
npx supabase start
npx supabase db reset
npx supabase status
```

## Expected output

### `supabase start`

- API URL: `http://127.0.0.1:54321`
- DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio URL: `http://127.0.0.1:54323`
- All services report **running**

### `supabase db reset`

- Applies all migrations in `supabase/migrations/` in timestamp order
- Seeds (if configured) run after migrations
- Ends with **Finished supabase db reset** or equivalent success message
- **Expected:** all 31 migrations apply without error on clean local DB

### `supabase status`

- Confirms local stack healthy after reset

## Capturing the first failing migration

If `db reset` fails:

1. Note the migration filename in the error output (e.g. `Applying migration 202606100019...`)
2. Inspect full log:
   ```powershell
   npx supabase db reset 2>&1 | Tee-Object -FilePath .\local-migration-reset.log
   ```
3. Compare failure with remote drift — local clean DB failures indicate migration file bugs; remote-only failures indicate drift

## Inspecting logs

```powershell
npx supabase logs db --local
```

Look for: syntax errors, missing dependencies, duplicate object errors.

## Safe reset

`db reset` **drops and recreates** the local database. Safe because:
- Local Docker volume only
- Does not touch linked remote
- Does not run `migration repair`

To stop local stack:

```powershell
npx supabase stop
```

## Post-reset verification

Run diagnostic SQL against local DB:

```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/diagnostics/verify_pending_migrations.sql
```

On clean reset, all pending migration checks should show `present = true` and history should list all versions.

## When local passes but remote fails

- Remote has drift (manual schema changes or partial applies)
- Follow `MIGRATION_RECONCILIATION_PLAN.md` — do not edit historical migrations without evidence
