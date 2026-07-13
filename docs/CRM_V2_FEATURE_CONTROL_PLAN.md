# CRM V2 — Feature Control Plan

**Phase:** 00  
**Mechanism:** `platform_feature_controls` + `FEATURE_DEFAULTS` in `lib/compliance/featureFlags.ts`  
**Rule:** All CRM V2 flags default **disabled** (`default **false**` in seeds and `FEATURE_DEFAULTS`). No remote activation in blueprint phase.

---

## 1. Master gates

| Flag key | Default | client_visible | adviser_visible | Purpose |
|----------|---------|----------------|-----------------|---------|
| `crm_v2_master` | **false** | false | true | Entire `/advisor-v2` portal |
| `crm_v2_pilot_mode` | **false** | false | true | When true, requires pilot allowlist |
| `adviser_work_queue` | **false** | false | true | Phase 10.2 queue — enable with Today (Phase 11) |

**Pilot allowlist:** Server environment `CRM_V2_PILOT_USER_IDS` (comma-separated auth user UUIDs). Parsed by `lib/crm-v2/pilotConfig.ts` — **not invented in code**, not browser-supplied.

`crm_v2_pilot_mode` is a persisted feature control (migration seed + `FEATURE_DEFAULTS`) **and** a code default — both default **disabled**.

Access check order (implemented in `assertCrmV2Access`):

```text
requireAdvisorAccess()           — authenticated adviser role
  → crm_v2_master.enabled
  → crm_v2_pilot_mode.enabled
  → CRM_V2_PILOT_USER_IDS valid non-empty allowlist
  → session auth user id in allowlist
```

Enabling `crm_v2_master` alone does not grant book-wide access.

---

## 2. Sub-feature flags (by phase)

| Flag key | Phase | Default | Purpose |
|----------|-------|---------|---------|
| `crm_v2_relationships` | 02 | false | Relationship list + 360 |
| `crm_v2_appointments_adviser` | 03 | false | Adviser appointment workflow |
| `crm_v2_appointments_client` | 04 | false | Client appointment collaboration |
| `crm_v2_google_calendar` | 05 | false | Enhanced AEGIS→Google sync |
| `crm_v2_service` | 06 | false | Service + commitments |
| `crm_v2_client_service` | 06 | false | Client service views |
| `crm_v2_protection_portfolio` | 07 | false | Structured protection |
| `crm_v2_relationship_moments` | 08 | false | Moments engine |
| `crm_v2_client_profile` | 08 | false | Client ethnicity/profile extensions |
| `crm_v2_advocacy` | 09 | false | Advocacy tracking |
| `crm_v2_communications` | 10 | false | CRM comm drafts bridge |
| `crm_v2_today` | 11 | false | Today homepage |
| `crm_v2_reports` | 12 | false | Adviser reports |
| `crm_v2_operations` | 12 | false | Ops diagnostics panel |
| `crm_v2_cutover` | 14 | false | `/advisor` → V2 redirect |
| `crm_v2_legacy_fallback` | 14 | false | `/advisor-legacy` access |

---

## 3. Existing flags (unchanged — dependencies)

| Flag | CRM interaction |
|------|-----------------|
| `adviser_meeting_studio` | Required for appointment ↔ session link |
| `binder_export` / `binder_client_publication` | Relationship 360 documents |
| `adviser_insight_authoring` / `admin_content_approval` | Communications Phase 10 |
| `legacy_promotions_write` | **Stays false** — 9F.4 observation |
| `client_in_app_notifications` | Service + comm delivery |
| `communication_preferences` | Phase 10 consent checks |

---

## 4. Seed migration strategy

