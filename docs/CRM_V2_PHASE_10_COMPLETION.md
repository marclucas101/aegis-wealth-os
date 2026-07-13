# CRM V2 Phase 10 — Completion Report

**Branch:** `crm-v2-10-communications`  
**Date:** 2026-07-13  
**Scope:** Phase 10 only — governed communications, templates, client messages, work-queue integration  
**Migrations applied:** No  
**Features enabled:** No  

---

## 1. Repository state

- Branch `crm-v2-10-communications` — implementation and documentation delivered.
- Additive: domain layer (`lib/crm-v2/communications/*`), APIs, work-queue adapter, migrations (unapplied), diagnostics, documentation.
- Legacy surfaces unchanged: Phase 9E `governed_content`, `communication_preferences`, `client_notifications`, Promotions 9F.4 observation, legacy adviser portal.

## 2. Existing communications audit

Completed in `docs/CRM_V2_PHASE_10_EXISTING_COMMUNICATIONS_AUDIT.md`.

| Component | Classification |
|-----------|----------------|
| `governed_content` (9E) | Authoritative SOT — retain |
| `communication_preferences` (9E) | Reusable — extended additively |
| `communication_deliveries` (9E) | Admin API only — compatibility projection |
| `client_notifications` (9E) | Reusable — in-app delivery |
| `adviser_insight_authoring` / `admin_content_approval` | Dependencies — unchanged |
| `promotions` (9F.4) | Observation only — rejected for CRM comms |
| `crm_communication_*` (new) | New canonical CRM staging authority |
| Campaign automation | Rejected — not implemented |
| Promotions Stage 6 | Rejected — not present |

## 3. Exact feature keys

| Key | Scope | Default | Persistence |
|-----|-------|---------|-------------|
| `crm_v2_communications` | Adviser workspace `/advisor-v2/communications` + client `/messages` | `enabled=false` | `202606290016` |

`adviser_visible=true`, `client_visible=true`. **No** separate `crm_v2_communication_templates` or `crm_v2_client_messages` keys — single gate per approved feature-control plan.

Adviser gate: `assertCrmV2CommunicationsAccess()` — master + pilot + allowlist + communications flag.  
Client gate: `assertCrmV2ClientMessagesAccess()` — client role + communications flag (`enabled` + `client_visible`).

## 4. Migration files

| File | Purpose |
|------|---------|
| `supabase/migrations/202606290016_phase10_crm_v2_communications_feature_control.sql` | Seed `crm_v2_communications` disabled |
| `supabase/migrations/202606290017_phase10_crm_v2_communications_core.sql` | Threads, records, templates, domain events, preference extensions, RLS |

Diagnostics (preflight / verify / discrepancies) for both under `supabase/diagnostics/`.

## 5. Canonical authorities

| Table | Role |
|-------|------|
| `crm_communication_threads` | Relationship or source-linked thread grouping |
| `crm_communication_records` | Draft, review, sent/logged/received lifecycle |
| `crm_communication_templates` | Versioned governed wording |
| `crm_communication_domain_events` | Immutable domain audit |
| `communication_preferences` (extended) | Client consent and channel preferences |

Phase 9E `governed_content` remains authoritative for published client content; CRM records may reference via `governed_content_id` after manual submit.

## 6. Communication lifecycle

States: `draft`, `pending_review`, `approved`, `sent`, `logged`, `received`, `failed`, `cancelled`, `archived`.

Explicit transitions in `lib/crm-v2/communications/lifecycle.ts`. No automatic send on create. Invalid transitions perform no write. Documented in `docs/CRM_V2_PHASE_10_COMMUNICATIONS_ARCHITECTURE.md`.

## 7. Channel model

Eight allowlisted channels in `lib/crm-v2/communications/channels.ts`. `canAutoSend: false` for all channels in Phase 10. External channels (`email_draft`, `whatsapp_draft`, `sms_draft`) are draft or log only.

## 8. Consent and preferences

Extended `communication_preferences` with `preferred_channel`, `do_not_contact`, `festive_acknowledgement_opt_out`, `client_message_visibility`, `last_confirmed_at`, `version`.

