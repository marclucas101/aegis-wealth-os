# CRM V2 — Phase 01 Manual Tests

**Phase:** 01  
**Branch:** `crm-v2-01-shell`  
**Document version:** 2026-06-29

Operator must provide pilot adviser UUID at test time — **do not commit real pilot IDs to this repository**.

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| Branch | `crm-v2-01-shell` checked out |
| Dev server | `npm run dev` (or staging deployment) |
| Migration | `202606290001_phase01_crm_v2_feature_controls.sql` — **not applied** unless test explicitly requires applied state |
| Environment | `CRM_V2_PILOT_USER_IDS` set only when pilot-access tests are run |
| Test accounts | Adviser (pilot), adviser (non-pilot), client, admin (non-adviser), unauthenticated |

### Environment variables

| Variable | When needed | Example format |
|----------|-------------|----------------|
| `CRM_V2_PILOT_USER_IDS` | Tests 7–9, 15–18, 21–23 | `uuid-1,uuid-2` (comma-separated auth user IDs) |

### Migration state

Record whether `202606290001` appears in `supabase_migrations.schema_migrations` before executing tests that depend on DB-seeded flags.

### Test account roles

| Role | Purpose |
|------|---------|
| Pilot adviser | Auth user ID in `CRM_V2_PILOT_USER_IDS` when flags enabled |
| Non-pilot adviser | Valid adviser not in allowlist |
| Client | `client` role |
| Admin | `admin` role without adviser role |
| Unauthenticated | Signed out |

---

## Checklist

| # | Test | Steps | Expected result | Actual result | Evidence | Operator sign-off |
|---|------|-------|-----------------|---------------|----------|-------------------|
| 1 | Migration is not yet applied | Run `npx supabase db push --dry-run` or check `schema_migrations` for `202606290001` | Only pending migration is Phase 01 feature-control seed; not applied in production | NOT RUN | | |
| 2 | Feature absent or disabled blocks `/advisor-v2` | With `crm_v2_master` disabled (default), visit `/advisor-v2` as any adviser | `CrmV2AccessDenied` — "CRM V2 is not available"; no shell nav | NOT RUN | | |
| 3 | Disabled access loads no business data | On denied view, inspect Network tab | No client/appointment/financial API requests | NOT RUN | | |
| 4 | Feature enabled without pilot configuration remains blocked | Enable `crm_v2_master` only; leave `crm_v2_pilot_mode` disabled | Access denied — same generic CRM message | NOT RUN | | |
| 5 | Empty pilot configuration remains blocked | Enable both flags; unset or set `CRM_V2_PILOT_USER_IDS=""` | Access denied | NOT RUN | | |
| 6 | Malformed pilot configuration remains blocked | Enable both flags; set `CRM_V2_PILOT_USER_IDS=not-a-uuid` | Access denied | NOT RUN | | |
| 7 | Feature enabled with non-pilot adviser remains blocked | Enable both flags; valid allowlist excluding test adviser | Access denied | NOT RUN | | |
| 8 | Approved pilot adviser can open `/advisor-v2` | Enable both flags; allowlist includes test adviser UUID; restart server | Shell renders with foundation landing | NOT RUN | | |
| 9 | Pilot adviser can open every placeholder route | As pilot adviser, visit all 9 module routes | Phase placeholder content only; no errors | NOT RUN | | |
| 10 | Client cannot access any CRM V2 route | Log in as client; visit `/advisor-v2` and child paths | `AdvisorAccessDenied` or adviser access required | NOT RUN | | |
| 11 | Unauthenticated user follows established authentication behavior | Sign out; visit `/advisor-v2` | Existing unauthenticated adviser denial flow | NOT RUN | | |
| 12 | Admin behavior matches Phase 00 blueprint | Log in as admin (non-adviser); visit `/advisor-v2` | Denied — no CRM access, no impersonation | NOT RUN | | |
| 13 | `/advisor` contains no CRM V2 navigation | Visit `/advisor` as adviser | No link to `/advisor-v2` in sidebar | NOT RUN | | |
| 14 | `/advisor` continues functioning | Visit `/advisor`, `/advisor/clients` (or equivalent) | Unchanged legacy behavior | NOT RUN | | |
| 15 | Client portal remains unchanged | Visit `/dashboard`, `/my-adviser` as client | Unchanged behavior | NOT RUN | | |
| 16 | Desktop navigation works | Pilot adviser — viewport ≥ 1024px | Sidebar visible; primary + More links navigate correctly; active state highlights | NOT RUN | | |
| 17 | Mobile navigation works | Pilot adviser — narrow viewport | Hamburger opens/closes nav; Escape closes; overlay dismisses | NOT RUN | | |
| 18 | Keyboard navigation and focus states work | Tab through nav links and mobile toggle | `focus-visible` outline visible; links activatable | NOT RUN | | |
| 19 | Loading state renders safely | Trigger slow navigation (throttle) to `/advisor-v2` | `CrmV2LoadingSkeleton` — no data or IDs | NOT RUN | | |
| 20 | Forced error displays no raw exception | Dev-only: throw in a test page or use error boundary trigger | "CRM V2 unavailable" — no stack or raw message | NOT RUN | | |
| 21 | No client or financial requests in network panel | Pilot adviser — all CRM V2 routes | No `/api/advisor/clients`, financial, or appointment data APIs | NOT RUN | | |
| 22 | No source mutation occurs | Repeat navigation across CRM V2 routes | No POST/PATCH/DELETE to business endpoints | NOT RUN | | |
| 23 | Shell-status response contains no pilot identity or allowlist | `GET /api/advisor-v2/shell` allowed and denied | Body is only `{ available, requestId }` | NOT RUN | | |
| 24 | No real pilot ID is committed | Review repo and `.env` files in version control | No production adviser UUID in git history for this branch | NOT RUN | | |
| 25 | Phase 9F.4 observation remains unchanged | Visit `/advisor/promotions` as adviser | Redirects to insights — no regression | NOT RUN | | |

### Result codes

Use exactly one of: **PASS**, **FAIL**, **NOT RUN**, **NOT APPLICABLE**

Automated QA (`npm run qa:crm-v2-shell`) covers static implementation checks. Rows above marked **NOT RUN** require operator execution in a configured staging environment.

---

## Shell API probe

```http
GET /api/advisor-v2/shell
```

| Condition | HTTP status | Body |
|-----------|-------------|------|
| Unauthenticated | 401 | `{ "available": false, "requestId": "crm2_..." }` |
| Denied (role, flags, pilot) | 403 | `{ "available": false, "requestId": "crm2_..." }` |
| Allowed | 200 | `{ "available": true, "requestId": "crm2_..." }` |

Headers: `X-Request-Id` matches body; `Cache-Control: no-store`.

---

## Sign-off

| Field | Value |
|-------|-------|
| Operator name | |
| Date | |
| Environment tested | |
| Migration applied during test? | Yes / No |
| Overall manual verdict | |
