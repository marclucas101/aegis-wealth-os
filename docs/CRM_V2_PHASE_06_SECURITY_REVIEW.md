# CRM V2 Phase 06 — Security Review

**Scope:** Service commitments, client service requests, adviser workspace, client Actions/Requests APIs.

---

## 1. Threat table

| Threat | Control | Residual risk |
|--------|---------|---------------|
| IDOR — cross-adviser access | `resolveAccessibleClient`, `is_assigned_advisor` RLS, service-layer book filter | Low — requires assignment bypass to exploit |
| IDOR — cross-client access | Session-derived `client.id`; queries scoped by `client_id` | Low |
| Forged UUID enumeration | 404 `not_found` uniform response | Low |
| Browser-supplied adviser ID | Rejected — derived from session | None |
| Browser-supplied client ID | Rejected on client routes | None |
| Feature flag bypass | `assertCrmV2ServiceAccess` / `assertCrmV2ClientServiceAccess` fail closed | Low |
| Client flag → adviser CRM | Client gate does not call adviser gate | None |
| Privilege escalation via transition | Lifecycle modules validate actor role + owner | Low |
| Client completes adviser work | `canClientCompleteCommitment` + `owner_forbidden` | None |
| Adviser rewrites client request | Original columns immutable; responses in events | Low |
| Stale concurrent update | Optimistic `version` → 409 | Low |
| Invalid transition write | Validate before UPDATE | None |
| Queue adapter mutation | Read-only `load()` | None |
| Internal note leak to client | DTO exclusion + query filter | Low — verify UI uses client APIs only |
| Document path leak | No paths in DTOs | Low |
| Meeting note leak | No copy from meeting to client description | Low — adviser discipline |
| Rate limit abuse | `writeHeavy` bucket on writes | Medium — platform-wide limits |
| Notification side-channel | Bounded metadata only | Low |
| Admin overreach | `is_admin()` in RLS; APIs use adviser assignment check | Low — admin ops audited separately |

---

## 2. Feature gates

| Surface | Required flags |
|---------|----------------|
| `/advisor-v2/service` | `crm_v2_master`, `crm_v2_pilot_mode`, pilot allowlist, `crm_v2_service` |
| `/api/advisor-v2/service/**` | Same |
| `/actions`, `/requests` | `crm_v2_client_service` (enabled + client_visible) |
| `/api/actions`, `/api/requests/**` | Same |

Master enabled without pilot does **not** grant access.

---

## 3. Assignment model

- `clients.advisor_user_id` set on commitment/request create from relationship row
- Adviser APIs filter by `adviser_user_id` for advisor role
- Admin role may see broader book per existing platform pattern
- No household-ID as access proof

---

## 4. RLS summary

Tables: `service_commitments`, `client_service_requests`, `service_commitment_events`, `client_service_request_events`

Policy pattern: `is_assigned_advisor(client_id) OR is_admin()` for ALL operations.

Client portal uses service-role API layer with explicit `client_id` match — not direct authenticated client RLS on service tables.

---

## 5. Prohibited (confirmed absent)

- Generic `advisor_work_items` authority table
- Automatic duplicate of tasks/roadmap/checklist
- Protection, moments, advocacy schema in Phase 06 migrations
- Remote feature activation in migrations (seeds default disabled)
- Email/SMS/WhatsApp notification channels
- Financial prioritisation in queue adapters

---

## 6. Test fixtures

Security tests use mocks/fixtures — not production data. See `docs/CRM_V2_PHASE_06_MANUAL_TESTS.md` and `npm run security:advisor-access`.

---

## 7. Residual operator actions

- Enable `crm_v2_service` / `crm_v2_client_service` only after Gate G7 approval
- Apply migrations `202606290008`, `202606290009` per runbook
- Pilot single adviser before book-wide enable
