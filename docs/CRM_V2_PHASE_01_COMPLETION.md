# CRM V2 — Phase 01 Completion Report

**Phase:** 01 — Foundation shell and pilot gating  
**Branch:** `crm-v2-01-shell`  
**Date:** 2026-06-29

---

## Verdict

### READY TO APPLY CRM V2 FOUNDATION CONTROL

All automated acceptance criteria are met:

- `npm run qa:crm-v2-shell` — **148/148 passed**
- Full regression suite — **all passed** (see §21)
- Only pending migration on dry-run — **`202606290001_phase01_crm_v2_feature_controls.sql`**
- No unresolved security defects (see `CRM_V2_PHASE_01_SECURITY_REVIEW.md`)

### Phase 02 readiness note

Phase 02 relationship code **may proceed** on branch `crm-v2-02-relationship-360` without applying or enabling CRM V2 flags first. The `/advisor-v2` shell remains **inaccessible** to all advisers until the operator later approves migration apply, sets `CRM_V2_PILOT_USER_IDS`, and enables `crm_v2_master` + `crm_v2_pilot_mode`.

---

## 1. Repository state discovered

| Item | State |
|------|-------|
| Branch | `crm-v2-01-shell` |
| Phase 00 blueprint | Complete — 219/219 blueprint QA checks |
| Legacy adviser portal | `/advisor` with `requireAdvisorAccess` layout — unchanged |
| Feature controls | `platform_feature_controls` + `lib/compliance/featureFlags.ts` |
| Phase 10.2 work queue | `lib/work-queue/*` — not wired to CRM V2 shell |
| Latest applied migration (remote) | Through Phase 9F.4 chain; Phase 01 seed **not applied** |
| CRM V2 implementation | `app/advisor-v2/*`, `lib/crm-v2/*`, `components/aegis/advisor-v2/*`, shell API |

---

## 2. Exact master feature key

**`crm_v2_master`**

- Constant: `CRM_V2_MASTER_FEATURE_KEY` in `lib/crm-v2/constants.ts`
- Union: `PlatformFeatureKey` in `lib/compliance/types.ts`
- Code default: `enabled: false`, `client_visible: false`, `adviser_visible: true`

---

## 3. Secondary pilot-mode control

**`crm_v2_pilot_mode`** — persisted feature control (migration seed + `FEATURE_DEFAULTS`) **and** code default, both disabled.

Pilot **membership** is enforced via server environment `CRM_V2_PILOT_USER_IDS` (not a third feature flag).

---

## 4. Exact access-check sequence

Implemented in `assertCrmV2Access()` (`lib/crm-v2/access.ts`):

```text
1. requireAdvisorAccess()           → unauthenticated | forbidden
2. isFeatureEnabled('crm_v2_master') → feature_disabled
3. isFeatureEnabled('crm_v2_pilot_mode') → pilot_mode_disabled
4. parsePilotAllowlistFromEnv()     → pilot_not_eligible
5. isUserInPilotAllowlist(authUser.id) → pilot_not_eligible
```

Effective rule:

```text
authenticated adviser
AND crm_v2_master enabled
AND pilot mode requirements satisfied
AND authenticated adviser is pilot eligible
```

---

## 5. Pilot configuration design

| Item | Value |
|------|-------|
| Env variable | `CRM_V2_PILOT_USER_IDS` |
| Format | Comma-separated auth user UUIDs |
| Parser | `lib/crm-v2/pilotConfig.ts` — fail-closed |
| Missing / empty / malformed | Deny all |
| Hardcoded production IDs | None |
| Browser-supplied identity | Not used |

Unit tests: `lib/crm-v2/pilotConfigTests.ts` — 4 cases (missing, empty, malformed, valid).

---

## 6. Migration name and contents

**File:** `supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql`

```sql
INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  ('crm_v2_master', false, false, true, '...'),
  ('crm_v2_pilot_mode', false, false, true, '...')
ON CONFLICT (feature_key) DO NOTHING;
```

No `CREATE TABLE`, no `UPDATE`, no `DROP`, no business schema.

---

## 7. Migration applied or unapplied

**Unapplied.** Dry-run (`npx supabase db push --dry-run`) shows only:

```text
Would push these migrations:
 • 202606290001_phase01_crm_v2_feature_controls.sql
```

---

## 8. Diagnostic files

| File | Purpose |
|------|---------|
| `supabase/diagnostics/preflight_202606290001_phase01_crm_v2_feature_controls.sql` | Pre-apply probes (table exists, migration not yet recorded, seed absent) |
| `supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls.sql` | Post-apply verification (`crm_v2_master.enabled`, etc.) |
| `supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql` | Failing rows only (`missing_or_mismatch`) |

All SELECT-only. Dependency graph updated in `docs/MIGRATION_DEPENDENCY_GRAPH.md`.

---

## 9. Route structure

