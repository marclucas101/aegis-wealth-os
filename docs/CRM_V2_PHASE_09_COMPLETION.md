# CRM V2 Phase 09 — Completion Report

**Branch:** `crm-v2-09-advocacy`  
**Date:** 2026-07-13  
**Scope:** Phase 09 only — advocacy events, consent preferences, yearly score, work-queue integration  
**Migrations applied:** No  
**Features enabled:** No  

---

## 1. Repository state

- Branch `crm-v2-09-advocacy` — implementation and documentation delivered.
- Additive: domain layer (`lib/crm-v2/advocacy/*`), APIs, work-queue adapter, migrations (unapplied), diagnostics, documentation.
- Legacy surfaces unchanged: `adviser_feedback`, `promotions` (9F.4 observation), `advisor_tasks`, service requests, relationship moments.

## 2. Existing advocacy audit

Completed in `docs/CRM_V2_PHASE_09_EXISTING_ADVOCACY_AUDIT.md`.

| Component | Classification |
|-----------|----------------|
| `adviser_feedback` | Authoritative — reuse |
| Referrals/introductions (informal) | New — `advocacy_events` |
| `promotions` | Observation only (9F.4) — rejected for advocacy |
| `advisor_tasks` | Authoritative — coexist |
| Tags/notes | Deferred |
| Timeline | Projection |
| `client_service_requests` | Authoritative — FK link |
| `relationship_moments` | Authoritative — FK link |
| Yearly score | New projection |

## 3. Exact feature key

| Key | Scope | Default | Persistence |
|-----|-------|---------|-------------|
| `crm_v2_advocacy` | Adviser workspace + client `/preferences/advocacy` | `enabled=false` | `202606290014` |

`adviser_visible=true`, `client_visible=true`. **No** separate `crm_v2_client_advocacy` key.

Adviser gate: `assertCrmV2AdvocacyAccess()` — master + pilot + allowlist + advocacy flag.  
Client gate: `assertCrmV2ClientAdvocacyAccess()` — client role + advocacy flag (`enabled` + `client_visible`).

## 4. Migration files

| File | Purpose |
|------|---------|
| `supabase/migrations/202606290014_phase09_crm_v2_advocacy_feature_control.sql` | Seed `crm_v2_advocacy` disabled |
| `supabase/migrations/202606290015_phase09_crm_v2_advocacy_core.sql` | Core schema, score config, RLS |

Diagnostics (preflight / verify / discrepancies) for both under `supabase/diagnostics/`.

## 5. Canonical authorities

| Table | Role |
|-------|------|
| `advocacy_events` | Advocacy event lifecycle |
| `crm_client_advocacy_preferences` | Client consent aggregate |
| `advocacy_score_config` | Operator score weights/caps |
| `advocacy_domain_events` | Immutable domain audit |

## 6. Event types and consent

Fifteen allowlisted event types. Consent states: seven values. Explicit consent for testimonial and mention events. Documented in `docs/CRM_V2_PHASE_09_CONSENT_AND_PRIVACY.md`.

## 7. Score architecture

Event-based calendar-year score with category and global caps. Computed in `score.ts` — not persisted. Restricted uses in `restrictions.ts`. Documented in `docs/CRM_V2_PHASE_09_ADVOCACY_SCORE_RESTRICTIONS.md`.

## 8. Promotions and 9F.4

- Phase 9F.4 observation continues
- No Promotions Stage 6 in Phase 09
- No campaign automation
- No sales ranking or leaderboards

## 9. Adviser advocacy workspace

- Route: `/advisor-v2/relationships/[relationshipId]/advocacy`
- Component: `RelationshipAdvocacyClient.tsx`
- Views: history, introductions, referrals, testimonials, follow-up, consent, summary
- API: `GET/POST .../advocacy`, summary, PATCH, transition
- Views: history, introductions, referrals, testimonials, follow_up, consent, summary

## 10. Client advocacy preferences

- Route: `/preferences/advocacy`
- API: `GET/PATCH /api/preferences/advocacy`, `POST .../withdraw`
- Gated by `crm_v2_advocacy` only
- Documented in `docs/CRM_V2_PHASE_09_CLIENT_ADVOCACY_PREFERENCES.md`

## 11. Service and appointment integration

- FK links on advocacy events
- Documented in `docs/CRM_V2_PHASE_09_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md`

## 12. Work queue adapter

- `advocacyEventAdapter` registered
- `priority: normal` always — no score priority
- Read-only projection

## 13. Relationship 360 and timeline

- `advocacyProjection.ts` — engagement link with summary
- Timeline safe domain events — future projection hook

## 14. Notifications

- In-app only via `lib/crm-v2/advocacy/notifications.ts`
- No SMS, WhatsApp, or email send paths

## 15. APIs

Contract: `docs/CRM_V2_PHASE_09_API_CONTRACT.md`

**Adviser:** workspace GET/POST, summary, PATCH event, transition POST.  
**Client:** preferences GET/PATCH, withdraw POST.

## 16. DTO and visibility

Distinct adviser vs client DTOs. Score adviser-only. Documented in `docs/CRM_V2_PHASE_09_VISIBILITY_AND_PRIVACY.md`.

## 17. Event and audit history

- `advocacy_domain_events` with bounded `safe_metadata`
- `writeAuditLog` on event create and preference update

## 18. Concurrency and idempotency

- Optimistic `version` on events and preferences
- Idempotency keys on event create
- Stale version → 409

## 19. Security and IDOR

- Assignment-scoped access + RLS on all tables
- Fail-closed feature gates
- Documented in `docs/CRM_V2_PHASE_09_SECURITY_REVIEW.md`

## 20. Performance

