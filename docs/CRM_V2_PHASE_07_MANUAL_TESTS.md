# CRM V2 Phase 07 — Manual Tests

**Environment:** Staging with pilot adviser and test client  
**Prerequisites:** Migrations `202606290010`, `202606290011` applied; flags enabled per test section  
**Note:** Mark pass only when actually executed. Do not mark runtime tests passed from implementation review alone.

---

1. [ ] Existing protection audit — legacy report, vault, discover, scoring remain operational; no regression.
2. [ ] Source document authority — vault save works; `sourceDocumentId` links on confirm; no duplicate document table.
3. [ ] Structured policy authority — confirmed policy appears in adviser portfolio with version pointer.
4. [ ] Feature control — `crm_v2_protection_portfolio` disabled blocks adviser APIs (403).
5. [ ] Extraction provisional state — new extractions start `provisional`; not client-visible.
6. [ ] Adviser confirmation mandatory — no auto-confirm on report save or extraction create.
7. [ ] Correction preserves extraction — corrected confirm retains `source_extraction_id` on version.
8. [ ] Rejection blocks portfolio — rejected extraction never creates policy row.
9. [ ] Version preservation — re-confirm supersedes prior version; history list shows superseded.
10. [ ] Deduplication adviser decision — candidates shown; no silent merge without `matchPolicyId`.
11. [ ] Adviser portfolio route — `/advisor-v2/relationships/[id]/protection` loads summary and awaiting list.
12. [ ] Client safe summary route — `/protection` shows confirmed policies only.
13. [ ] Correction via service requests — client POST creates `protection_correction` request.
14. [ ] Report generator integration — POST extractions from `ProtectionReportInput` succeeds.
15. [ ] Binder excludes unconfirmed — client/binder surfaces omit provisional data (API filter).
16. [ ] Appointment preparation safe counts — meeting prep shows integers/booleans only.
17. [ ] Work queue read-only projection — extraction item appears; no direct complete.
18. [ ] API validation schemas — invalid category/body returns 400; unexpected fields rejected.
19. [ ] DTO privacy masking — no storage paths; masked policy ref on adviser DTO only.
20. [ ] IDOR assignment scoping — cross-adviser portfolio/extraction access returns 403/404.
21. [ ] Concurrency expected version — stale version on confirm/reject returns 409.
22. [ ] Idempotency extraction key — duplicate import returns same extraction IDs.
23. [ ] Accessibility portfolio UI — keyboard navigation and focus on verification panel.
24. [ ] Migration rerun safety — diagnostics pass; `IF NOT EXISTS` patterns verified operator-side.
25. [ ] Compatibility legacy report — print and vault save unchanged with CRM flag on/off.
26. [ ] No remote activation — seed migration leaves `enabled = false`.
27. [ ] No insurer API — no outbound insurer calls from protection flows.
28. [ ] No automatic advice — portfolio data does not trigger recommendations.
29. [ ] No duplicate document authority — documents table only vault SOT.
30. [ ] Queue cannot mutate policies — queue navigation only; confirm via API.
31. [ ] GET performs no writes — observe DB row counts unchanged after GET portfolio.
32. [ ] Client cannot confirm — client session on adviser confirm API returns 403.
33. [ ] Stale review conflict 409 — concurrent reject/confirm with old version fails closed.
34. [ ] Coverage allowlist categories — invalid category coerced to `other` in mapper.
35. [ ] Riders versioned JSON — riders persist on version row and appear adviser detail.
36. [ ] Event audit safe metadata — domain events contain IDs only, not full policy numbers.
37. [ ] Performance bounded lists — portfolio returns `bounded: true` when over max policies test seed.
38. [ ] Feature disabled fail closed — client `/protection` 403 when flag off.
39. [ ] Pilot master required — protection APIs require master + pilot + allowlist + feature key.

---

## Detailed procedures (reference)