| Route | Type |
|-------|------|
| `/advisor-v2` | Foundation landing |
| `/advisor-v2/relationships` | Phase 02 placeholder |
| `/advisor-v2/appointments` | Phase 03 placeholder |
| `/advisor-v2/service` | Phase 06 placeholder |
| `/advisor-v2/communications` | Phase 10 placeholder |
| `/advisor-v2/reports` | Phase 12 placeholder |
| `/advisor-v2/operations` | Phase 12 placeholder |
| `/advisor-v2/templates` | Phase 10 placeholder |
| `/advisor-v2/settings` | Phase 01 placeholder + link to `/advisor/my-profile` |
| `GET /api/advisor-v2/shell` | Gate probe |

**Not created:** `/advisor-v2/relationships/[id]`, `/advisor-v2/appointments/[id]`.

---

## 10. Layout and navigation

- **Layout:** `app/advisor-v2/layout.tsx` — `assertCrmV2Access()` → `AdviserCrmV2Shell` or denial
- **Primary nav:** Today, Relationships, Appointments, Service, Communications (`CRM_V2_PRIMARY_NAV`)
- **More nav:** Reports, Operations, Templates, Settings (`CRM_V2_MORE_NAV`)
- **Shell:** `AdviserCrmV2Shell` — desktop sidebar, mobile hamburger, `aria-current`, `focus-visible`
- **Active route:** `isCrmV2NavActive()` in `lib/crm-v2/navigation.ts`
- **Legacy nav:** `lib/navigation.ts` has no `/advisor-v2` link

---

## 11. Placeholder behavior

- `CrmV2FoundationPlaceholderPage` — phase-specific messages only
- Landing references `CRM_V2_DOMAIN_PILLARS` — no fake counts
- No `fetch()`, no business APIs, no Supabase clients in pages
- Settings links to existing `/advisor/my-profile`

---

## 12. Authentication and role behavior

| Role | Result |
|------|--------|
| Unauthenticated | `AdvisorAccessDenied` via `AuthenticatedAppShell` |
| Client | `forbidden` → `AdvisorAccessDenied` |
| Adviser | Proceeds to feature + pilot gates |
| Admin (non-adviser) | `forbidden` → `AdvisorAccessDenied` |

Identity from `supabase.auth.getUser()` only.

---

## 13. Admin behavior

No `isAdminRole` or admin impersonation bypass in `assertCrmV2Access()`. Admin users without adviser role are denied at step 1 — consistent with Phase 00 blueprint (no broad admin CRM session impersonation).

---

## 14. Client denial

Non-adviser roles fail `requireAdvisorAccess()` with `forbidden`. CRM V2 flags have `client_visible: false`.

---

## 15. Disabled behavior

With default flags (or migration unapplied):

- All `/advisor-v2/*` requests → `CrmV2AccessDenied` or `AdvisorAccessDenied`
- No shell content, no business data loaded
- Shell API returns `{ available: false, requestId }` with 403

---

## 16. Pilot behavior

When operator enables both flags and configures valid `CRM_V2_PILOT_USER_IDS`:

- Allowlisted adviser → shell renders
- Non-allowlisted adviser → same generic denial as flag-off
- All denial reasons use identical user-facing message

---

## 17. Shell-status endpoint behavior

`GET /api/advisor-v2/shell`:

- Body: `{ available: boolean, requestId: string }` only
- Status: 200 (allowed), 401 (unauthenticated), 403 (all other denials)
- Headers: `X-Request-Id`, `Cache-Control: no-store`
- No `reason`, allowlist, or flag exposure

---

## 18. Error and logging behavior

- `app/advisor-v2/loading.tsx` → `CrmV2LoadingSkeleton`
- `app/advisor-v2/error.tsx` → `RouteErrorFallback`, title "CRM V2 unavailable"
- No raw `{error.message}` in UI
- Console: digest + name only
- No allowlist in logs

---

## 19. Compatibility findings

| Check | Status |
|-------|--------|
| `/advisor` layout unchanged | Pass |
| No CRM V2 in legacy nav | Pass |
| Client portal unchanged | Pass |
| Work queue not imported by CRM V2 | Pass |
| Phase 9F.4 observation unchanged | Pass — no Promotions Stage 6 |
| `legacy_promotions_write` | Unchanged (false) |

---

## 20. Files added and changed

**Added:**

- `lib/crm-v2/access.ts`, `pilotConfig.ts`, `pilotConfigTests.ts`, `constants.ts`, `navigation.ts`
- `app/advisor-v2/**` (layout, loading, error, 9 pages)
- `app/api/advisor-v2/shell/route.ts`
- `components/aegis/advisor-v2/*` (8 components)
- `supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql`
- `supabase/diagnostics/preflight_202606290001_*`, `verify_202606290001_*`
- `scripts/run-crm-v2-shell-validation.ts`, `scripts/qa-stub-server-only.ts`
- Phase 01 docs (5 files)

**Updated:**

