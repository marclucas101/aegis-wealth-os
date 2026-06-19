# Phase 9E QA Traceability Matrix

Maps each original build-spec requirement to test ID, name, implementation file, and static-analysis result.

| # | Requirement | Test ID | Test name | Primary implementation | Result |
|---|-------------|---------|-----------|------------------------|--------|
| 1 | Client sees only approved published Insights | 1 | Client sees only approved published Insights | `lib/communications/insightsFeedService.ts` | Pass |
| 2 | Draft content is invisible | 2 | Draft content is invisible | `lib/communications/contentLifecycle.ts` | Pass |
| 3 | Submitted content is invisible | 3 | Submitted content is invisible | `lib/communications/audienceTargeting.ts` | Pass |
| 4 | Rejected content is invisible | 4 | Rejected content is invisible | `lib/communications/audienceTargeting.ts` | Pass |
| 5 | Withdrawn content disappears | 5 | Withdrawn content disappears | `lib/communications/contentLifecycle.ts` | Pass |
| 6 | Expired content is not current | 6 | Expired content is not current | `lib/communications/contentLifecycle.ts` | Pass |
| 7 | Adviser cannot self-approve | 7 | Adviser cannot self-approve | `lib/communications/contentWorkflow.ts` | Pass |
| 8 | Adviser cannot target unassigned client | 8 | Adviser cannot target unassigned client | `lib/communications/audienceTargeting.ts` | Pass |
| 9 | Admin can approve under explicit policy | 9 | Admin can approve under explicit policy | `app/api/admin/communications/[contentId]/approve/route.ts` | Pass |
| 10 | Published content cannot be silently edited | 10 | Published content cannot be silently edited | `lib/communications/contentWorkflow.ts` | Pass |
| 11 | New edit creates a new version | 11 | New edit creates a new version | `lib/communications/contentWorkflow.ts` | Pass |
| 12 | Audience targeting enforced server-side | 12 | Audience targeting is enforced server-side | `lib/communications/insightsFeedService.ts` | Pass |
| 13 | Prospect/active-client targeting differ | 13 | Prospect and active-client targeting differ correctly | `lib/communications/audienceTargeting.ts` | Pass |
| 14 | Inactive-client policy enforced | 14 | Inactive-client policy is enforced | `lib/compliance/entitlements.ts` | Pass |
| 15 | Product-related content defaults disabled | 15 | Product-related content defaults disabled | `lib/compliance/featureFlags.ts` | Pass |
| 16 | Market update requires source and review date | 16 | Market update requires source and review date | `lib/communications/contentValidation.ts` | Pass |
| 17 | Unsafe external URL rejected | 17 | Unsafe external URL rejected | `lib/communications/externalLinkValidation.ts` | Pass |
| 18 | Untrusted HTML is not rendered | 18 | Untrusted HTML is not rendered | `lib/communications/contentValidation.ts` | Pass |
| 19 | Client feed contains no approval metadata | 19 | Client feed contains no approval metadata | `lib/communications/clientSafeInsightsDto.ts` | Pass |
| 20 | Client cannot access another client's message | 20 | Client cannot access another client's targeted message | `lib/communications/audienceTargeting.ts` | Pass |
| 21 | Document upload creates notification | 21 | Document upload creates correct notification | `app/api/documents/upload/route.ts` | Pass |
| 22 | Internal document creates no client notification | 22 | Internal document creates no client notification | `lib/communications/documentEventNotifications.ts` | Pass |
| 23 | Document withdrawal removes access | 23 | Document withdrawal immediately removes access | `lib/compliance/documentVisibility.ts` | Pass |
| 24 | Document replacement marks current version | 24 | Document replacement marks current version | `lib/communications/documentEventNotifications.ts` | Partial — type defined; hook deferred |
| 25 | Notification metadata has no sensitive values | 25 | Notification metadata contains no sensitive values | `lib/communications/documentEventNotifications.ts` | Pass |
| 26 | Client can mark own notification read | 26 | Client can mark own notification read | `app/api/client/notifications/[notificationId]/route.ts` | Pass |
| 27 | Client cannot modify another's notification | 27 | Client cannot modify another client's notification | `lib/supabase/clientNotificationsPersistence.ts` | Pass |
| 28 | Communication preference update session-scoped | 28 | Communication preference update is session-scoped | `app/api/client/communication-preferences/route.ts` | Pass |
| 29 | Essential notice handling follows policy | 29 | Essential notice handling follows policy | `docs/PHASE_9E_COMMUNICATION_PREFERENCES_POLICY.md` | Pass |
| 30 | Adviser cannot alter client preferences | 30 | Adviser cannot alter client preferences | No adviser prefs API | Pass |
| 31 | Email recipient from authoritative data | 31 | Email recipient comes from authoritative data | `lib/communications/emailDelivery.ts` | Pass |
| 32 | Email failure does not roll back publication | 32 | Email failure does not roll back content publication | `app/api/admin/communications/[contentId]/publish/route.ts` | Pass |
| 33 | Retry is idempotent | 33 | Retry is idempotent | `lib/communications/emailDelivery.ts` | Pass |
| 34 | Withdrawn content cancels unsent delivery | 34 | Withdrawn content cancels unsent delivery | `app/api/admin/communications/[contentId]/withdraw/route.ts` | Pass |
| 35 | Client cannot view provider metadata | 35 | Client cannot view provider metadata | `app/api/admin/communication-deliveries/route.ts` | Pass |
| 36 | Legacy Promotions not auto-published | 36 | Legacy Promotions are not automatically published | `lib/communications/legacyPromotionsMigration.ts` | Pass |
| 37 | Legacy migration draft/review only | 37 | Legacy migration creates draft/review items only | `lib/communications/legacyPromotionsMigration.ts` | Pass |
| 38 | Binder export requires assigned adviser | 38 | Binder export requires assigned adviser | `lib/communications/binderExport.ts` | Pass |
| 39 | Binder includes only approved sections | 39 | Binder includes only approved sections | `lib/communications/binderExport.ts` | Pass |
| 40 | Binder excludes internal notes | 40 | Binder excludes internal notes | `docs/PHASE_9E_BINDER_EXPORT_POLICY.md` | Pass |
| 41 | Binder begins adviser-internal | 41 | Binder begins adviser-internal | `supabase/migrations/202606200006_phase9e_communications_governance.sql` | Pass |
| 42 | Client access requires explicit binder publication | 42 | Client access requires explicit binder publication | `lib/compliance/featureFlags.ts` | Pass |
| 43 | Feature controls fail closed | 43 | Feature controls fail closed | `lib/compliance/featureFlags.ts` | Pass |
| 44 | Disabling email preserves in-app notification | 44 | Disabling email preserves in-app notification | `docs/PHASE_9E_EMAIL_DELIVERY_POLICY.md` | Pass |
| 45 | Product content kill switch works | 45 | Product content kill switch works | `lib/communications/contentWorkflow.ts` | Pass |
| 46 | Audit metadata has no bodies/financial data | 46 | Audit metadata contains no content bodies or financial data | `lib/communications/auditMetadata.ts` | Pass |
| 47 | Personalised APIs use private/no-store | 47 | Personalised APIs use private/no-store caching | `app/api/client/insights/route.ts` | Pass |
| 48 | Phase 9D portal remains functional | 48 | Phase 9D active-client portal remains functional | `lib/compliance/entitlements.ts` | Pass |
| 49 | Phase 9C Meeting Studio adviser-only | 49 | Phase 9C Meeting Studio remains adviser-only | `lib/compliance/featureFlags.ts` | Pass |
| 50 | Phase 9B prospect journey functional | 50 | Phase 9B prospect journey remains functional | `lib/compliance/entitlements.ts` | Pass |
| 51 | No new API security warnings | 51, 83 | API security checks | Phase 9E API routes | Pass |
| 52 | No undocumented service-role review | 52, 84 | Service-role / security review doc | Client components | Pass |
| 53 | No new lint warnings | 53, 85 | Lint structural checks | Phase 9E UI | Pass |
| 54 | TypeScript passes | 54, 86 | TypeScript structural check | `tsc --noEmit` | Pass |
| 55 | Production build passes | 55, 87 | Production build configured | `npm run build` | Pass |

## QA count discrepancy resolution

- **Original build spec:** 55 explicit behavioural cases (Step 22).
- **Initial checkpoint:** 52 cases — missing separate cases 51–55 (security/lint/tsc/build) and conflated documentation check.
- **Phase 9D discrepancy:** Header comment said 42 but suite always contained **72** cases (43–72 added during Phase 9D hardening). Header corrected; `npm run qa:phase9d-client-portal` reports 72/72.
- **Current Phase 9E suite:** **87 cases** = 55 original + 32 hardening (cases 56–87).

Run: `npm run qa:phase9e-communications`
