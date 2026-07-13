# CRM V2 Phase 10 — Manual Tests

**Environment:** Staging with pilot adviser and test client  
**Prerequisites:** Migrations `202606290016`, `202606290017` applied; `crm_v2_communications` enabled per test section  
**Note:** Mark pass only when actually executed. Do not mark runtime tests passed from implementation review alone.

---

1. [ ] **NOT RUN** — Communications feature disabled blocks adviser workspace (`GET /api/advisor-v2/communications` → 403).
2. [ ] **NOT RUN** — Client messages feature disabled blocks client messages (`GET /api/messages` → 403).
3. [ ] **NOT RUN** — Adviser sees only assigned clients (cross-book `clientId` filter → 403/404).
4. [ ] **NOT RUN** — Client sees only their own messages (cross-client `messageId` → 404).
5. [ ] **NOT RUN** — Adviser creates draft (`POST /api/advisor-v2/communications` → 201, `lifecycle_status=draft`).
6. [ ] **NOT RUN** — Adviser uses approved template (`templateKey` + variables → rendered body on record).
7. [ ] **NOT RUN** — Template variables render safely (HTML in variable values escaped in output).
8. [ ] **NOT RUN** — Unsafe template variable is rejected (`account_number` → 400).
9. [ ] **NOT RUN** — Adviser logs phone call (`channel=phone_call_log` → `lifecycle_status=logged`).
10. [ ] **NOT RUN** — Adviser links communication to appointment (`sourceType=appointment`, `sourceId` set).
11. [ ] **NOT RUN** — Adviser links communication to service request (`sourceType=client_service_request`).
12. [ ] **NOT RUN** — Adviser links communication to protection correction (`sourceType=protection_correction_request`).
13. [ ] **NOT RUN** — Adviser links communication to relationship moment (`sourceType=relationship_moment`).
14. [ ] **NOT RUN** — Adviser links communication to advocacy event (`sourceType=advocacy_event`).
15. [ ] **NOT RUN** — Client-visible message appears only when explicitly marked visible and sent/logged.
16. [ ] **NOT RUN** — Adviser-only draft remains hidden from client (`GET /api/messages` excludes draft).
17. [ ] **NOT RUN** — Pending review draft remains hidden from client.
18. [ ] **NOT RUN** — Client replies to visible message (`POST /api/messages/[id]/reply` → 201, `direction=inbound`).
19. [ ] **NOT RUN** — Client cannot access another client's message (guessed UUID → 404).
20. [ ] **NOT RUN** — Preference conflict warning appears on adviser DTO when `do_not_contact` or marketing opt-out.
21. [ ] **NOT RUN** — Marketing opt-out blocks campaign-style message (`mark_sent` → 400 when `promotional_content=false`).
22. [ ] **NOT RUN** — Do-not-contact is respected (`POST` create draft → 400 when `do_not_contact=true`).
23. [ ] **NOT RUN** — No automatic birthday or festive message is sent (no scheduler; moment create does not create record).
24. [ ] **NOT RUN** — No advocacy-score-based communication is suggested (queue `priority=normal`; no score in DTO).
25. [ ] **NOT RUN** — No ethnicity-based communication is suggested (no targeting code paths).
26. [ ] **NOT RUN** — No automated email, SMS or WhatsApp is sent (`mark_sent` sets `delivery_state=logged_only` only).
27. [ ] **NOT RUN** — Notification is in-app only (no Resend/SMS provider logs on CRM V2 transition).
28. [ ] **NOT RUN** — Duplicate draft creation is idempotent (same `idempotencyKey` → same record).
29. [ ] **NOT RUN** — Stale update returns conflict (PATCH with old `expectedVersion` → 409).
30. [ ] **NOT RUN** — Work queue projects follow-up action only (`communicationRecordAdapter` item when `requiresAction=true`).
31. [ ] **NOT RUN** — Queue cannot mutate communication source (no complete handler; record unchanged after queue load).
32. [ ] **NOT RUN** — Timeline shows safe communication event (domain event recorded; no body in projection).
33. [ ] **NOT RUN** — Raw provider errors are hidden (API returns `toPublicErrorMessage` text only).
34. [ ] **NOT RUN** — Client DTO excludes internal notes and template internals (no `templateId`, `threadId`, `sourceId`).
35. [ ] **NOT RUN** — Legacy adviser portal remains operational (`/advisor/insights` unchanged).
36. [ ] **NOT RUN** — Phase 9E communications remain operational (`/insights`, `governed_content` publish flow).
37. [ ] **NOT RUN** — Promotions Phase 9F.4 observation remains unchanged (no `promotions` writes).
38. [ ] **NOT RUN** — No Promotions Stage 6 appears (grep Phase 10 migrations for `DROP TABLE promotions` → zero).
39. [ ] **NOT RUN** — Protection portfolio remains unchanged (Phase 07 APIs and tables unaffected).
40. [ ] **NOT RUN** — Advocacy remains non-ranking (score not in communications; queue priority normal).
41. [ ] **NOT RUN** — Relationship moments remain unchanged (no auto-communication on moment create).
42. [ ] **NOT RUN** — Google Calendar remains unchanged (appointment APIs unaffected).
43. [ ] **NOT RUN** — Mobile layout works (`/messages` and `/advisor-v2/communications` responsive).
44. [ ] **NOT RUN** — Keyboard and focus behavior works (reply form, workspace navigation).
45. [ ] **NOT RUN** — GET requests perform no writes (DB row counts unchanged after workspace/messages GET).
46. [ ] **NOT RUN** — Migrations remain unapplied (pre-operator-apply verification per runbook).
47. [ ] **NOT RUN** — Features remain disabled (`crm_v2_communications.enabled=false` until operator enable).