Marketing opt-out via existing `promotional_content=false`. Do-not-contact blocks draft creation. Documented in `docs/CRM_V2_PHASE_10_CHANNEL_AND_CONSENT_MODEL.md`.

## 9. Adviser workspace

- Route: `/advisor-v2/communications`
- Component: `AdviserCommunicationsClient.tsx`
- Views: Drafts, Needs Review, Recent, Templates, Follow-ups, Failed/Action Required
- Actions: create draft, use template, log external communication, follow-up schedule/complete, transitions

## 10. Client messages

- Route: `/messages`
- Component: `ClientMessagesClient.tsx`
- APIs: `GET /api/messages`, `GET /api/messages/[messageId]`, `POST /api/messages/[messageId]/reply`
- Preferences: `GET/PATCH /api/preferences/communications`
- Gated by `assertCrmV2ClientMessagesAccess()`

## 11. Template governance

Versioned templates with category allowlist, compliance status, variable allowlist (`CRM_TEMPLATE_VARIABLE_ALLOWLIST`), safe rendering with HTML escape. No arbitrary code execution. Documented in `docs/CRM_V2_PHASE_10_TEMPLATE_GOVERNANCE.md`.

## 12. Relationship 360 integration

`communicationsProjection.ts` wired into `readModel.ts` — engagement link and follow-up summary. Timeline projects `crm_communication_domain_events` with safe titles only. No advocacy score, ethnicity, or wealth in projection.

## 13. Source integration

Ten allowlisted source types. Source remains authoritative; communication does not mutate source lifecycle. No automatic outreach from source events. Documented in `docs/CRM_V2_PHASE_10_SOURCE_INTEGRATION.md`.

## 14. Work-queue restrictions

`communicationRecordAdapter` registered — action-based only (`pending_review`, `failed`, follow-up pending/overdue). `priority: normal` only. No advocacy score, ethnicity, wealth, or sales signals. Documented in `docs/CRM_V2_PHASE_10_WORK_QUEUE_INTEGRATION.md`.

## 15. Notifications

In-app only via `dbCreateClientNotification`. Types: `crm_client_message`, `crm_client_reply_received`, `crm_communication_follow_up_due`, `communication_preference_updated`. Notification failure does not corrupt authoritative transitions.

## 16. APIs

| Route | Methods |
|-------|---------|
| `/api/advisor-v2/communications` | GET, POST |
| `/api/advisor-v2/communications/[communicationId]` | PATCH |
| `/api/advisor-v2/communications/[communicationId]/transition` | POST |
| `/api/advisor-v2/communications/[communicationId]/follow-up` | POST |
| `/api/advisor-v2/communications/templates` | GET |
| `/api/advisor-v2/communications/preferences/[relationshipId]` | GET |
| `/api/messages` | GET |
| `/api/messages/[messageId]` | GET |
| `/api/messages/[messageId]/reply` | POST |
| `/api/preferences/communications` | GET, PATCH |

All routes: authenticate, assignment/ownership, feature gates, `private, no-store`, safe DTOs. Contract in `docs/CRM_V2_PHASE_10_API_CONTRACT.md`.

## 17. DTO and visibility controls

Separate adviser and client DTOs in `types.ts`. Client DTOs exclude drafts, pending review, template internals, provider errors, work-queue priority, advocacy score. Adviser DTOs label draft/review/approved/client-visible/preference-conflict states.

## 18. Event and audit history

`crm_communication_domain_events` — immutable append-only. Bounded `safe_metadata`. No provider secrets or unbounded bodies in event summaries. Application audit via `writeAuditLog` on draft creation.

## 19. Concurrency and idempotency

`expectedVersion` optimistic checks return 409 on conflict. `idempotency_key` unique index on `(client_id, idempotency_key)` where active. Idempotent draft creation and preference updates.

## 20. Security and IDOR

Assignment-scoped RLS via `is_assigned_advisor(client_id)`. Client RLS policy on client-visible records only. Server-derived identity; no browser-supplied adviser ID. Review in `docs/CRM_V2_PHASE_10_SECURITY_REVIEW.md`.

## 21. Privacy and data minimization

