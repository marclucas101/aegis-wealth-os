# CRM V2 Phase 09 — Manual Tests

**Environment:** Staging with pilot adviser and test client  
**Prerequisites:** Migrations `202606290014`, `202606290015` applied; `crm_v2_advocacy` enabled per test section  
**Note:** Mark pass only when actually executed. Do not mark runtime tests passed from implementation review alone.

---

1. [ ] **NOT RUN** — Existing advocacy audit: `adviser_feedback` testimonials, legacy tasks, service requests, moments unchanged; no regression.
2. [ ] **NOT RUN** — Phase 9F.4 Promotions observation continues; no `promotions` writes; `legacy_promotions_write` remains false.
3. [ ] **NOT RUN** — No Promotions Stage 6: migration `202606290015` contains no `DROP` on `promotions`.
4. [ ] **NOT RUN** — Feature control `crm_v2_advocacy` disabled blocks adviser advocacy APIs (403).
5. [ ] **NOT RUN** — Feature control `crm_v2_advocacy` disabled blocks client `/api/preferences/advocacy` (403).
6. [ ] **NOT RUN** — Single feature key: no separate `crm_v2_client_advocacy` row in `platform_feature_controls`.
7. [ ] **NOT RUN** — Seed migration: `crm_v2_advocacy` has `enabled=false`, `client_visible=true`, `adviser_visible=true`.
8. [ ] **NOT RUN** — `advocacy_events` canonical create: POST event returns 201 with version 1.
9. [ ] **NOT RUN** — Introduction events: `introduction_offered` and `introduction_made` appear in introductions view.
10. [ ] **NOT RUN** — Referral events: `referral_received`, `referral_contacted`, `referral_declined` appear in referrals view.
11. [ ] **NOT RUN** — Testimonial flow: `testimonial_offered` defaults `consent_state=pending`.
12. [ ] **NOT RUN** — Do-not-ask blocks `introduction_offered` when client preference `doNotAsk=true` (400).
13. [ ] **NOT RUN** — Client PATCH preferences creates/updates `crm_client_advocacy_preferences` row.
14. [ ] **NOT RUN** — Client POST `/api/preferences/advocacy/withdraw` sets `testimonialConsent=withdrawn`.
15. [ ] **NOT RUN** — Withdrawn consent idempotent: second withdraw returns same state without error.
16. [ ] **NOT RUN** — Withdrawn→granted transition rejected without new explicit grant (400).
17. [ ] **NOT RUN** — `advocacy_domain_events` records `consent_withdrawn` on client withdraw.
18. [ ] **NOT RUN** — Adviser workspace GET loads history, summary, followUpNeeded views.
19. [ ] **NOT RUN** — Summary endpoint returns `yearlyScore` with caps applied.
20. [ ] **NOT RUN** — Empty year: client with no eligible events returns `cappedScore=null`.
21. [ ] **NOT RUN** — Score config seeds: five rows in `advocacy_score_config` after migration.
22. [ ] **NOT RUN** — Yearly score not in client GET `/api/preferences/advocacy` response.
23. [ ] **NOT RUN** — Yearly score not in relationship list API response.
24. [ ] **NOT RUN** — Relationship 360 engagement link shows advocacy summary and href.
25. [ ] **NOT RUN** — Linked appointment: POST event with `linkedAppointmentId` persists FK.
26. [ ] **NOT RUN** — Linked service request: POST event with `linkedServiceRequestId` persists FK.
27. [ ] **NOT RUN** — Linked relationship moment: POST event with `linkedRelationshipMomentId` persists FK.
28. [ ] **NOT RUN** — Work queue `advocacyEventAdapter` item appears for overdue follow-up.
29. [ ] **NOT RUN** — Work queue advocacy item has `priority: normal` regardless of event points.
30. [ ] **NOT RUN** — Work queue item deep-links to advocacy workspace `?eventId=`.
31. [ ] **NOT RUN** — Queue cannot mutate advocacy: no in-queue complete changes event state.
32. [ ] **NOT RUN** — Transition `thank_you_sent` sets `follow_up_status=completed`.
33. [ ] **NOT RUN** — Transition `deactivate` sets `active=false`.
34. [ ] **NOT RUN** — API validation: invalid `eventType` returns 400.
35. [ ] **NOT RUN** — DTO privacy: client preferences JSON excludes event notes and score.
36. [ ] **NOT RUN** — IDOR: cross-adviser advocacy access returns 403/404.
37. [ ] **NOT RUN** — Concurrency: stale `expectedVersion` on PATCH returns 409.
38. [ ] **NOT RUN** — Idempotency: duplicate event `idempotencyKey` returns same event.
39. [ ] **NOT RUN** — GET performs no writes: DB row counts unchanged after workspace GET.
40. [ ] **NOT RUN** — Feature disabled fail-closed: disabled flag performs no business data load.
41. [ ] **NOT RUN** — Pilot master required: advocacy APIs require master + pilot + allowlist + `crm_v2_advocacy`.
42. [ ] **NOT RUN** — No campaign automation: no outbound email/SMS from advocacy flows; in-app notifications only.