---

## Detailed procedures (reference)

### Tests 1–4: Feature gates and IDOR

**Test 1–2 — Feature gates:** Disable `crm_v2_communications`. Call adviser `GET /api/advisor-v2/communications` and client `GET /api/messages`. Expect 403 `feature_disabled`.

**Test 3 — Adviser scope:** As Adviser A, pass `clientId` for Adviser B's client. Expect 403/404.

**Test 4 — Client scope:** As Client A, `GET /api/messages/{clientB-messageId}`. Expect 404.

### Tests 5–14: Create, template, and source links

**Test 5 — Create draft:** POST valid `CreateCommunicationDraftInput`. Confirm `crm_communication_records` row, thread created, domain event `draft_created`.

**Test 6–8 — Templates:** POST with `templateKey=service_request_update_v1` and valid variables. Confirm rendered body. POST with invalid variable key — 400.

**Test 9 — Phone log:** POST `channel=phone_call_log` — immediate `lifecycle_status=logged`.

**Test 10–14 — Source links:** Create drafts with each `sourceType`; confirm `source_linked` thread and persisted `source_id`. Verify linked domain tables unchanged.

### Tests 15–22: Visibility and consent

**Test 15–17 — Client visibility:** Create draft `client_visibility=adviser_only` — client inbox empty. Transition to sent with `client_visible` — appears in `/api/messages`. Pending review hidden throughout.

**Test 18–19 — Reply and IDOR:** Client replies to visible outbound message — 201. Cross-client message access — 404.

**Test 20–22 — Preferences:** Set `do_not_contact` — adviser DTO shows `preference_conflict`; create blocked. Set marketing opt-out — `mark_sent` blocked.

### Tests 23–29: Prohibitions and integrity

**Test 23 — No festive auto-send:** Create relationship moment with date today — confirm no `crm_communication_records` row auto-created.

**Test 24–26 — No automation:** Inspect queue priority; grep logs for email/SMS provider on `mark_sent` — none.

**Test 27 — In-app only:** Transition client-visible message — `client_notifications` row created; no outbound email.

**Test 28–29 — Idempotency/concurrency:** Duplicate `idempotencyKey` returns same record. Stale `expectedVersion` on PATCH — 409.

### Tests 30–34: Queue and DTO privacy

**Test 30–31 — Queue:** Seed `pending_review` record. Load work queue — item with `priority=normal`. Confirm queue load does not UPDATE source table.

**Test 32 — Domain events:** Transition record — row in `crm_communication_domain_events`.

**Test 33–34 — Error/DTO hygiene:** Force server error — no stack trace in JSON. Client message JSON — no template/thread fields.

### Tests 35–42: Regression

**Test 35–42 — Cross-phase:** Smoke test legacy adviser portal, insights feed, promotions read-only, protection portfolio, advocacy workspace, moments, Google Calendar — no regressions.

### Tests 43–47: UX and operations

**Test 43–44 — UI:** Mobile viewport and keyboard tab order on messages and communications pages.

**Test 45 — Read-only GET:** Count `crm_communication_records` before/after GET workspace — unchanged.

**Test 46–47 — Operator state:** Before apply/enable — confirm migrations not applied and feature flag `enabled=false` per runbook.

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Engineering | | | |
| Operator | | | |

**Overall:** NOT RUN — pending staging execution
