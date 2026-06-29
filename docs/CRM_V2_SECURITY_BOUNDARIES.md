# CRM V2 — Security Boundaries

**Phase:** 00  
**Extends:** Phase 10.2 security, Phase 9A access architecture, existing RLS

---

## 1. Trust model

```text
Browser → Next.js middleware/auth → requireAdvisorAccess()
       → assertCrmV2Access() [Phase 01+]
       → resolveAccessibleClient()
       → Service/API layer DTO mapping
       → Supabase RLS (is_assigned_advisor)
```

**Fail-closed:** Missing flag, failed pilot check, or failed assignment → deny without data leak.

---

## 2. Authentication and authorization

| Boundary | Rule |
|----------|------|
| Adviser V2 routes | `role = advisor` only |
| Client users | Denied all `/advisor-v2/**` |
| Admin | No impersonation; ops read panels Phase 12 only |
| Arbitrary adviser ID in URL | Rejected — session adviser derived from auth only |
| `relationshipId` / `clientId` | Must pass `resolveAccessibleClient` |
| Forged UUID | 404 or 403 — no existence oracle |

**Canonical helper:** `lib/supabase/advisorClientAccess.ts` → `resolveAccessibleClient`

---

## 3. Assignment scope

| Data | Scope |
|------|-------|
| Relationship list | `clients.advisor_user_id = auth.uid()` |
| Appointments | `adviser_appointments.adviser_user_id = auth.uid()` |
| Service commitments | `service_commitments.adviser_user_id = auth.uid()` |
| Work queue | Batch loader filters assigned clients (Phase 10.2) |
| Cross-adviser | **Empty result or forbidden** — never partial leak |

Admin book-wide CRM deferred to Phase 12 ops — returns empty or explicit `admin_scope_deferred`.

---

## 4. IDOR prevention

| Endpoint pattern | Control |
|------------------|---------|
| `/relationships/[id]` | Assignment check on `id` |
| `/appointments/[id]` | Appointment.adviser_user_id + client assignment |
| `/service/commitments/[id]` | Commitment.adviser_user_id |
| Client appointment APIs | `owns_client(client_id)` |
| Document signed URLs | Existing vault access checks |
| Protection policy | Assignment + verification role |

**Reschedule identity:** Same appointment ID — prevents duplicate orphan records that could confuse access checks.

---

## 5. DTO minimization

### List views (relationships, appointments calendar, queue, Today)

**Include:** display name, relative dates, status badges, counts, safe labels  
**Exclude:** email, phone, NRIC, amounts, policy numbers, ethnicity, advocacy score, discover JSONB, note bodies, document filenames

### Detail views

Field-level visibility per [CRM_V2_VISIBILITY_MODEL.md](./CRM_V2_VISIBILITY_MODEL.md).

### Work queue metadata

`SafeWorkItemMetadata` allowlist only (Phase 10.2 pattern extended).

---

## 6. State transition integrity

| Domain | Control |
|--------|---------|
| Appointments | Deterministic transition matrix; invalid → 422 |
| Appointments audit | `appointment_state_events` append-only |
| Service commitments | Valid lifecycle per type |
| Protection versions | Confirmed only after adviser action |
| Advocacy events | Append-only |
| Governed content | Existing approval workflow preserved |

---

## 7. Google Calendar privacy

**Google event may contain:**

- Client display name (when operator approves for pilot)
- Meeting type label
- Start/end time
- Location / Meet URL
- Generic AEGIS link

**Google event must not contain:**

- Ethnicity
- Advocacy data
- Protection details
- Private notes
- Financial information
- Document names
- Policy information
- Batch client lists with names

**Aggregate moment reminders:** Count only — e.g. "27 suggested relationships".

---

## 8. Ethnicity and advocacy boundaries

| Use | Permitted | Prohibited |
|-----|-----------|------------|
| Ethnicity | Festive holiday **suggestions** with adviser override | Advice, priority, scoring, targeting, calendar text |
| Advocacy score | Thank-you reminders, relationship context | Work queue sort, appointment priority, leaderboards |
| Advocacy events | Immutable audit of relationship gestures | Client-visible by default |

Enforced in: priority rules (Phase 11), API DTOs, UI components, queue adapters.

---

## 9. Protection extraction security

| Rule | Enforcement |
|------|-------------|
| Unverified never client-visible | API filter `verification_state = confirmed` |
| Extraction payload adviser-only | Separate DTO |
| Source document access | Vault RLS |
| Correction audit | `audit_logs` + version history |
| Policy ID masking | Display layer |

---

## 10. Communications security

| Rule | Enforcement |
|------|-------------|
| Consent check before send | `communication_preferences` |
| Channel preference | Per-client settings |
| Birthday/festive auto-send | **Blocked** — adviser review required |
| Batch selection bounded | Max N clients per batch (operator config) |
| Governed content path | CRM drafts cannot bypass approval for regulated content |

---

## 11. Service-role usage

| Pattern | Rule |
|---------|--------|
| `createAdminSupabaseClient` | Server-only; assignment check before caller returns data |
| Batch loaders | Filter by assigned client IDs server-side |
| Feature controls | Service role for DB read; admin auth for PATCH |

Per `SERVICE_ROLE_USAGE_REVIEW.md` — no new unguarded service-role routes.

---

## 12. Logging and audit

| Event | Logged | Not logged |
|-------|--------|------------|
| CRM V2 access denied | request_id, user_id | client name |
| Appointment transition | state, actor, appointment_id | note content |
| Legacy fallback access | user_id, timestamp | — |
| Adapter failure | warning code | source content |
| 9F.4 retirement | aggregate counts | promotion body |

New audit event types (Phase 03+): `crm_appointment_transition`, `crm_commitment_completed`, `crm_protection_confirmed`, `crm_v2_legacy_access`.

---

## 13. Feature flag security

| Risk | Mitigation |
|------|------------|
| Client enables V2 | `client_visible = false` on all CRM flags |
| Non-pilot adviser | Pilot allowlist check |
| Direct URL when disabled | Safe disabled page — no API data |
| Flag cache stale | 30s TTL + clear on admin PATCH |

---

## 14. Phase 9F.4 protection during CRM rollout

| Requirement | Action |
|-------------|--------|
| Continue observation | No Promotions Stage 6 |
| `legacy_promotions_write` | Remains false |
| CRM comms | Use `governed_content` — not `promotions` |
| Retirement telemetry | Do not regress 9F.4 audit events |
| Migration isolation | CRM migrations must not DROP promotions schema |

---

## 15. Threat scenarios and mitigations

| Threat | Mitigation |
|--------|------------|
| Cross-adviser client access | resolveAccessibleClient + RLS |
| Client reads adviser notes | Separate columns; API DTO strip |
| Client books other household | owns_client check |
| Queue exposes wealth | No amounts in AdviserWorkItem type |
| Google calendar data leak | Field allowlist on sync |
| Unverified policy as advice | Verification gate |
| SQL injection | Parameterized queries; Supabase client |
| CSRF | Existing Next.js API auth patterns |

---

## 16. Security QA requirements (per phase)

Each implementation phase produces `CRM_V2_PHASE_XX_SECURITY_REVIEW.md` covering:

- IDOR tests
- Role denial tests
- DTO field audit
- Logging review
- Flag-off behavior

Phase 00 establishes boundaries only — no security test execution yet.
