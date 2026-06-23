# Phase 9F.3 NAP Batch Report

**Batch:** 9F.3 — NAP-SAFE FINALIZATION  
**Date:** 2026-06-24  
**Branch:** `phase-9f3-binder-client-vault`  
**Commit:** `9afe34e`

---

## 1. Final two diagnostic fixes

Replaced general-purpose predicate canonicalizer checks for:

- `idx_binder_exports_generation_idempotent`
- `idx_binder_exports_published_document`

With compact index-specific structured catalog checks verifying:

1. Index on `public.binder_exports`
2. `pg_get_indexdef(indexrelid, 1, true)` key column
3. Expected uniqueness
4. `indpred IS NOT NULL`
5. Anchored normalization (lowercase, whitespace, outer parens, `public.binder_exports.` / `binder_exports.` strip only)
6. Exact match to `generation_idempotency_key is not null` / `published_document_id is not null`

Compound predicate checks (`client_published_current`, `lineage_current_published`) retain strict conjunct-array logic.

---

## 2. Expected live diagnostic result

```text
65 present
0 absent
0 conflicting
0 unknown
EXACT_MATCH
```

---

## 3. Branch audit result

See `docs/PHASE_9F3_FINAL_BRANCH_AUDIT.md`.

**Verdict:** READY — correct branch, no merge markers, no secrets in tracked files, migration `202606200010` unchanged.

---

## 4. Code audit findings

See `docs/PHASE_9F3_FINAL_CODE_AUDIT.md`.

- **0** critical/high defects
- **1** diagnostic fix applied (F-01)
- **3** accepted low/informational items

---

## 5. Local acceptance harness

| Artifact | Path |
|----------|------|
| Script | `scripts/run-phase9f3-local-acceptance.ts` |
| npm command | `npm run qa:phase9f3-local-acceptance` |
| Result | **25/25 passed** (+ runtime suites) |

Staging-only (database required): adviser generation, publication, withdrawal, signed URLs, notifications.

---

## 6. Operator scripts created

| Script | Purpose |
|--------|---------|
| `ops/phase9f3/verify-schema.ps1` | Diagnostic paths, migration list, dry-run |
| `ops/phase9f3/run-local-gates.ps1` | Full gate suite; fail-fast |
| `ops/phase9f3/post-deploy-checklist.ps1` | Human acceptance sequence |

---

## 7. Manual acceptance packet status

Updated `docs/PHASE_9F3_FINAL_MANUAL_ACCEPTANCE_TESTS.md` with 17 executable scenarios, prerequisites, feature states, expected DB/storage/audit/notification outcomes, privacy checks, cleanup, and unsigned results table.

---

## 8. Deployment/rollback packet status

Updated `docs/PHASE_9F3_DEPLOYMENT_AND_ENABLEMENT.md` with 14-step enablement sequence and rollback guidance.

Created unsigned `docs/PHASE_9F3_RELEASE_SIGNOFF.md`.

---

## 9. Exact QA outcomes

| Gate | Result |
|------|--------|
| `npx tsx scripts/run-phase9f3-index-predicate-validation.ts` | **PASS** (24 checks) |
| `npm run qa:phase9f3-binder-client-vault` | **198/198** |
| `npm run qa:phase9f3-local-acceptance` | **25/25** |
| `npm run qa:a4-summary-report` | **20/20** |
| `npm run qa:phase9f2-lifecycle-notifications` | **100/100** |
| `npm run qa:phase9f-scheduled-publishing` | **95/95** |
| `npm run qa:phase9e-communications` | **87/87** |
| `npm run qa:migration-readiness` | **80/80** |
| `npm run qa:diagnostic-sql-syntax` | **29/29 parsed** |
| `npm run security:api` | **PASS** (0 WARN) |
| `npm run security:advisor-access` | **11/11** |
| `npm run security:service-role` | **PASS** (0 critical) |
| `npm run final:check` | **7/7** |
| `npx tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |

---

## 10. Dry-run result

```text
Remote database is up to date.
```

No real `supabase db push` executed.

---

## 11. Git commit hash

`9afe34e` — `finalize Phase 9F.3 binder release readiness`

---

## 12. Branch push result

**Pushed** to `origin/phase-9f3-binder-client-vault` at `6dcd2be` (includes NAP report; implementation at `9afe34e`).

---

## 13. Remaining human-only actions

1. Run main diagnostic in SQL Editor — confirm 65/65 EXACT_MATCH
2. Run discrepancy diagnostic — confirm zero rows
3. Merge `phase-9f3-binder-client-vault` → `main` (operator approval)
4. Deploy application
5. Enable features in order: `binder_export` → `binder_client_publication` → `document_event_notifications`
6. Execute manual acceptance tests 1–17
7. Complete `docs/PHASE_9F3_RELEASE_SIGNOFF.md`

---

## 14. Remote mutation confirmation

| Action | Performed? |
|--------|------------|
| Remote database DDL | **No** |
| Real `db push` | **No** |
| Merge to `main` | **No** |
| Vercel deploy | **No** |
| Feature flag enablement | **No** |
| Remote storage/notifications | **No** |
| Phase 9F.4 started | **No** |

---

## 15. Verdict

# READY FOR OPERATOR MERGE AND DEPLOYMENT

Automated gates pass. Schema contract diagnostic fix applied. Human SQL Editor verification, merge approval, deploy, feature enablement, and manual acceptance remain operator-owned.
