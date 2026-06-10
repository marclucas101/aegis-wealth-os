# Seeding and Reset — Phase 4Y

**Scripts:** `scripts/seed-demo-data.ts` · `scripts/clear-demo-data.ts`  
**npm commands:** `demo:seed` · `demo:clear`

---

## How seed works

1. Loads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment or `.env.local` (values are never logged)
2. Creates or updates **auth users** for each persona (`@aegis-demo.local`)
3. Upserts `public.users` with correct roles (`admin`, `advisor`, `client`)
4. Creates or updates `clients` rows assigned to the demo advisor
5. For clients with `seedDiscover: true`:
   - Builds fictional Discover form data
   - Runs the **existing** scoring pipeline (`localProfile` + `src/lib/scoring`)
   - Persists discover → financial → shield → pillars → stress → roadmap → client_profile
6. Seeds optional reports, document metadata, advisor notes, tasks, and sample audit logs

### Idempotency

- Re-running `demo:seed` **does not duplicate** users, clients, notes, tasks, or documents
- Scoring snapshots are skipped if the current Discover profile already has matching `_demoMeta.personaKey`
- Use `npm run demo:seed -- --force` to refresh scoring snapshots

### What seed does **not** do

- Change database schema
- Modify scoring formulas
- Upload files to Storage
- Run automatically in production or on deploy

---

## How clear works

1. Prints a **strong warning** and exits unless `--confirm` is passed
2. Finds all auth users with `@aegis-demo.local` email
3. Finds clients linked by demo email or demo `user_id` / `advisor_user_id`
4. Deletes dependent rows in FK-safe order:
   - audit_logs → advisor_tasks → advisor_notes → documents (demo paths only)
   - wealth_blueprints → annual_reviews → roadmap_items
   - pillar_scores / stress_tests → shield_scores → financial_profiles
   - client_profiles → discover_profiles → clients
   - public.users → auth.users
5. Does **not** delete non-demo data
6. Does **not** remove Storage objects (demo used metadata only)

### Command

```bash
npm run demo:clear -- --confirm
```

Without `--confirm`, the script aborts after the warning.

---

## Safety rules

| Rule | Detail |
|------|--------|
| Fictional data only | All personas use `@aegis-demo.local` |
| Domain filter | Clear script only targets demo email domain |
| Manual invocation | No CI/deploy hook runs seed or clear |
| No secrets in logs | Service role key and env values are never printed |
| Staging preferred | Seed dev/staging; avoid production with real clients |
| Confirm clear | `--confirm` required to delete |

---

## Troubleshooting

### `Missing required environment variables`

Copy `.env.example` to `.env.local` and set Supabase URL + service role key. Run `npm run qa:env`.

### `Failed to create demo user` (email exists)

Re-run `npm run demo:seed` — script updates existing users. If stuck, run `demo:clear -- --confirm` then seed again.

### Scores look stale after engine change

```bash
npm run demo:seed -- --force
```

### Advisor dashboard empty

- Confirm logged in as `advisor@aegis-demo.local`
- Confirm clients have `advisor_user_id` set (re-run seed)
- Check migrations and RLS are applied

### Document vault open fails

Expected for demo placeholders — metadata exists but no Storage blob. Explain in demo script.

### Clear deleted too much / too little

Clear only removes `@aegis-demo.local` users and linked clients. If you used a different email domain, data will not be removed.

---

## Quick reference

```bash
npm run demo:seed              # Create or update demo data
npm run demo:seed -- --force    # Refresh scoring snapshots
npm run demo:clear -- --confirm # Remove all demo data
npx tsx scripts/demo-login-guide.ts  # Print accounts
```
