# CRM V2 Phase 13 — Pilot Smoke Tests

**Branch:** `crm-v2-13-pilot-activation`  
**Environment:** Staging with operator-controlled flag activation

---

## 1. Purpose

Safe smoke tests verify route gating and response shapes without mutating production data or sending external communications.

**Repository script** (`npm run qa:crm-v2-pilot-readiness`) validates documentation, diagnostics, and configuration assumptions **without requiring production feature activation**.

**Runtime smoke tests** below require staging deployment with operator-enabled flags.

---

## 2. Repository readiness (no activation required)

```bash
npm run qa:crm-v2-pilot-readiness
```

Validates:

- Phase 13 documentation exists
- Feature key inventory matches code
- Activation and rollback order documented
- Diagnostics SQL present and read-only
- No feature enable in migrations
- No production secrets in Phase 13 docs
- Manual tests remain not pre-marked passed

---

## 3. Pre-conditions for runtime smoke tests

| Item | Requirement |
|------|-------------|
| Environment | Staging only |
| Flags | Per activation order — one module at a time |
| `CRM_V2_PILOT_USER_IDS` | Single test adviser UUID |
| Test client | Staging synthetic client |
| External sends | Disabled |

---

## 4. Feature-disabled response checks (no flags enabled)

Run with all CRM V2 flags disabled (default).

| # | Request | Role | Expected |
|---|---------|------|----------|
| D1 | `GET /advisor-v2` | non-pilot adviser | Access denied UI |
| D2 | `GET /advisor-v2` | client | Adviser access denied |
| D3 | `GET /api/advisor-v2/shell` | unauthenticated | 401 |
| D4 | `GET /api/advisor-v2/relationships` | adviser | Feature disabled / 403 |
| D5 | `GET /appointments` | client | Feature disabled or legacy behavior |
| D6 | `GET /advisor` | adviser | 200 — legacy works |

**Method:** Browser or `curl` with session cookie. **No writes.**

---

## 5. Master + pilot enabled (shell only)

Enable `crm_v2_master`, `crm_v2_pilot_mode`, set allowlist. No sub-flags.

| # | Request | Role | Expected |
|---|---------|------|----------|
| S1 | `GET /advisor-v2` | pilot adviser | Shell renders |
| S2 | `GET /advisor-v2` | non-pilot adviser | Denied |
| S3 | `GET /api/advisor-v2/shell` | pilot adviser | 200 JSON shell DTO |
| S4 | `GET /advisor-v2/relationships` | pilot adviser | Feature disabled for module |
| S5 | Navigation | pilot adviser | Primary nav visible; gated modules safe |

---

## 6. Module-enabled checks (per flag)

After enabling each sub-flag, run **GET only** checks:

| Module | Flag | GET route | Expected shape |
|--------|------|-----------|----------------|
| Relationships | `crm_v2_relationships` | `/api/advisor-v2/relationships` | JSON list; assignment-scoped |
| Appointments | `crm_v2_appointments_adviser` | `/api/advisor-v2/appointments` | JSON list |
| Service | `crm_v2_service` | `/api/advisor-v2/service` | Projection DTO |
| Protection | `crm_v2_protection_portfolio` | relationship protection API | No raw policy numbers in list |
| Moments | `crm_v2_relationship_moments` | moments API | Bounded items |
| Advocacy | `crm_v2_advocacy` | advocacy API | No ranking scores in client DTO |
| Communications | `crm_v2_communications` | communications API | Drafts only; no send |
| Today | `crm_v2_today` | `/api/advisor-v2/today` | Projection cards |
| Reports | `crm_v2_reports` | `/api/advisor-v2/reports` | `private, no-store` |
| Operations | `crm_v2_operations` | `/api/advisor-v2/operations` | Feature control panel safe fields |

**Client GET checks** (when `client_visible=true`):

| Module | Route | Expected |
|--------|-------|----------|
| Appointments client | `/appointments` | Own appointments only |
| Client service | `/actions` | Own actions only |
| Protection | `/protection` | Confirmed summary only |
| Preferences | `/preferences` | Own preferences only |

---

## 7. API response-shape checks

| Check | Validation |
|-------|------------|
| No `accessToken` in JSON | Grep response body |
| No `serviceRole` in JSON | Grep response body |
| No allowlist contents in error | Generic denial message |
| `Cache-Control: private, no-store` | CRM V2 APIs |
| `X-Request-Id` present | CRM V2 APIs |

---

## 8. Prohibited smoke test actions

| Action | Reason |
|--------|--------|
| Create real client data in production | Data safety |
| Send email/SMS/WhatsApp | External send prohibition |
| Call Google APIs without staging OAuth | OAuth safety |
| POST appointment transitions on production | Write prohibition |
| Enable all flags at once | Activation order violation |
| Use production adviser UUID in repo | Secret/PII |

---

## 9. Rollback smoke test

After enabling one module:

1. Disable that module flag
2. Confirm GET returns feature-disabled
3. Confirm legacy `/advisor` still works
4. Run `verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql`

---

## 10. Evidence capture

| Field | Store in |
|-------|----------|
| Screenshot | Master manual acceptance evidence link |
| Response headers | Operator log |
| Diagnostic SQL output | Operator log |
| Flag state before/after | Master manual acceptance notes |

---

## 11. Optional curl examples (staging)

Replace `$STAGING` and session cookie. **GET only.**

```bash
# Feature disabled (default)
curl -s -o /dev/null -w "%{http_code}" "$STAGING/api/advisor-v2/relationships"

# With pilot session (after activation)
curl -s -H "Cookie: $SESSION" "$STAGING/api/advisor-v2/shell" | head -c 500
```

Do not include credentials in committed scripts.
