# Launch Day Runbook — Phase 4Z

**Date:** 2026-06-10  
**Purpose:** Ordered sequence for deploy day, first demo, and emergency rollback.

**Related:** [Final Beta Launch Checklist](./FINAL_BETA_LAUNCH_CHECKLIST.md) · [Go / No-Go Criteria](./GO_NO_GO_CRITERIA.md) · [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) · [Operations Runbook](./OPERATIONS_RUNBOOK.md) · [Incident Response](./INCIDENT_RESPONSE.md)

---

## Roles

| Role | Responsibility |
|------|----------------|
| **Launch lead** | Go/no-go decision, coordinates sequence |
| **Engineering** | Deploy, migrations, automated gates |
| **Demo presenter** | Walkthrough per [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md) |
| **Security reviewer** | Confirms audit + RLS fix on target DB |
| **Ops / on-call** | Health checks, logs, rollback execution |

---

## T-minus 24 hours — pre-launch sequence

1. Confirm target gate: **demo** (local/staging) or **private beta** (staging deploy)
2. Run structural and automated gates:

```bash
npm run final:check
npm run qa:env
npm run deploy:check
npm run deploy:config -- --production
npm run ops:check
npm run security:audit
npm run lint
npx tsc --noEmit
npm run build
```

3. Verify all migrations applied on target Supabase project (including `202606100014`)
4. For demo: `npm run demo:seed` on **non-production** database only
5. Rehearse [Demo Script](./DEMO_SCRIPT.md) — 10–15 minutes
6. Record go/no-go per [Go / No-Go Criteria](./GO_NO_GO_CRITERIA.md)
7. Confirm on-call contact and [Incident Response](./INCIDENT_RESPONSE.md) severity table

---

## T-zero — deploy sequence (private beta)

Skip Vercel deploy for **local-only demo**; start at post-deploy validation with `npm run dev`.

### 1. Supabase

- [ ] Confirm project URL and keys match Vercel env scope
- [ ] `npx supabase db push` or dashboard — all migrations applied
- [ ] Auth redirect URLs include production and preview origins
- [ ] Storage bucket `client-documents` + policies active

### 2. Vercel

- [ ] Env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Service role **not** prefixed with `NEXT_PUBLIC_`
- [ ] Optional `BASE_URL` for smoke tests
- [ ] Trigger deploy (git push or manual)
- [ ] Build logs: install + `next build` succeed

### 3. Do not auto-run

- [ ] `demo:seed` — manual only, never in deploy hook
- [ ] `demo:clear` — manual only with `--confirm`

---

## T+15 minutes — post-deploy validation

```bash
# Replace with deployed URL
BASE_URL=https://<deployed-url> npm run qa:smoke
```

Manual checks:

| Check | Endpoint / action | Expected |
|-------|-------------------|----------|
| App health | `GET /api/health/app` | `ok: true` |
| DB health | `GET /api/health/supabase` | `ok: true` |
| Landing | `/` | Loads, legal footer links work |
| Login | `/login` | Form loads; auth redirect works |
| Legal | `/legal/disclaimer` | Draft warning visible |
| Protected route | `/dashboard` (logged out) | Redirect to login |

Complete [Post-Deployment QA](./POST_DEPLOYMENT_QA.md) sections 1–5 minimum.

If any **P0/P1** failure: stop and execute [Emergency rollback](#emergency-rollback).

---

## T+30 minutes — first demo walkthrough

Follow [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md) in order:

1. **Client — Alex Tan** — dashboard, estate gap, roadmap, report print
2. **Client — Sam Wei** — incomplete onboarding contrast
3. **Advisor** — command center, Priya/Margaret pipeline, file quality
4. **Advisor workspace** — notes, tasks, review status
5. **Document vault** — metadata demo; estate gap narrative
6. **Report export** — browser Print / Save PDF
7. **Admin** — role visibility (brief)
8. **Security talking point** — RLS, API guards, C-1 fix (no self-promotion to admin)

Keep [Demo Script](./DEMO_SCRIPT.md) open for talking points.

---

## Emergency rollback

### When to rollback

- P0 security incident (secret leak, data cross-tenant exposure)
- Auth completely broken for all roles
- Health endpoints fail persistently (>5 min)
- Error rate spike with no quick fix

### Vercel rollback

1. Vercel dashboard → Project → Deployments
2. Select last known-good deployment → **Promote to Production**
3. Verify `GET /api/health/app` on rolled-back URL
4. Run `BASE_URL=<url> npm run qa:smoke`

### Database rollback

- **Do not** run `demo:clear` on production
- Schema rollback: restore from Supabase backup per [Backup & Recovery](./BACKUP_AND_RECOVERY.md)
- If bad migration applied: contact launch lead before manual SQL

### Secret compromise

1. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard
2. Update Vercel env var; redeploy
3. Review audit logs per [Audit Log Review](./AUDIT_LOG_REVIEW.md)
4. Follow [Incident Response](./INCIDENT_RESPONSE.md) security checklist

---

## If something fails — who checks what

| Symptom | First checker | Action |
|---------|---------------|--------|
| Build fails on Vercel | Engineering | Build logs; missing env var; `npm run build` locally |
| 401/403 on all API routes | Engineering | Supabase URL/keys; session cookies; redirect URLs |
| 500 on API routes | Engineering + Ops | Vercel function logs; `captureServerError` pattern |
| Health `ok: false` | Ops | Supabase status; connection string; RLS not blocking health probe |
| Advisor sees wrong clients | Security reviewer | `clients.advisor_user_id`; `users.role`; RLS migration 014 |
| Upload fails | Engineering | Storage bucket; policies; file size/MIME |
| Rate limit 429 storm | Ops | In-memory limit per instance; consider traffic throttle |
| Demo login fails | Engineering | `demo:seed` run? Correct `@aegis-demo.local` passwords |
| Legal pages 404 | Engineering | Deploy includes `app/legal/*`; rebuild |
| Print layout broken | Demo presenter | Browser print preview; known browser-print limitation |

Escalation path: Engineering → Launch lead → on-call per [Incident Response](./INCIDENT_RESPONSE.md).

---

## Post-launch (same day)

- [ ] Go/no-go record filed
- [ ] Open issues logged for [Beta Roadmap](./BETA_ROADMAP_AFTER_LAUNCH.md)
- [ ] Vercel + Supabase logs reviewed for 5xx and auth errors
- [ ] Demo feedback captured for UX iteration

---

## Command quick reference

```bash
npm run final:check
npm run deploy:check
npm run security:audit
npm run build
BASE_URL=https://<url> npm run qa:smoke
npm run demo:seed          # dev/staging demo only
npm run demo:clear -- --confirm
```