- `lib/compliance/types.ts`, `lib/compliance/featureFlags.ts`
- `package.json` (`qa:crm-v2-shell`)
- `.env.example` (`CRM_V2_PILOT_USER_IDS`)
- `docs/CRM_V2_ROLLOUT_INDEX.md`, `CRM_V2_ROUTE_MAP.md`, `CRM_V2_FEATURE_CONTROL_PLAN.md`, `CRM_V2_MIGRATION_SEQUENCE.md`, `docs/MIGRATION_DEPENDENCY_GRAPH.md`, `docs/MIGRATION_CHAIN_AUDIT.md`
- `supabase/diagnostics/verify_pending_migrations.sql` (Phase 01 pending coverage)
- `scripts/classify-migration-drift.ts`, `scripts/run-migration-readiness-validation.ts`

---

## 21. Exact QA results

_QA executed 2026-06-29 on branch `crm-v2-01-shell`._

| Command | Result |
|---------|--------|
| `npm run qa:crm-v2-blueprint` | **219/219 PASS** |
| `npm run qa:crm-v2-shell` | **148/148 PASS** |
| `npm run qa:phase10-discovery` | **118/118 PASS** |
| `npm run qa:phase10-work-queue-core` | **135/135 PASS** |
| `npm run qa:phase9f4-app-retirement` | **115/115 PASS** |
| `npm run qa:phase9f3-binder-client-vault` | **198/198 PASS** |
| `npm run qa:phase9e-communications` | **87/87 PASS** |
| `npm run qa:migration-readiness` | **101/101 PASS** |
| `npm run qa:diagnostic-sql-syntax` | **39/39 PASS** (21 self-tests + all diagnostic files) |
| `npm run security:api` | **PASS** (pre-existing INFO/WARN items only; no new CRM V2 routes flagged) |
| `npm run security:advisor-access` | **11/11 PASS** |
| `npm run security:service-role` | **PASS** (no critical unsafe imports; CRM V2 adds none) |
| `npm run final:check` | **7/7 PASS** |
| `npx tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** (0 errors; 1 pre-existing warning in blueprint validator) |
| `npm run build` | **PASS** |

---

## 22. Dry-run result

```text
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 202606290001_phase01_crm_v2_feature_controls.sql
```

Only the approved Phase 01 feature-control migration is pending. **Not applied.**

---

## 23. Manual tests remaining

All 25 manual tests in `CRM_V2_PHASE_01_MANUAL_TESTS.md` are marked **NOT RUN** — they require operator-configured pilot UUID, flag enablement on staging, and browser execution. Automated static QA does not substitute for runtime manual acceptance.

---

## 24. Operator configuration required

1. Approve applying `202606290001_phase01_crm_v2_feature_controls.sql`
2. Set `CRM_V2_PILOT_USER_IDS` in deployment environment (comma-separated auth user UUIDs)
3. Enable `crm_v2_master` + `crm_v2_pilot_mode` when ready for pilot (staging first)
4. Execute manual checklist in `CRM_V2_PHASE_01_MANUAL_TESTS.md`
5. Restart application after env changes

---

## 25. Confirmation of prohibited actions avoided

| Prohibited action | Confirmed |
|-------------------|-----------|
| CRM business schema | **No** — feature seeds only |
| Relationship or household schema | **No** |
| Appointment schema changes | **No** |
| Service or commitment schema | **No** |
| Business APIs (beyond shell probe) | **No** |
| Business-data reads | **No** |
| Source mutation | **No** |
| Client-portal change | **No** |
| Legacy `/advisor` change | **No** |
| Feature activation (remote) | **No** |
| Deployment | **No** |
| Destructive action | **No** |
| Phase 9F.4 observation change | **No** |
| Promotions Stage 6 | **No** |
| Phase 02 implementation | **No** — not started |
| Real pilot ID committed | **No** |
| QA assertion weakening | **No** |

---

## 26. Verdict (summary)

| Criterion | Met |
|-----------|-----|
| 148/148 shell QA | Yes |
| Full regression suite | Yes |
| Only Phase 01 migration pending on dry-run | Yes |
| No unresolved security defect | Yes |
| Documentation complete and implementation-accurate | Yes |

**Primary verdict:** `READY TO APPLY CRM V2 FOUNDATION CONTROL`

**Development note:** Phase 02 Relationship 360 code may begin on `crm-v2-02-relationship-360` without applying the migration first; the live shell stays gated until operator approval.

---

## Related documents

| Document | Path |
|----------|------|
| Shell architecture | `docs/CRM_V2_PHASE_01_SHELL_ARCHITECTURE.md` |
| Feature gating | `docs/CRM_V2_PHASE_01_FEATURE_GATING.md` |
| Security review | `docs/CRM_V2_PHASE_01_SECURITY_REVIEW.md` |
| Manual tests | `docs/CRM_V2_PHASE_01_MANUAL_TESTS.md` |
| Rollout index | `docs/CRM_V2_ROLLOUT_INDEX.md` |