- Bounds: `CRM_V2_ADVOCACY_MAX_ITEMS` (50)
- Workspace list batched — `bounded` flag when truncated
- `Cache-Control: private, no-store` on all APIs

## 21. Files delivered (summary)

| Area | Paths |
|------|-------|
| Domain | `lib/crm-v2/advocacy/*` |
| Access / flags | `lib/crm-v2/access.ts`, `constants.ts`, `featureFlags.ts` |
| Relationships | `advocacyProjection.ts` |
| Work queue | `advocacyEventAdapter.ts`, `loadWorkQueueBatchData.ts`, `batchData.ts`, `sourceRegistry.ts` |
| APIs | `app/api/advisor-v2/relationships/[id]/advocacy/**`, `app/api/preferences/advocacy/**` |
| Migrations | `202606290014`, `202606290015` + diagnostics |
| Docs | 12 Phase 09 docs + rollout/route/migration/matrix updates |

## 22. Documentation index

| Document | Purpose |
|----------|---------|
| `CRM_V2_PHASE_09_EXISTING_ADVOCACY_AUDIT.md` | Pre-schema audit |
| `CRM_V2_PHASE_09_ADVOCACY_ARCHITECTURE.md` | Authority and flow |
| `CRM_V2_PHASE_09_CONSENT_AND_PRIVACY.md` | Consent states and withdrawal |
| `CRM_V2_PHASE_09_ADVOCACY_SCORE_RESTRICTIONS.md` | Allowed/prohibited score uses |
| `CRM_V2_PHASE_09_CLIENT_ADVOCACY_PREFERENCES.md` | Client portal gate |
| `CRM_V2_PHASE_09_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md` | Integrations |
| `CRM_V2_PHASE_09_API_CONTRACT.md` | API DTOs |
| `CRM_V2_PHASE_09_VISIBILITY_AND_PRIVACY.md` | DTO rules |
| `CRM_V2_PHASE_09_SECURITY_REVIEW.md` | Threat table |
| `CRM_V2_PHASE_09_MIGRATION_RUNBOOK.md` | Apply/verify |
| `CRM_V2_PHASE_09_MANUAL_TESTS.md` | 42 acceptance items |
| `CRM_V2_PHASE_09_COMPLETION.md` | This report |

## 23. Exact QA results

| Command | Result |
|---------|--------|
| `npm run qa:crm-v2-blueprint` | **219/219 passed** |
| `npm run qa:crm-v2-shell` | **149/149 passed** |
| `npm run qa:crm-v2-relationship-360` | **270/270 passed** |
| `npm run qa:crm-v2-appointments-adviser` | **451/451 passed** |
| `npm run qa:crm-v2-appointments-client` | **285/285 passed** |
| `npm run qa:crm-v2-google-calendar` | **338/338 passed** |
| `npm run qa:crm-v2-service` | **405/405 passed** |
| `npm run qa:crm-v2-protection` | **463/463 passed** |
| `npm run qa:crm-v2-relationship-moments` | **479/479 passed** |
| `npm run qa:crm-v2-advocacy` | **493/493 passed** |
| `npm run qa:phase10-discovery` | **118/118 passed** |
| `npm run qa:phase10-work-queue-core` | **135/135 passed** |
| `npm run qa:phase9f4-app-retirement` | **115/115 passed** |
| `npm run qa:phase9f3-binder-client-vault` | **198/198 passed** |
| `npm run qa:phase9e-communications` | **87/87 passed** |
| `npm run qa:migration-readiness` | **101/101 passed** |
| `npm run qa:diagnostic-sql-syntax` | **81/81 passed** |
| `npm run security:api` | **11/11 passed** (pre-existing legacy route warnings only) |
| `npm run security:advisor-access` | **passed** |
| `npm run security:service-role` | **passed** |
| `npm run final:check` | **7/7 passed** |
| `npx tsc --noEmit` | **passed** |
| `npm run lint` | **passed** (0 errors; pre-existing warnings only) |
| `npm run build` | **passed** |

## 24. Dry-run result

```text
npx supabase db push --dry-run
```

**Result:** Would push **Phase 09 migrations only**:

- `202606290014_phase09_crm_v2_advocacy_feature_control.sql`
- `202606290015_phase09_crm_v2_advocacy_core.sql`

Migrations **not applied**. Features **remain disabled**.

## 25. Manual tests

42 runtime acceptance items in `docs/CRM_V2_PHASE_09_MANUAL_TESTS.md` — **NOT RUN**.

## 26. Operator decisions required

1. Approve Phase 09 migration apply (`202606290014` then `202606290015`)
2. Confirm Phase 06 and Phase 08 dependencies on target database
3. Run dry-run from connected Supabase CLI session
4. Execute 42 manual acceptance tests on staging
5. Enable sequence: master → pilot → `crm_v2_advocacy`
6. Confirm Phase 9F.4 Promotions observation still active

## 27. Confirmation

No Promotions Stage 6, no sales-opportunity schema, no ranking/scoring priority schema, no advice/recommendation schema, no automatic outreach, no feature activation, no deployment, and no destructive migration occurred.

## 28. Verdict

### **READY TO APPLY CRM V2 ADVOCACY**

Implementation, documentation, and automated QA complete on branch `crm-v2-09-advocacy`. Migrations created but **not applied**; features **remain disabled**. Forty-two manual runtime acceptance tests remain **NOT RUN** — operator sign-off required after staging apply.

**Next phase gate:** **READY FOR CRM V2 COMMUNICATIONS** (Phase 10) after operator applies Phase 09 migrations and completes manual acceptance on staging.

After operator apply + pilot QA: **READY FOR CRM V2 COMMUNICATIONS** (Phase 10)
