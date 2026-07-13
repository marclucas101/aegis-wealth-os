# CRM V2 Phase 13 — Day 1 Real Client Pilot

**Date prepared:** 2026-07-13  
**Status:** Limited real-client pilot validation — **not production launch approval**

---

## Objective

Validate CRM V2 with **one low-risk, consenting real client** under tight operator control. Confirm adviser and client surfaces work for a single assigned relationship before considering a second client.

This is **not** a production launch, book-wide rollout, or automatic outreach programme.

---

## Strict pilot scope (Day 1)

| In scope | Out of scope |
|----------|--------------|
| **One** pilot adviser on `CRM_V2_PILOT_USER_IDS` | Multiple advisers |
| **One** invited real client (assigned to pilot adviser) | Bulk client invites |
| Modules enabled **only** for Day 1 checklist below | All CRM V2 flags at once |
| Manual observation by adviser + operator | Automated campaigns or bulk email/SMS |
| Legacy `/advisor` remains available | Phase 14 cutover |
| Draft-only communications (if flag on) | External message send without governed approval |
| Google Calendar **only** if explicitly in Day 1 plan | Production calendar on first sync test |

### Day 1 recommended enabled flags (operator — not changed by this doc)

Enable **only** what you will test with the client. Suggested minimal set:

| Flag | Adviser | Client | Day 1 use |
|------|---------|--------|-----------|
| `crm_v2_master` | yes | — | Required |
| `crm_v2_pilot_mode` | yes | — | Required |
| `crm_v2_relationships` | yes | — | Adviser prep |
| `crm_v2_appointments_adviser` | yes | — | Adviser prep |
| `crm_v2_appointments_client` | — | yes (`client_visible=true`) | Client appointment view/request |
| `crm_v2_client_service` | optional | yes | Only if testing `/requests` |

**Defer Day 1 unless explicitly approved:** `crm_v2_communications` (send risk), `crm_v2_advocacy`, `crm_v2_protection_portfolio`, `crm_v2_client_profile`, `crm_v2_google_calendar`, `crm_v2_today`, reports, operations.

---

## Preconditions before inviting the client

All must be satisfied. Mark **NOT RUN** until evidence exists.

| # | Precondition | Evidence required |
|---|--------------|-------------------|
| 1 | `CRM_V2_PILOT_USER_IDS` set in **deployment** env (saved on disk locally); server restarted | `/api/advisor-v2/shell` → `available: true` for pilot |
| 2 | `crm_v2_master` + `crm_v2_pilot_mode` enabled in DB | SQL flag query output |
| 3 | Intended Day 1 client flags enabled; others off | SQL + discrepancy diagnostic empty |
| 4 | Pilot adviser can open `/advisor-v2` and assigned relationship | Screenshot |
| 5 | Non-pilot adviser denied at `/advisor-v2` | Screenshot or test note |
| 6 | Legacy `/advisor` works for pilot adviser | Screenshot |
| 7 | `npm run qa:crm-v2-pilot-readiness` passed (repository) | CI/log — **382/382** on 2026-07-13 |
| 8 | Rollback drill completed once on staging/local | Operator log entry |
| 9 | Client assigned to pilot adviser in `clients` / assignment model | SQL or admin UI |
| 10 | Client has working portal login (or invite sent via existing flow) | Operator confirmation |
| 11 | Master manual acceptance rows for Day 1 modules **not** pre-marked PASS | Checklist review |
| 12 | Issue log ready | `docs/CRM_V2_PHASE_13_PILOT_ISSUE_LOG.md` |

---

## Adviser account

| Requirement | Detail |
|-------------|--------|
| Role | `advisor` or `admin` in `public.users` |
| Allowlist | Auth user UUID in `CRM_V2_PILOT_USER_IDS` |
| Book | Client must be in pilot adviser's assigned book only |
| Training | Adviser reads `CRM_V2_PHASE_13_DAY_1_CLIENT_SCRIPT.md` follow-up questions |
| Prohibited uses | Advocacy score for prioritisation; ethnicity for targeting; bulk outreach |

---

## Client selection criteria (low-risk)

| Criterion | Required |
|-----------|----------|
| Existing trust relationship with pilot adviser | Yes |
| Already on platform or clean invite path | Yes |
| Assigned to pilot adviser only | Yes |
| Comfortable with beta/pilot language | Yes |
| Low sensitivity (no acute crisis, dispute, or compliance matter) | Yes |
| Willing to give feedback within 48 hours | Yes |
| Single household / single login for Day 1 | Preferred |