| Phase | Migration action |
|-------|------------------|
| Phase | Migration action |
|-------|------------------|
| 01 | Seed `crm_v2_master`, `crm_v2_pilot_mode` — **implemented** `202606290001_phase01_crm_v2_feature_controls.sql` (not applied) |
| 02 | Seed `crm_v2_relationships` — disabled — **implemented** `202606290002_phase02_crm_v2_relationships_feature_control.sql` (not applied) |
| 03 | Seed `crm_v2_appointments_adviser` — disabled — **implemented** `202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql` (not applied) |
| 04 | Seed `crm_v2_appointments_client` — disabled — **implemented** `202606290005_phase04_crm_v2_appointments_client_feature_control.sql` (not applied) |
| 05 | Seed `crm_v2_google_calendar` — disabled — **implemented** `202606290006_phase05_crm_v2_google_calendar_feature_control.sql` (not applied) |
| 06 | Seed `crm_v2_service`, `crm_v2_client_service` — disabled — **implemented** `202606290008_phase06_crm_v2_service_feature_control.sql` (not applied) |
| 07 | Seed `crm_v2_protection_portfolio` — disabled — **implemented** `202606290010_phase07_crm_v2_protection_feature_control.sql` (not applied) |
| ... | One seed per sub-flag at implementation phase |
| 14 | Seed cutover flags — disabled until operator |

**Phase 00:** No seeds. Flag keys documented only.

---

## 5. Rollout gates

| Gate | Criteria | Owner |
|------|----------|-------|
| G0 Blueprint | Phase 00 QA pass | Engineering |
| G1 Shell | Phase 01 QA + security review | Engineering |
| G2 Foundation control | Operator approves seed apply for master + pilot flags | Operator |
| G3 Relationship pilot | Phase 02 QA on staging with test adviser | Operator |
| G4 Appointment core apply | Phase 03 migration dry-run + operator approval | Operator |
| G5 Client appointment pilot | Phase 04 QA + consent review | Operator |
| G6 Google pilot | Phase 05 OAuth credentials + privacy review | Operator |
| G7 Service core apply | Phase 06 migration approval | Operator |
| G8 Protection apply | Phase 07 verification workflow sign-off | Operator |
| G9 Full pilot | Phase 13 manual acceptance | Operator |
| G10 Cutover | Phase 14 observation plan active | Operator |
| G11 Legacy retirement | Phase 15 dependency audit + 30-day observation complete | Operator |

---

## 6. Enable sequence (recommended)

```text
Staging (all flags off)
  → enable crm_v2_master + crm_v2_pilot_mode on staging
  → add pilot user IDs
  → enable sub-flags per completed phase on staging
  → production pilot (single adviser) Phase 13
  → expand pilot book
  → crm_v2_cutover (Phase 14)
  → disable crm_v2_legacy_fallback after observation
```

**Never** enable globally without operator sign-off documented in phase completion report.

---

## 7. Rollback

| Level | Action |
|-------|--------|
| Sub-feature | Set sub-flag `enabled = false` |
| Full V2 | Set `crm_v2_master = false` |
| Cutover | Set `crm_v2_cutover = false`; `/advisor` serves legacy |
| Migration | Schema retained; flags off stops new writes |

No schema deletion on rollback.

---

## 8. Admin API

Existing: `PATCH /api/admin/feature-controls`  
Phase 12 may add minimal UI; until then operator uses API/SQL per existing platform pattern.

---

## 9. Code integration points

| File | Change phase |
|------|--------------|
| `lib/compliance/types.ts` | Add `PlatformFeatureKey` entries per phase |
| `lib/compliance/featureFlags.ts` | Add `FEATURE_DEFAULTS` entries |
| `lib/crm-v2/access.ts` (new Phase 01) | `assertCrmV2Access()` |
| Route layouts | Check master + pilot gates |

---

## 10. TypeScript union (approved keys — Phase 00)

Add to `PlatformFeatureKey` incrementally; full list reserved:

`crm_v2_master`, `crm_v2_pilot_mode`, `crm_v2_relationships`, `crm_v2_appointments_adviser`, `crm_v2_appointments_client`, `crm_v2_google_calendar`, `crm_v2_service`, `crm_v2_client_service`, `crm_v2_protection_portfolio`, `crm_v2_relationship_moments`, `crm_v2_client_profile`, `crm_v2_advocacy`, `crm_v2_communications`, `crm_v2_today`, `crm_v2_reports`, `crm_v2_operations`, `crm_v2_cutover`, `crm_v2_legacy_fallback`

Plus existing `adviser_work_queue`.