---

## Detailed procedures (reference)

### Tests 1–7: Foundation and gating

**Test 1 — Legacy regression:** With `crm_v2_advocacy` disabled, verify `adviser_feedback` submit, `/api/my-adviser` testimonials, `advisor_tasks`, service requests, and moments behave as pre-Phase-09 baseline.

**Test 2–3 — Promotions:** Confirm 9F.4 observation metrics still collected; grep Phase 09 migrations for `DROP TABLE promotions` — expect zero matches.

**Test 4–7 — Feature gates:** Disable `crm_v2_advocacy`. Call adviser `GET .../advocacy` and client `GET /api/preferences/advocacy`. Expect 403 `feature_disabled`. Query `platform_feature_controls` — single `crm_v2_advocacy` row with correct visibility flags.

### Tests 8–17: Events and consent

**Test 8 — Create event:** POST valid `CreateAdvocacyEventInput`. Confirm `advocacy_events` row and `advocacy_domain_events` `advocacy_event_created`.

**Test 9–10 — Views:** Load workspace — confirm filtered arrays for introductions and referrals.

**Test 11–12 — Consent:** POST `testimonial_offered` — `consent_state=pending`. Set client `doNotAsk=true` — POST `introduction_offered` returns 400.

**Test 13–17 — Client preferences:** PATCH consent; verify preference row. POST withdraw; verify domain event and notification (in-app only). Attempt adviser PATCH to re-grant withdrawn without workflow — 400.

### Tests 18–24: Score and projections

**Test 18–20 — Workspace/summary:** Load advocacy workspace views. GET summary — verify score math with seeded config. New client — `cappedScore=null`.

**Test 21–23 — Score restrictions:** Inspect client preferences JSON and relationship list — no score fields.

**Test 24 — R360:** Open Relationship 360 engagement — advocacy link present with count text.

### Tests 25–31: Integrations and queue

**Test 25–27 — FK links:** Create events with valid linked IDs; confirm FKs. Delete linked appointment — advocacy row retains with null FK.

**Test 28–31 — Queue:** Seed overdue follow-up. Load work queue — advocacy item with `priority: normal`. Click item — lands on workspace. Confirm no queue mutation.

### Tests 32–42: Integrity and prohibitions

**Test 32–33 — Transitions:** POST transition endpoints; verify state changes.

**Test 34–38 — Validation/IDOR/idempotency:** Invalid type 400; cross-adviser 403/404; stale version 409; duplicate idempotency key same event.

**Test 39–41 — Operations:** Count DB rows before/after GET. Disable master — 403. Enable client flag only — adviser V2 still requires master gate.

**Test 42 — Notifications:** Trigger consent withdraw — in-app notification only; no outbound email/SMS logs.

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Engineering | | | |
| Operator | | | |

**Overall:** NOT RUN — pending staging execution
