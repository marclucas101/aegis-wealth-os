# CRM V2 Phase 08 — Manual Tests

**Environment:** Staging with pilot adviser and test client  
**Prerequisites:** Migrations `202606290012`, `202606290013` applied; flags enabled per test section  
**Note:** Mark pass only when actually executed. Do not mark runtime tests passed from implementation review alone.

---

1. [ ] **NOT RUN** — Existing relationship moments audit: legacy DOB, advisor_tasks birthday, review pipeline, annual_reviews operational; no regression.
2. [ ] **NOT RUN** — Feature control `crm_v2_relationship_moments` disabled blocks adviser moments APIs (403).
3. [ ] **NOT RUN** — Feature control `crm_v2_client_profile` disabled blocks `/preferences` and `/api/preferences` (403).
4. [ ] **NOT RUN** — `clients.date_of_birth` retained authority; workspace data quality warns when missing.
5. [ ] **NOT RUN** — `relationship_moments` canonical create: POST moment returns 201 with version 1.
6. [ ] **NOT RUN** — Festive suggestion optional: client `prefer_not_to_say` yields zero suggestions.
7. [ ] **NOT RUN** — Festive confirm requires adviser action; no auto-confirmed festive moment on workspace load.
8. [ ] **NOT RUN** — `adviser_moment_overrides` exclude suppresses holiday; include forces suggestion.
9. [ ] **NOT RUN** — `crm_review_rhythm` lazy create seeds `next_due_date` from `clients.next_review_due`.
10. [ ] **NOT RUN** — `annual_reviews` table unchanged; rhythm row does not duplicate annual review snapshots.
11. [ ] **NOT RUN** — Adviser moments route `/advisor-v2/relationships/[id]/moments` loads all workspace views.
12. [ ] **NOT RUN** — Client preferences route `/preferences` loads when `crm_v2_client_profile` enabled.
13. [ ] **NOT RUN** — Client PATCH preference creates `crm_client_preference_updates` pending row.
14. [ ] **NOT RUN** — Client POST review-request creates `client_service_requests` category `review_request`.
15. [ ] **NOT RUN** — Timeline safe moment events appear; no ethnicity in timeline text.
16. [ ] **NOT RUN** — Relationship 360 engagement link shows moments summary and href.
17. [ ] **NOT RUN** — Work queue `relationshipMomentAdapter` item deep-links to moments workspace (read-only).
18. [ ] **NOT RUN** — Work queue `crmReviewRhythmAdapter` item deep-links to review_rhythm view.
19. [ ] **NOT RUN** — Work queue `clientPreferenceUpdateAdapter` item deep-links to client_preferences view.
20. [ ] **NOT RUN** — API validation: invalid moment type returns 400.
21. [ ] **NOT RUN** — DTO privacy: client GET `/api/preferences` excludes `sensitivity_class`.
22. [ ] **NOT RUN** — IDOR: cross-adviser moments access returns 403/404.
23. [ ] **NOT RUN** — Concurrency: stale `expectedVersion` on PATCH returns 409.
24. [ ] **NOT RUN** — Idempotency: duplicate moment `idempotencyKey` returns same moment.
25. [ ] **NOT RUN** — Idempotency: duplicate preference `idempotencyKey` returns same `updateId`.
26. [ ] **NOT RUN** — Idempotency: duplicate review-request returns same service request id.
27. [ ] **NOT RUN** — Accessibility: moments UI keyboard navigation and focus on primary actions.
28. [ ] **NOT RUN** — Migration rerun safety: diagnostics pass; `IF NOT EXISTS` / `DROP TRIGGER IF EXISTS` verified.
29. [ ] **NOT RUN** — Compatibility: legacy adviser portal and birthday tasks unchanged with CRM flags on.
30. [ ] **NOT RUN** — Compatibility: protection portfolio and Google Calendar unchanged.
31. [ ] **NOT RUN** — No remote activation: seed migration leaves both Phase 08 flags `enabled = false`.
32. [ ] **NOT RUN** — No advocacy schema: verify migration contains no advocacy tables.
33. [ ] **NOT RUN** — No ranking/scoring: queue items show `priority: normal` regardless of ethnicity.
34. [ ] **NOT RUN** — Queue cannot mutate moments: no complete action changes moment state.
35. [ ] **NOT RUN** — GET performs no writes: DB row counts unchanged after workspace GET.
36. [ ] **NOT RUN** — Feature disabled fail-closed: disabled flag performs no business data load.
37. [ ] **NOT RUN** — Pilot master required: moments APIs require master + pilot + allowlist + feature key.
38. [ ] **NOT RUN** — Client profile cannot grant adviser CRM: client flag on does not open `/advisor-v2`.
39. [ ] **NOT RUN** — In-app notifications only: no SMS/email/WhatsApp from moments flows.