### Tests 1–6: Foundation and gating

**Test 1 — Legacy regression:** With `crm_v2_protection_portfolio` disabled, open `/advisor/protection-report`, generate preview, print, and save PDF to vault for pilot client. Confirm success messages and vault listing unchanged from pre-Phase-07 baseline.

**Test 2 — Vault authority:** After vault save, note `document.id`. POST extractions with `sourceDocumentId` set. Confirm extraction detail shows `sourceDocumentAvailable: true`. Confirm policy links same document after adviser confirm. Verify no new document tables in schema.

**Test 3 — Structured authority:** Confirm one extraction. Reload adviser portfolio GET. Expect policy in `policies` array with `currentVersionNumber >= 1` and `verificationState` confirmed or corrected.

**Test 4 — Feature off:** Disable `crm_v2_protection_portfolio`. Call `GET /api/advisor-v2/relationships/{id}/protection`. Expect 403 `feature_disabled`.

**Test 5 — Provisional:** POST extractions without confirm. Call client `GET /api/protection`. Expect policy count zero while extraction exists in adviser `awaitingVerification`.

**Test 6 — No auto-confirm:** Save vault PDF only. Query `protection_extractions` — expect zero new rows from vault save alone.

### Tests 7–15: Verification workflow

**Test 7 — Correction link:** Use correct endpoint with `correctedFields`. Inspect `protection_policy_versions.source_extraction_id` matches extraction UUID.

**Test 8 — Reject:** Reject extraction with reason. Confirm no `protection_policies` row with `resulting_policy_id`. Client portfolio remains empty for that policy.

**Test 9 — Supersede:** Confirm policy twice (second with `matchPolicyId`). `GET .../versions` shows version 1 `superseded` and version 2 `confirmed` or `corrected`.

**Test 10 — Dedup:** Import report matching existing insurer/ref. UI/API shows `duplicateCandidatePolicyIds`. Confirm without `matchPolicyId` creates second policy; with `matchPolicyId` increments version on first.

**Test 11–12 — Routes:** Load adviser portfolio page — verify Awaiting Verification panel and policy table. Load client `/protection` — only confirmed policies render.

**Test 13 — Service request:** Client POST correction. Verify `client_service_requests.request_category = protection_correction` in DB or Service workspace UI.

**Test 14 — Report POST:** Valid `ProtectionReportInput` returns 201 with `extractionIds` length matching policy count.

**Test 15 — Binder rule:** Confirm client API never returns `provisional` in any field; spot-check network response JSON.

### Tests 16–22: Integrations and integrity

**Test 16 — Appointment prep:** Open appointment with protection prep card. Fields are counts/booleans only — no policy numbers or document paths.

**Test 17 — Work queue:** Load adviser Today/queue. Click protection extraction item — lands on portfolio with `extractionId` query param. No in-queue "complete" action.

**Test 18 — Validation:** POST confirm without `expectedVersion` → 400. POST with `clientId` in body → 400.

**Test 19 — Privacy:** Inspect all client protection JSON responses for absence of `storage_path`, `sourceDocumentId`, full policy numbers.

**Test 20 — IDOR:** As adviser B, request adviser A client portfolio UUID — 403/404.

**Test 21–22 — Concurrency/idempotency:** Replay confirm with same `expectedVersion` after success — idempotent 200. Increment version on second tab, submit stale version — 409.

### Tests 23–31: UX and operations

**Test 23 — a11y:** Tab through verification panel; focus visible on confirm/reject buttons.

**Test 24 — Migration:** Run verify SQL diagnostics post-apply; all probes green.

**Test 25 — Legacy compat:** Repeat test 1 with feature enabled — report still works.

**Test 26 — Seed default:** Fresh apply of `202606290010` — `enabled` is false.

**Test 27–28 — Scope:** Network monitor during tests — no external insurer host calls; no recommendation toasts.

