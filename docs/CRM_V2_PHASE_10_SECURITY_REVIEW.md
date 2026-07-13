# CRM V2 Phase 10 — Security Review

**Scope:** `crm_communication_threads`, `crm_communication_records`, `crm_communication_templates`, `crm_communication_domain_events`, extended `communication_preferences`, adviser/client APIs, work-queue `communicationRecordAdapter`.

---

## 1. Threat table

| Threat | Control | Residual risk |
|--------|---------|---------------|
| IDOR — cross-adviser record access | `resolveAccessibleClient` + RLS `is_assigned_advisor(client_id)` | Low |
| IDOR — `communicationId` from other client | Query filters `client_id` after access resolution | Low |
| IDOR — cross-client message read | Client session `client.id` + visibility filters → 404 | Low |
| IDOR — `relationshipId` preference read | Assignment resolution → 404/403 | Low |
| Forged `clientId` in POST body | Server validates via `resolveAccessibleClient` | Low |
| Feature flag bypass | `assertCrmV2CommunicationsAccess` / `assertCrmV2ClientMessagesAccess` fail closed | Low |
| Client accesses adviser workspace | Separate gates; client lacks master/pilot | None |
| Auto external send | `channelAllowsAutoSend()` false; no provider calls | None |
| Do-not-contact bypass | Server rejects create; `mark_sent` blocked | Low |
| Stale concurrent update | `expectedVersion` → 409 | Low |
| Queue adapter mutation | Read-only `load()` — no complete handler | None |
| Unsafe template injection | Variable allowlist + HTML escape | Low |
| XSS in `safe_subject`/`safe_body` | Trim, length cap, template escape | Low |
| SQL injection | Parameterised Supabase client | Low |
| Promotions reactivation | No Phase 10 writes to `promotions` | Low |
| Advocacy score → priority | Adapter `priority: normal` fixed | None |
| Campaign automation | No scheduler/batch tables | None |
| Admin overreach | `is_admin()` in RLS; adviser APIs use assignment | Low |
| Rate limit abuse | Platform middleware on API routes | Medium |

---

## 2. Feature gates (fail-closed)

### Adviser communications

```text
requireAdvisorAccess()
  → crm_v2_master.enabled
  → crm_v2_pilot_mode.enabled
  → CRM_V2_PILOT_USER_IDS non-empty allowlist
  → auth user in allowlist
  → crm_v2_communications.enabled
```

Disabled at any step → 403 — **no workspace data loaded**.

### Client messages

```text
ensureUserClientProfile()
  → role === client
  → crm_v2_communications.enabled AND client_visible
```

Does not grant `/advisor-v2` access. Single key `crm_v2_communications`.

---

## 3. Assignment model

- `created_by_user_id` set from authenticated adviser on create
- `assigned_adviser_user_id` on thread from creating adviser
- All adviser mutations scoped by `client_id` after `resolveAccessibleClient`
- `relationshipId === clients.id` for preference reads
- Work queue filters records by book `clientIds` and adviser `created_by_user_id`

---

## 4. RLS summary

| Table | Policy |
|-------|--------|
| `crm_communication_threads` | `is_assigned_advisor(client_id) OR is_admin()` ALL |
| `crm_communication_records` | Assignment ALL + client SELECT for visible delivered rows |
| `crm_communication_templates` | SELECT advisers/admins |
| `crm_communication_domain_events` | SELECT assignment/admin |
| `communication_preferences` | Phase 9E owner SELECT/UPDATE (client) |

---

## 5. IDOR test list

| # | Test | Expected |
|---|------|----------|
| 1 | Adviser A GET workspace for Adviser B client | 403/404 |
| 2 | Adviser A PATCH record on B client with guessed ID | 404 |
| 3 | Client A GET `/api/messages` | 200 own messages only |
| 4 | Client A GET `/api/messages/{B-messageId}` | 404 |
| 5 | Client A cannot GET adviser communications API | 403 |
| 6 | Unauthenticated GET messages | 401 |
| 7 | Feature disabled GET messages | 403, no data leak |

---

## 6. Promotions Stage 6 — explicit non-scope

Phase 10 security posture **requires**:

| Item | Status |
|------|--------|
| Promotions Stage 6 DROP | **Not in Phase 10 migrations** |
| `legacy_promotions_write` | Remains **false** |
| Phase 9F.4 observation | **Continues** per `PHASE_9F4_OBSERVATION_PLAN.md` |
| Communications → promotions writes | **None** |
| Campaign automation | **None** |
| Sales ranking APIs | **None** |

---

## 7. Consent and outreach abuse prevention

| Vector | Mitigation |
|--------|------------|
| Bulk auto email from transitions | No email provider invocation |
| SMS/WhatsApp automation | Draft/log channels only |
| Do-not-contact ignored | Create blocked; send transition blocked |
| Marketing opt-out ignored | `mark_sent` blocked when `isCampaignStyleBlocked()` |
| Festive auto messages | No cron; opt-out surfaced as warning |
| Ethnicity/wealth targeting | `COMMUNICATION_PROHIBITED_USES` — not implemented |

---

## 8. Template security

- Variables must be in `CRM_TEMPLATE_VARIABLE_ALLOWLIST`
- Unknown `{{token}}` in body causes render failure
- Values escaped before substitution
- Unapproved templates not returned by API

---

## 9. Notification security

- In-app only — no external PII in notification payload beyond truncated subject
- Notification failure does not roll back authoritative DB transition
- Client notifications scoped to owning `client_id`

---

## 10. Concurrency and idempotency

| Mechanism | Behaviour |
|-----------|-----------|
| `expectedVersion` | Optimistic lock on PATCH, transition, follow-up, preferences |
| `idempotency_key` | Unique per `(client_id, idempotency_key)` when active |
| Domain events | Append-only — no UPDATE/DELETE policies for advisers |

---

## 11. Fail-closed verification

| Scenario | Expected |
|----------|----------|
| `crm_v2_communications` disabled | Adviser APIs 403 before DB business load |
| Client flag disabled | `/messages` gate message; API 403 |
| Master disabled | Adviser 403 even if communications flag on |
| Invalid transition | 400 — state unchanged |

**Branch:** `crm-v2-10-communications`
