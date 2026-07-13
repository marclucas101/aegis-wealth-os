# CRM V2 Phase 08 — Completion Report

**Branch:** `crm-v2-08-relationship-moments`  
**Date:** 2026-07-13  
**Scope:** Phase 08 only — relationship moments, review rhythm, client preferences  
**Migrations applied:** No  
**Features enabled:** No  

---

## 1. Repository state

- Branch `crm-v2-08-relationship-moments` — implementation and documentation delivered.
- Additive: domain layer (`lib/crm-v2/moments/*`), APIs, UI, work-queue adapters, migrations (unapplied), diagnostics, documentation, QA script.
- Legacy surfaces unchanged: `advisor_tasks` birthday reminders, review pipeline, `annual_reviews`, protection portfolio, Google Calendar, Phase 9F.4 observation.

## 2. Existing relationship moments audit

Completed in `docs/CRM_V2_PHASE_08_EXISTING_RELATIONSHIP_MOMENTS_AUDIT.md`.

| Component | Classification |
|-----------|----------------|
| `clients.date_of_birth` | Authoritative — reused |
| `advisor_tasks.client_birthday` | Authoritative — coexist, not migrated |
| `clients.last_review_at` / `next_review_due` | Authoritative — seeds review rhythm |
| `annual_reviews` | Authoritative outputs — not duplicated |
| `clients.ethnicity` | New optional column — festive only |
| `relationship_moments` | **SOT NEW** for structured moments |
| Tags/notes | Deferred — placeholders only |

## 3. Exact feature keys

| Key | Scope | Default | Persistence |
|-----|-------|---------|-------------|
| `crm_v2_relationship_moments` | Adviser moments workspace | `enabled=false` | `202606290012` |
| `crm_v2_client_profile` | Client `/preferences` (`client_visible=true`) | `enabled=false` | `202606290012` |

Adviser gate: `assertCrmV2RelationshipMomentsAccess()` — master + pilot + allowlist + moments flag.  
Client gate: `assertCrmV2ClientProfileAccess()` — client role + profile flag (no master gate).

## 4. Migration files

| File | Purpose |
|------|---------|
| `supabase/migrations/202606290012_phase08_crm_v2_relationship_moments_feature_control.sql` | Seed both Phase 08 flags disabled |
| `supabase/migrations/202606290013_phase08_crm_v2_relationship_moments_core.sql` | Core schema, RLS, festive seeds, service category extension |

Diagnostics (preflight / verify / discrepancies) for both under `supabase/diagnostics/`.

## 5. Canonical authorities

| Table | Role |
|-------|------|
| `relationship_moments` | Structured moment lifecycle |
| `adviser_moment_overrides` | Festive include/exclude |
| `festive_holiday_mappings` | Read-only holiday reference |
| `crm_review_rhythm` | Review cadence projection |
| `crm_client_preference_updates` | Pending client preference changes |
| `relationship_moment_events` | Immutable domain audit |

## 6. Birthday and DOB integration

- `clients.date_of_birth` remains SOT for birthday facts.
- Workspace surfaces DOB in client preferences panel and data quality warnings.
- Optional `relationship_moments` rows with `moment_type = birthday` — adviser-created/confirmed.
- Legacy `advisor_tasks` `client_birthday` tasks coexist without migration.

## 7. Review rhythm architecture

- `crm_review_rhythm` extends `clients.next_review_due` — does not replace or duplicate `annual_reviews`.
- Lazy create on first PATCH seeds from client record columns.
- Documented in `docs/CRM_V2_PHASE_08_REVIEW_RHYTHM.md`.

## 8. Festive and ethnicity

- `clients.ethnicity` optional CHECK-constrained enum.
- Festive suggestions via `festive_holiday_mappings` + `festiveSuggestions.ts`.
- Hard restrictions in `lib/crm-v2/moments/sensitivity.ts`.
- Documented in `docs/CRM_V2_PHASE_08_SENSITIVITY_AND_ETHNICITY_RULES.md`.

## 9. Adviser moments workspace