**Test 29 — Document SOT:** Schema inspection — only `documents` stores files.

**Test 30–31 — Queue/GET:** Queue adapter code path has no UPDATE. Snapshot `protection_domain_events` count before/after GET portfolio — unchanged.

### Tests 32–39: Security and flags

**Test 32 — Client forbidden:** Client cookie on `POST .../confirm` → 403.

**Test 33 — 409:** Two rapid confirms with same version from two browser tabs — one fails 409.

**Test 34 — Categories:** Import policy with nonsense type — maps to `other` in extracted fields.

**Test 35 — Riders:** Report policy with rider text — confirm — riders array in version detail.

**Test 36 — Events:** Query latest `protection_domain_events` — `safe_metadata` has no `policyNumber` key.

**Test 37 — Bounded:** Seed >50 policies (fixture) — API returns `bounded: true`.

**Test 38 — Client flag:** Set `client_visible = false` — client GET 403 while adviser may still access if enabled.

**Test 39 — Pilot stack:** Disable `crm_v2_pilot_mode` only — protection API 403 despite feature enabled.

---

## Expected API responses (spot-check)

### Adviser portfolio GET (200)

```json
{
  "ok": true,
  "portfolio": {
    "portfolioSummary": { "confirmedPolicyCount": 1, "awaitingVerificationCount": 1 },
    "policies": [{ "verificationState": "confirmed", "policyRefMasked": "***1234" }],
    "awaitingVerification": [{ "reviewStatus": "provisional" }]
  }
}
```

### Client portfolio GET (200, confirmed only)

```json
{
  "ok": true,
  "portfolio": {
    "policies": [{ "displayName": "Term Life", "coverageSummary": "death" }],
    "bounded": false
  }
}
```

### Confirm POST (200)

```json
{ "ok": true, "policyId": "uuid", "versionId": "uuid" }
```

### Stale version POST (409)

```json
{ "ok": false, "reason": "conflict", "error": "Stale extraction review" }
```

---

## Database assertions (optional SQL)

After confirm of one policy:

```sql
SELECT p.display_name, v.verification_state, v.version_number
FROM protection_policies p
JOIN protection_policy_versions v ON v.id = p.current_confirmed_version_id
WHERE p.client_id = :test_client_id;
-- Expect one row, state confirmed or corrected

SELECT adviser_review_status, resulting_policy_id
FROM protection_extractions
WHERE client_id = :test_client_id;
-- Confirmed rows have non-null resulting_policy_id
```

After reject:

```sql
SELECT count(*) FROM protection_policies WHERE client_id = :id;
-- Count unchanged vs pre-reject
```

---

## Regression bundle (run after pilot sign-off)

| Suite | Command |
|-------|---------|
| Phase 07 structural | `npm run qa:crm-v2-protection` |
| Service (correction deps) | `npm run qa:crm-v2-service` |
| Work queue | `npm run qa:phase10-work-queue-core` |
| Advisor access | `npm run security:advisor-access` |
| Typecheck | `npx tsc --noEmit` |

---

## Defect severity guide

| Severity | Example | Block release? |
|----------|---------|----------------|
| P0 | Client sees provisional policy | Yes |
| P0 | Cross-adviser policy read | Yes |
| P1 | 409 not returned on stale confirm | Yes |
| P2 | Missing stale badge adviser UI | No — fix next sprint |
| P3 | Copy typo in empty state | No |

---

## Environment matrix

| Variable | Staging pilot | Production |
|----------|---------------|------------|
| `crm_v2_master` | true | operator |
| `crm_v2_pilot_mode` | true | operator |
| `crm_v2_protection_portfolio` | false until test | false until Gate G8 |
| `crm_v2_client_service` | true for tests 13 | operator |

---

## Sign-off

| Role | Name | Date | Pass/Fail |
|------|------|------|-----------|
| Pilot adviser | | | |
| QA operator | | | |
| Engineering | | | |