---

## Detailed procedures (reference)

### Tests 1–6: Foundation and gating

**Test 1 — Legacy regression:** With Phase 08 flags disabled, verify `/api/advisor/clients/{id}/personal` DOB edit, `advisor_tasks` birthday type, review pipeline, and annual review routes behave as pre-Phase-08 baseline.

**Test 2–3 — Feature off:** Disable each flag independently. Call adviser `GET .../moments` and client `GET /api/preferences`. Expect 403 `feature_disabled`.

**Test 4 — DOB authority:** Client with null DOB shows "Birthday not recorded" in data quality. Set DOB via legacy personal API — workspace client preferences panel reflects date without duplicate DOB column.

**Test 5 — Create moment:** POST valid `CreateMomentInput`. Confirm `relationship_moments` row and `relationship_moment_events` `moment_created` event.

**Test 6–8 — Festive:** Set ethnicity `prefer_not_to_say` — festive list empty. Set `chinese` — CNY suggestion appears. Add `exclude` override for CNY — suggestion hidden. Confirm festive creates moment with `sensitivity_class = cultural_preference`.

### Tests 9–15: Review rhythm and routes

**Test 9 — Rhythm seed:** Client with `next_review_due` set. PATCH review-rhythm first time. Confirm `crm_review_rhythm.next_due_date` matches client column.

**Test 10 — No annual_reviews dup:** Confirm no insert into `annual_reviews` from rhythm PATCH.

**Test 11–12 — Routes:** Load adviser moments page — switch views (Festive Suggestions, Review Rhythm, Data Quality). Load client `/preferences`.

**Test 13–14 — Client writes:** PATCH preference; verify pending row. POST review-request; verify `client_service_requests.request_category`.

**Test 15–16 — Projections:** Open Relationship 360 engagement tab — timeline shows moment events without ethnicity. Overview shows moments link.

### Tests 17–26: Queue and integrity

**Test 17–19 — Queue:** Seed overdue review, pending preference, and actionable moment. Load work queue assembly. Click each item — lands on correct moments view. Confirm no in-queue complete.

**Test 20 — Validation:** POST moment with invalid `momentType` — 400.

**Test 21 — Privacy:** Inspect client preferences JSON — no adviser-only fields.

**Test 22 — IDOR:** Adviser B requests adviser A client moments UUID — 403/404.

**Test 23–26 — Concurrency/idempotency:** Replay PATCH with stale version — 409. Replay POST with same idempotency keys — same ids returned.

### Tests 27–39: Operations and prohibitions

**Test 27 — A11y:** Tab through `RelationshipMomentsClient` primary controls.

**Test 28 — Migration:** Run diagnostic triplet on staging after apply.

**Test 29–30 — Compatibility:** Spot-check protection and calendar flows with Phase 08 flags enabled.

**Test 31 — Seeds:** Query `platform_feature_controls` — both flags false after migration.

**Test 32–33 — Schema/policy:** Grep migration for advocacy; inspect queue item priority in API response.

**Test 34–35 — Read-only:** Queue navigation only; count DB rows before/after GET.

**Test 36–38 — Gates:** Disable master — 403. Enable client profile only — adviser V2 still blocked.

**Test 39 — Notifications:** Trigger preference submit — in-app notification only; no outbound email/SMS logs.

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Engineering | | | |
| Operator | | | |

**Overall:** NOT RUN — pending staging execution