- Route: `/advisor-v2/relationships/[relationshipId]/moments`
- Component: `RelationshipMomentsClient.tsx`
- Views: upcoming, important dates, review rhythm, client preferences, festive suggestions, past acknowledgements, data quality.
- API: `GET/POST .../moments`, `PATCH/acknowledge/deactivate .../moments/[momentId]`.

## 10. Client preferences

- Route: `/preferences`
- Component: `ClientPreferencesClient.tsx`
- API: `GET/PATCH /api/preferences`, `POST /api/preferences/review-request`
- Gated by `crm_v2_client_profile` only.
- Documented in `docs/CRM_V2_PHASE_08_CLIENT_PREFERENCES.md`.

## 11. Service and appointment integration

- `client_service_requests` categories: `preference_update`, `review_request`.
- FK links: `linked_appointment_id`, `linked_commitment_id` on moments and rhythm.
- Documented in `docs/CRM_V2_PHASE_08_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md`.

## 12. Work queue adapters

Read-only adapters registered:

- `relationshipMomentAdapter`
- `crmReviewRhythmAdapter`
- `clientPreferenceUpdateAdapter`

## 13. Relationship 360 and timeline

- `momentsProjection.ts` — engagement link with summary.
- `timelineProjection.ts` — `relationship_moment_events` entries, no ethnicity.
- `readModel.ts` — profile section wired to moments link.

## 14. Notifications

- In-app only via `lib/crm-v2/moments/notifications.ts`.
- No SMS, WhatsApp, or email send paths.

## 15. APIs

Contract: `docs/CRM_V2_PHASE_08_API_CONTRACT.md`

**Adviser:** moments CRUD lifecycle, review rhythm GET/PATCH.  
**Client:** preferences GET/PATCH, review-request POST.

## 16. DTO and visibility

Distinct adviser vs client DTOs. `sensitivity_class` adviser-only. Documented in `docs/CRM_V2_PHASE_08_VISIBILITY_AND_PRIVACY.md`.

## 17. Event and audit history

- `relationship_moment_events` with bounded `safe_metadata`.
- `writeAuditLog` on moment create.
- No ethnicity or full PII in audit payloads.

## 18. Concurrency and idempotency

- Optimistic `version` on moments and review rhythm.
- Idempotency keys on moment create and preference updates.
- Review request uses Phase 06 service request idempotency.

## 19. Security and IDOR

- Assignment-scoped access + RLS on all tables.
- Fail-closed feature gates.
- Documented in `docs/CRM_V2_PHASE_08_SECURITY_REVIEW.md`.

## 20. Performance

- Bounds: `CRM_V2_MOMENTS_MAX_ITEMS` (50), `CRM_V2_MOMENTS_MAX_EVENTS` (50).
- Workspace list batched — `bounded` flag when truncated.
- `Cache-Control: private, no-store` on all APIs.

## 21. Files delivered (summary)

| Area | Paths |
|------|-------|
| Domain | `lib/crm-v2/moments/*` |
| Access / flags | `lib/crm-v2/access.ts`, `constants.ts`, `featureFlags.ts`, `types.ts` |
| Relationships | `momentsProjection.ts`, `readModel.ts`, `timelineProjection.ts` |
| Work queue | `relationshipMomentAdapter.ts`, `crmReviewRhythmAdapter.ts`, `clientPreferenceUpdateAdapter.ts`, registry/batch loaders |
| Service | `requestLifecycle.ts` |
| APIs | `app/api/advisor-v2/relationships/[id]/moments/**`, `review-rhythm`, `app/api/preferences/**` |
| UI | `RelationshipMomentsClient.tsx`, `ClientPreferencesClient.tsx`, page routes |
| Migrations | `202606290012`, `202606290013` + diagnostics |
| QA | `scripts/run-crm-v2-relationship-moments-validation.ts` |
| Docs | 12 Phase 08 docs + rollout/route/migration/feature-control updates |

## 22. Documentation index