---

## Client exclusion criteria

Do **not** invite if any apply:

| Exclusion | Reason |
|-----------|--------|
| Unassigned or shared across advisers | IDOR / wrong-book risk |
| High-sensitivity financial or health crisis | Not suitable for pilot |
| Legal dispute, complaint, or vulnerable-client flag | Reputational and duty-of-care risk |
| Requires immediate outbound communications | No automatic outreach in pilot |
| Cannot authenticate to client portal | Blocks validation |
| Expects guaranteed outcomes or full production parity | Misaligned expectations |
| Bulk invite to family members on Day 1 | Scope violation |

---

## Client invite message

Use scripts in `docs/CRM_V2_PHASE_13_DAY_1_CLIENT_SCRIPT.md`.  
Send via existing **WhatsApp or email** channel — not via CRM automated send on Day 1.

Include:

- Pilot is limited and optional
- How to log in (existing client portal URL)
- What to try (1–2 routes only)
- Who to contact if something fails (adviser direct line)
- No guarantee of availability or timelines

---

## Exact adviser routes to check before inviting

Complete as pilot adviser. Record in `CRM_V2_PHASE_13_DAY_1_GO_NO_GO.md`.

| # | Route | Gate | Day 1 |
|---|-------|------|-------|
| A1 | `/api/advisor-v2/shell` | master + pilot + allowlist | Required |
| A2 | `/advisor-v2` | layout `assertCrmV2Access()` | Required |
| A3 | `/advisor-v2/relationships` | `crm_v2_relationships` | Required |
| A4 | `/advisor-v2/relationships/{clientRelationshipId}` | assignment + flag | Required |
| A5 | `/advisor-v2/appointments` | `crm_v2_appointments_adviser` | Required if client appointments on |
| A6 | `/advisor-v2/appointments/new` | same | If testing booking flow |
| A7 | `/advisor` (legacy) | adviser auth | Required |
| A8 | `/advisor-v2/operations` | `crm_v2_operations` | Optional diagnostics |

**Code gates:** `lib/crm-v2/access.ts` → `assertCrmV2Access()` in `app/advisor-v2/layout.tsx`.

---

## Exact client routes to test

Only routes whose flags are **enabled** with `client_visible=true`.

| # | Route | Gate function | Flag |
|---|-------|---------------|------|
| C1 | `/appointments` | `assertCrmV2ClientAppointmentsAccess()` | `crm_v2_appointments_client` |
| C2 | `/appointments/request` | same | same |
| C3 | `/appointments/{id}` | same | same |
| C4 | `/requests` | `assertCrmV2ClientServiceAccess()` | `crm_v2_client_service` |
| C5 | `/requests/new` or submit flow | same | if enabled |
| C6 | `/actions` | same | if enabled |
| C7 | `/protection` | `assertCrmV2ClientProtectionAccess()` | only if explicitly enabled |
| C8 | `/preferences` | `assertCrmV2ClientProfileAccess()` | defer Day 1 |
| C9 | `/messages` | `assertCrmV2ClientMessagesAccess()` | defer Day 1 (send risk) |

Client must **not** access `/advisor-v2`.

---

## Google Calendar privacy checks

**Only if** `crm_v2_google_calendar` enabled for Day 1 (default: **defer**).

| # | Check | Pass criterion |
|---|-------|----------------|
| G1 | Sync uses `sendUpdates: "none"` on manual sync API | Code: `app/api/advisor-v2/appointments/[appointmentId]/google-calendar/sync/route.ts` |
| G2 | Event title is appointment-safe template | Per `CRM_V2_PHASE_05_EVENT_PRIVACY.md` |
| G3 | No ethnicity, advocacy, policy numbers, notes in Google event | Manual calendar inspection |
| G4 | Test calendar / staging OAuth — not production personal calendar first | Operator log |
| G5 | Disconnect path works | `/advisor-v2/settings/integrations/google-calendar` or legacy profile |
| G6 | Rollback: disable `crm_v2_google_calendar` | `CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md` §6 |

---

## Service request checks

**If** `crm_v2_client_service` enabled:

| # | Check | Pass criterion |
|---|-------|----------------|
| S1 | Client sees only own requests on `/requests` | Client confirmation |
| S2 | Submit one low-risk test request (clearly labelled "pilot test") | Row in DB; adviser sees in V2 service |
| S3 | Client cannot see other clients' requests | No cross-client IDs in UI |
| S4 | Adviser assignment enforced on API | `app/api/requests/*` gated |
| S5 | Rollback disables client submit | Flag off → unavailable message |

