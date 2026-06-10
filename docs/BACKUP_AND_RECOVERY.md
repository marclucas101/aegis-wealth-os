# Backup & Recovery — Phase 4W

**Date:** 2026-06-10  
**Purpose:** Backup strategy, recovery expectations, and restore testing for Aegis Wealth OS MVP on Supabase + Vercel.

**Related:** [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md) · [Operations Runbook](./OPERATIONS_RUNBOOK.md) · [Incident Response](./INCIDENT_RESPONSE.md)

---

## 1. Scope

| Asset | Location | Backup owner |
|-------|----------|--------------|
| PostgreSQL (app data) | Supabase | Supabase platform + your project settings |
| Auth users | Supabase Auth | Included in Postgres / Auth exports |
| Storage objects | Supabase bucket `client-documents` | Separate from Postgres — plan explicitly |
| Application code | Git repository | GitHub (or your Vercel-connected repo) |
| Environment secrets | Vercel env vars | Vercel encrypted storage — document names, not values |
| Vercel deployment config | Vercel project | Redeploy from git; env vars re-applied |

Vercel does **not** store application data — recovery always centers on Supabase + git.

---

## 2. RPO / RTO (MVP targets)

Define these with stakeholders before real client data:

| Metric | MVP target | Notes |
|--------|------------|-------|
| **RPO** (Recovery Point Objective) | 24 hours | Daily logical backup acceptable for private beta; tighten for production |
| **RTO** (Recovery Time Objective) | 4 hours | Time to restore DB + redeploy app + verify health checks |

Paid Supabase plans with **Point-in-Time Recovery (PITR)** can improve RPO to minutes — enable when budget allows.

---

## 3. Supabase Postgres backups

### Platform backups

1. Supabase dashboard → **Settings → Database → Backups**.
2. Confirm automatic daily backups are enabled for your plan.
3. Enable **PITR** on Pro+ if required by compliance.

### Logical export strategy (recommended supplement)

Periodic manual or scheduled exports for off-platform copy:

```bash
# Requires Supabase CLI linked to project — run from secure operator machine
npx supabase db dump --linked -f backup-$(date +%Y%m%d).sql
```

Store dumps encrypted (e.g. password manager vault, encrypted S3, or secure team drive). **Never commit dumps to git.**

### What is included

- All public schema tables (`clients`, `users`, `documents`, `audit_logs`, etc.)
- Migrations history if using Supabase migration tracking

### What is not included

- Storage bucket binary objects (see §4)
- Vercel environment variable values (export separately via secure password manager)

---

## 4. Storage bucket backup (`client-documents`)

Postgres `documents` rows reference storage paths — **restoring DB without storage leaves broken downloads**.

Options for MVP:

1. **Periodic export** — Supabase CLI or dashboard download of critical prefixes (operator script; not automated in app).
2. **Provider replication** — If Supabase offers bucket replication on your tier, enable it.
3. **Accept beta risk** — Document that full storage restore may require re-upload for beta if no export exists.

Before production traffic:

- [ ] Document who runs storage exports and how often
- [ ] Test restoring one object after a drill

---

## 5. Database export strategy

| Frequency | Method | Retention |
|-----------|--------|-----------|
| Daily (automated) | Supabase dashboard backups | Per plan (typically 7–30 days) |
| Weekly (manual) | `supabase db dump` to encrypted storage | 90 days MVP |
| Pre-migration | Manual dump before applying new migrations | Until migration verified |

Label exports with environment: `staging-20260610.sql`, `prod-20260610.sql`.

---

## 6. Migration rollback risks

Migrations live in `supabase/migrations/`. **There is no automatic down migration** in this project.

| Risk | Mitigation |
|------|------------|
| Destructive SQL (DROP, ALTER) | Review SQL in PR; test on staging clone first |
| RLS policy change locks out users | Staging smoke test with client/advisor/admin accounts |
| Schema drift | Only apply via migration files; avoid dashboard-only edits in prod |
| Failed mid-migration | Restore from pre-migration dump; do not partial-apply |

Rollback procedure:

1. Stop deploys / enable maintenance message if needed.
2. Restore Postgres from backup or PITR to point before migration.
3. Redeploy last known-good git commit on Vercel.
4. Run health checks and [Post-Deployment QA](./POST_DEPLOYMENT_QA.md).

---

## 7. Restore testing

Run at least **once in staging** before private beta:

1. Create staging Supabase project (or branch if available).
2. Apply production-like migrations.
3. Restore from a recent dump into a **separate** test database (never overwrite prod during drill).
4. Point staging Vercel preview env at restored DB (temporary — document revert).
5. Verify:
   - `GET /api/health/supabase` → `ok: true`
   - Login as test client / advisor / admin
   - Document list + signed URL open
   - Sample `audit_logs` rows present
6. Record actual RTO achieved and gaps.

---

## 8. Application redeploy recovery

If Supabase is healthy but Vercel is broken:

1. Vercel → **Deployments** → promote last green deployment, or redeploy from git tag.
2. Confirm env vars unchanged ([Environment Variables](./ENVIRONMENT_VARIABLES.md)).
3. `curl /api/health/app` and `/api/health/supabase`.

If git is lost (extreme): recover from GitHub remote; Vercel reconnects to repo.

---

## 9. Secret rotation after recovery

If breach suspected during incident:

1. Rotate Supabase **service_role** and **anon** keys (Settings → API).
2. Update Vercel env vars; redeploy.
3. Invalidate active sessions if auth compromise (Supabase Auth → sign out all users, or password reset campaign).
4. Review `audit_logs` for suspicious actions ([Audit Log Review](./AUDIT_LOG_REVIEW.md)).

---

## 10. Backup checklist (pre go-live)

- [ ] Supabase automatic backups confirmed enabled
- [ ] PITR decision documented (on/off + rationale)
- [ ] Weekly dump procedure assigned to owner
- [ ] Storage export approach documented
- [ ] Restore drill completed in staging with recorded RTO
- [ ] Pre-migration dump rule agreed
- [ ] Encrypted off-site storage location for dumps identified