| Document | Purpose |
|----------|---------|
| `CRM_V2_PHASE_08_EXISTING_RELATIONSHIP_MOMENTS_AUDIT.md` | Pre-schema audit |
| `CRM_V2_PHASE_08_RELATIONSHIP_MOMENTS_ARCHITECTURE.md` | Authority and flow |
| `CRM_V2_PHASE_08_REVIEW_RHYTHM.md` | Review cadence projection |
| `CRM_V2_PHASE_08_SENSITIVITY_AND_ETHNICITY_RULES.md` | Hard restrictions |
| `CRM_V2_PHASE_08_CLIENT_PREFERENCES.md` | Client portal gate |
| `CRM_V2_PHASE_08_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md` | Integrations |
| `CRM_V2_PHASE_08_API_CONTRACT.md` | API DTOs |
| `CRM_V2_PHASE_08_VISIBILITY_AND_PRIVACY.md` | DTO rules |
| `CRM_V2_PHASE_08_SECURITY_REVIEW.md` | Threat table |
| `CRM_V2_PHASE_08_MIGRATION_RUNBOOK.md` | Apply/verify |
| `CRM_V2_PHASE_08_MANUAL_TESTS.md` | 39 acceptance items |
| `CRM_V2_PHASE_08_COMPLETION.md` | This report |

## 23. Automated QA results

| Command | Result |
|---------|--------|
| `npm run qa:crm-v2-blueprint` | 219/219 passed |
| `npm run qa:crm-v2-shell` | 149/149 passed |
| `npm run qa:crm-v2-relationship-360` | 270/270 passed |
| `npm run qa:crm-v2-appointments-adviser` | 451/451 passed |
| `npm run qa:crm-v2-appointments-client` | 285/285 passed |
| `npm run qa:crm-v2-google-calendar` | 338/338 passed |
| `npm run qa:crm-v2-service` | 405/405 passed |
| `npm run qa:crm-v2-protection` | 463/463 passed |
| `npm run qa:crm-v2-relationship-moments` | **479/479 passed** |
| `npm run qa:phase10-discovery` | 118/118 passed |
| `npm run qa:phase10-work-queue-core` | 135/135 passed |
| `npm run qa:phase9f4-app-retirement` | 115/115 passed |
| `npm run qa:phase9f3-binder-client-vault` | 198/198 passed |
| `npm run qa:phase9e-communications` | 87/87 passed |
| `npm run qa:migration-readiness` | 101/101 passed |
| `npm run qa:diagnostic-sql-syntax` | 75/75 passed |
| `npm run security:api` | Passed (scanner self-tests + route scan) |
| `npm run security:advisor-access` | 11/11 passed |
| `npm run security:service-role` | Passed |
| `npm run final:check` | 7/7 passed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed (warnings only, no errors) |
| `npm run build` | Passed |

## 24. Dry-run result

```text
npx supabase db push --dry-run
```

**Result:** Would push only Phase 08 migrations:

- `202606290012_phase08_crm_v2_relationship_moments_feature_control.sql`
- `202606290013_phase08_crm_v2_relationship_moments_core.sql`

Migrations **not applied**. Features **remain disabled**.

## 25. Manual tests

39 runtime acceptance items in `docs/CRM_V2_PHASE_08_MANUAL_TESTS.md` — **NOT RUN**.

## 26. Operator decisions required

1. Approve Phase 08 migration apply (`202606290012` then `202606290013`)
2. Confirm Phase 06 `client_service_requests` on target database
3. Run dry-run from connected Supabase CLI session
4. Execute 39 manual acceptance tests on staging
5. Enable sequence: master → pilot → `crm_v2_relationship_moments` / `crm_v2_client_profile`

## 27. Verdict

### **READY TO APPLY CRM V2 RELATIONSHIP MOMENTS**

Implementation complete on branch `crm-v2-08-relationship-moments`. All automated acceptance suites passed. Migrations created but **not applied**; features **remain disabled**. Thirty-nine manual runtime acceptance tests remain **NOT RUN** — operator sign-off required after staging apply.

**Confirmation:** No advocacy schema, ranking/scoring schema, sales opportunity schema, automatic outreach, financial advice generation, feature activation, deployment, or destructive migration occurred.

**Next phase gate after operator apply + pilot QA:** `READY FOR CRM V2 ADVOCACY` (Phase 09)