---

## Appointment request checks

**If** `crm_v2_appointments_client` enabled:

| # | Check | Pass criterion |
|---|-------|----------------|
| P1 | Client dashboard loads `/appointments` | No "unavailable" message |
| P2 | Request flow `/appointments/request` completes or saves draft | Client + adviser see consistent state |
| P3 | Client sees only own appointments | No other client data |
| P4 | Adviser sees appointment in `/advisor-v2/appointments` | Assignment scoped |
| P5 | No unintended Google sync unless calendar flag on | Operator verification |
| P6 | Cancel/decline paths fail closed for wrong client | Optional if time permits |

---

## Communications checks

**Default Day 1: defer** `crm_v2_communications` client visibility.

If enabled for adviser drafts only:

| # | Check | Pass criterion |
|---|-------|----------------|
| M1 | Adviser can create **draft** only | `POST /api/advisor-v2/communications` — no external delivery |
| M2 | No automatic email/SMS/WhatsApp from CRM V2 pilot | Delivery logs empty for pilot test |
| M3 | Client `/messages` not enabled unless explicit go/no-go | Flag `client_visible` false recommended |
| M4 | Governed publication workflow unchanged | Phase 9E rules apply |

---

## Data privacy checks

| # | Check | Pass criterion |
|---|-------|----------------|
| D1 | Client sees only own data on all enabled routes | Client + adviser confirm |
| D2 | No storage paths or signed URLs in client UI | Visual inspection |
| D3 | No advocacy score or ranking in client UI | Visual inspection |
| D4 | No ethnicity surfaced except optional preferences (if enabled) — not used for targeting | Adviser confirms |
| D5 | API responses use `private, no-store` on CRM V2 routes | Network tab |
| D6 | Wrong relationship/appointment ID returns safe denial | Adviser test with forged ID |
| D7 | Pilot data retained on rollback (flags off) | Documented — no delete |

---

## Rollback decision tree

```text
Incident observed?
├─ Cross-client data visible → L0 disable crm_v2_master + log Critical → STOP
├─ Unintended external send → disable crm_v2_communications + log Critical → STOP
├─ Client route only broken → L2 disable client flag(s) only → PAUSE client invite
├─ Google event leaked sensitive data → disable crm_v2_google_calendar + disconnect → PAUSE calendar
├─ Adviser V2 broken, legacy OK → L0 or L3 → PAUSE pilot
├─ Single module bug, no data leak → L1 disable module flag → CONTINUE or PAUSE
└─ Low UX issue only → log Medium → CONTINUE with note
```

SQL references: `docs/CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md` §2.

---

## Result definitions

| Status | Meaning | When to use |
|--------|---------|-------------|
| **PASS** | Check executed; meets criterion; evidence linked | Only with screenshot, SQL output, or log |
| **FAIL** | Check executed; criterion not met | Blocks expand; may trigger rollback |
| **BLOCKED** | Cannot run (flag off, access denied, client unavailable) | Document blocker |
| **NOT RUN** | Not yet executed | Default for all Day 1 rows until operator runs |

**Do not mark PASS** from repository QA alone for live client tests.

---

## 24–48 hour observation rule

After the first real client completes Day 1 tasks:

1. **Do not** invite a second client for **24–48 hours**.
2. Monitor issue log, adviser feedback, and flag/discrepancy SQL daily.
3. Confirm no unintended records, sends, or calendar events.
4. Review go/no-go in `CRM_V2_PHASE_13_DAY_1_GO_NO_GO.md`.
5. Only then consider **one** additional low-risk client with written operator approval.

---

## Explicit statement

**This is limited real-client pilot validation, not production launch approval.**

Repository QA passing does not constitute client pilot sign-off. All 422 master manual acceptance tests remain predominantly **NOT RUN** until operator execution.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `CRM_V2_PHASE_13_DAY_1_CLIENT_SCRIPT.md` | Client-facing wording |
| `CRM_V2_PHASE_13_DAY_1_GO_NO_GO.md` | Checklists and decision |
| `CRM_V2_PHASE_13_PILOT_ISSUE_LOG.md` | Incident log |
| `CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md` | Ongoing pilot rules |
| `CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md` | Rollback SQL |
