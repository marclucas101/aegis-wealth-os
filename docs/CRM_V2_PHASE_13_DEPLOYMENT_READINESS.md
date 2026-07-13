# CRM V2 Phase 13 — Deployment Readiness

**Status:** Limited pilot readiness — **not** production launch approval  
**Branch:** `crm-v2-13-pilot-activation`  
**Audience:** Operators and deployers

This checklist confirms whether an environment is **safe to begin a limited CRM V2 pilot**. Passing repository QA does **not** replace operator sign-off or manual acceptance.

---

## 1. Readiness statement (do not overstate)

| Claim | Accurate? |
|-------|-----------|
| Engineering runbooks and diagnostics exist | Yes |
| All CRM V2 flags default disabled in code/migrations | Yes |
| Staging pilot may begin after operator checklist | Conditional |
| Production launch approved | **No** — Phase 13 only |
| All manual tests passed | **No** — 422 tests remain NOT RUN until operator executes |
| Phase 14 cutover ready | **No** — deferred |

**Use this verdict:** *Ready for limited staging pilot preparation* — not *ready for production launch*.

---

## 2. Pre-deployment checklist

### Repository and build

| # | Item | Verify |
|---|------|--------|
| 1 | Branch `crm-v2-13-pilot-activation` (or approved merge target) | git status |
| 2 | `npm run qa:crm-v2-pilot-readiness` passes | CI or local |
| 3 | `npm run build` passes | CI or local |
| 4 | `npx tsc --noEmit` clean | CI or local |
| 5 | `npm run security:api` / `security:advisor-access` / `security:service-role` pass | CI or local |

### Database

| # | Item | Verify |
|---|------|--------|
| 6 | `npx supabase db push --dry-run` reviewed | Operator log |
| 7 | Pending CRM V2 migrations applied only with operator approval | migration log |
| 8 | `preflight_phase13_crm_v2_feature_control_pilot_readiness.sql` | table present |
| 9 | Feature-control seeds exist; default `enabled = false` at apply | discrepancy SQL |

### Environment (no secrets in git)

| # | Item | Verify |
|---|------|--------|
| 10 | `NEXT_PUBLIC_SUPABASE_URL` / anon key set in hosting env | dashboard |
| 11 | `SUPABASE_SERVICE_ROLE_KEY` server-only | dashboard |
| 12 | `CRM_V2_PILOT_USER_IDS` set to pilot adviser UUID(s) | dashboard |
| 13 | **Redeploy or restart** after env change | deploy log |
| 14 | `.env.local` saved to disk if local dev (not just editor buffer) | file on disk |
| 15 | Google OAuth vars present **only if** testing calendar module | dashboard |

### Pilot configuration

| # | Item | Verify |
|---|------|--------|
| 16 | `crm_v2_master` + `crm_v2_pilot_mode` enabled only when pilot starts | SQL |
| 17 | Sub-flags enabled **one module at a time** | operator log |
| 18 | Single adviser in allowlist initially | env |
| 19 | Test client(s) identified; not production sensitive data | operator log |
| 20 | Legacy `/advisor` smoke tested | manual |

---

## 3. Enabled feature flags — expected pilot states

### Baseline (before pilot)

```sql
SELECT feature_key, enabled
FROM platform_feature_controls
WHERE feature_key LIKE 'crm_v2_%'
ORDER BY feature_key;
-- Expected: all enabled = false (or rows missing → code defaults false)
```

### Minimal pilot entry (example — operator-controlled)

| Flag | enabled |
|------|---------|
| `crm_v2_master` | true |
| `crm_v2_pilot_mode` | true |
| All other `crm_v2_*` | false until module test |

Plus: `CRM_V2_PILOT_USER_IDS=<pilot-auth-uuid>` in server environment.

### Full module pilot (example — only after staged acceptance)

Enable per `docs/CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md`. Never enable all at once on first day.

---

## 4. Secret rotation reminder

Rotate or review these if exposed, shared broadly, or after pilot ends:

| Secret | Rotation trigger |
|--------|------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Leak suspicion; quarterly policy |
| `GOOGLE_CLIENT_SECRET` | OAuth misconfiguration or leak |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Compromise; invalidates stored tokens |
| `GOOGLE_OAUTH_STATE_SECRET` | Compromise |
| `CRON_SECRET` | Leak |
| Session/auth cookies | Standard Supabase auth rotation policy |

**Rules:**

- Never commit `.env`, `.env.local`, or hosting env exports to git.
- Do not paste secrets into pilot issue logs or screenshots.
- After rotation: redeploy, verify `/advisor` and `/api/health/supabase`, re-test Google connect only on staging.
- Document rotation date in operator log (not secret values).

---

## 5. No-go conditions

**Do not start or continue pilot** if any of the following are true:

| # | Condition |
|---|-----------|
| 1 | `CRM_V2_PILOT_USER_IDS` missing, empty, or malformed in deployment env |
| 2 | `crm_v2_master` or `crm_v2_pilot_mode` enabled without allowlist configured |
| 3 | Multiple client-visible flags enabled before adviser shell signed off |
| 4 | Non-pilot adviser can access `/advisor-v2` |
| 5 | Client can see another client's data (any module) |
| 6 | Unintended external email/SMS/WhatsApp send occurred |
| 7 | `legacy_promotions_write` enabled or Promotions Stage 6 activated |
| 8 | Discrepancy SQL shows sub-flags enabled without master+pilot |
| 9 | Migration dry-run shows unexpected pending schema without engineering review |
| 10 | Critical open blocker in master manual acceptance |
| 11 | Production deployment requested without Section Q go/no-go (`CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md`) |
| 12 | Bulk adviser or client rollout planned for day one |

**Action on no-go:** disable `crm_v2_master`; follow rollback runbook; log issue; resolve before resume.

---

## 6. Post-deploy smoke (limited)

| Check | Expected |
|-------|----------|
| `GET /api/advisor-v2/shell` (pilot session) | `available: true` when gates configured |
| `GET /api/advisor-v2/shell` (non-pilot) | 403 |
| `/advisor-v2` (pilot) | Shell renders |
| `/advisor-v2` (non-pilot) | "CRM V2 is not available" |
| `/advisor` | Unchanged |
| `npm run qa:crm-v2-pilot-readiness` | Pass (repository) |

See `docs/CRM_V2_PHASE_13_PILOT_SMOKE_TESTS.md`.

---

## 7. Staging vs production

| Environment | Phase 13 stance |
|-------------|-----------------|
| **Local** | Dev only; save `.env.local`; restart `npm run dev` |
| **Staging** | **Primary pilot target** — full checklist above |
| **Production** | **No-go** unless executive sign-off + Section Q complete + separate production runbook |

---

## 8. Issue logging

Use the procedure in `docs/CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md` §8.

Minimum: timestamp, environment, route, severity, flag snapshot, rollback taken, evidence link.

---

## 9. Sign-off block (operator)

| Role | Name | Date | Staging pilot approved? |
|------|------|------|-------------------------|
| Operator | | | Yes / No |
| Engineering | | | Artefacts complete only |
| Executive (production) | | | Not in Phase 13 scope |

---

## 10. Related documents

| Document | Purpose |
|----------|---------|
| `CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md` | Day-to-day pilot operations |
| `CRM_V2_PHASE_13_STAGING_ACTIVATION_RUNBOOK.md` | Activation steps |
| `CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md` | Rollback SQL |
| `CRM_V2_PHASE_13_COMPLETION.md` | Engineering completion report |
| `CRM_V2_PHASE_13_EXISTING_PILOT_READINESS_AUDIT.md` | Readiness audit |