No automated outreach. No campaign automation. No ethnicity or advocacy-score-based communication priority. No product recommendation templates. No client financial data in generic communication cards. Documented in `docs/CRM_V2_PHASE_10_VISIBILITY_AND_PRIVACY.md`.

## 22. Performance

Bounded lists (`CRM_V2_COMMUNICATIONS_MAX_ITEMS = 50`). Single batch load for work queue. No per-card API requests. `private, no-store` on all routes. Indexes on adviser status, client visible, follow-up, thread, idempotency.

## 23. Files changed

**New:** 12 documentation files, 2 migrations, 6 diagnostics, 10 lib modules, 10 API routes, 2 pages, 2 UI components, 1 work-queue adapter, 1 QA script.

**Modified:** `access.ts`, `constants.ts`, `featureFlags.ts`, `types.ts`, `readModel.ts`, `timelineProjection.ts`, work-queue batch/registry/adapters, `package.json`, rollout index, phase10 discovery/work-queue QA scripts.

## 24. Exact QA results

| Suite | Result |
|-------|--------|
| `npm run qa:crm-v2-communications` | **545/545 passed** |
| `npm run qa:crm-v2-blueprint` | **219/219 passed** |
| `npm run qa:crm-v2-shell` | **149/149 passed** |
| `npm run qa:crm-v2-relationship-360` | **405/405 passed** |
| `npm run qa:crm-v2-appointments-adviser` | **passed** |
| `npm run qa:crm-v2-appointments-client` | **463/463 passed** |
| `npm run qa:crm-v2-google-calendar` | **passed** |
| `npm run qa:crm-v2-service` | **passed** |
| `npm run qa:crm-v2-protection` | **passed** |
| `npm run qa:crm-v2-relationship-moments` | **479/479 passed** |
| `npm run qa:crm-v2-advocacy` | **495/495 passed** |
| `npm run qa:phase10-discovery` | **118/118 passed** |
| `npm run qa:phase10-work-queue-core` | **135/135 passed** |
| `npm run qa:phase9f4-app-retirement` | **115/115 passed** |
| `npm run qa:phase9f3-binder-client-vault` | **198/198 passed** |
| `npm run qa:phase9e-communications` | **87/87 passed** |
| `npm run qa:migration-readiness` | **101/101 passed** |
| `npm run qa:diagnostic-sql-syntax` | **87/87 passed** |
| `npm run security:api` | **passed** (pre-existing legacy route warnings only) |
| `npm run security:advisor-access` | **11/11 passed** |
| `npm run security:service-role` | **7/7 passed** |
| `npm run final:check` | **passed** |
| `npx tsc --noEmit` | **passed** |
| `npm run lint` | **0 errors, 17 pre-existing warnings** |
| `npm run build` | **passed** |

## 25. Dry-run result

```
npx supabase db push --dry-run
Would push these migrations:
 • 202606290016_phase10_crm_v2_communications_feature_control.sql
 • 202606290017_phase10_crm_v2_communications_core.sql
```

Only Phase 10 migrations pending. Migrations **not applied**.

## 26. Manual tests remaining

47 manual acceptance tests documented in `docs/CRM_V2_PHASE_10_MANUAL_TESTS.md`. **Not executed at runtime** — require operator staging with flags enabled and pilot users configured.

## 27. Operator decisions required

1. Approve migration apply for `202606290016` + `202606290017` on staging.
2. Enable `crm_v2_communications` on staging after migrations applied (with master + pilot gates).
3. Execute manual acceptance checklist (47 items).
4. Approve template compliance review for seeded templates before production use.
5. Confirm Phase 9E `governed_content` bridge workflow for drafts promoted to publication.

## 28. Confirmation

- No Promotions Stage 6
- No campaign automation
- No automated outreach
- No external send automation
- No ranking or priority schema
- No sales-opportunity schema
- No advice or recommendation schema
- No feature activation in code or persistence
- No deployment occurred
- No destructive migration occurred

## 29. Verdict

**READY TO APPLY CRM V2 COMMUNICATIONS**

Phase 10 implementation is complete. Migrations are additive, unapplied, and dry-run confirms only Phase 10 pending. All automated QA suites pass. Operator may apply migrations and execute manual acceptance on staging before enabling `crm_v2_communications`.

---

*Stop after Phase 10.*
