# Phase 9B — Prospect Experience Audit

Branch: `phase-9b-prospect-experience`  
Builds on: Phase 9A compliance access architecture (accepted)

## Summary

Phase 9B introduces a focused prospect journey without weakening Phase 9A entitlements, publication workflow, relationship stages, or client-safe DTOs.

| Area | Current route (pre-9B) | Friction | Proposed route | Entitlement | Redesign action |
|------|------------------------|----------|----------------|-------------|-----------------|
| Invitation | Admin/adviser APIs | Manual fallback common; no deep-link | `/signup` → `/prospect` | N/A (pre-auth) | Post-auth prospect routing |
| Login | `/login` → `/auth/continue` → stage-aware | Server-resolved destination | `/prospect` for prospect stages | Session | `lib/compliance/postAuthRouting.ts` |
| Discover | `/discover` | Shield unlock copy; demo prefill; auto `status: active` | `/discover` (5 sections) | `complete_information` | Progressive sections, auto-save, submit flow |
| Profile | `/profile` | Legacy status only | `/profile` (optional) | `complete_information` | Stage labels (future) |
| Documents | `/document-vault` | Nav hidden for prospects (`documents` vs `limited_documents`) | `/document-vault` | `limited_documents` | Fixed nav mapping + API guards + prospect filter |
| Appointments | `/my-adviser` | Requires assignment | `/my-adviser` | `appointments`, `my_adviser` | Preparation checklist link |
| Dashboard | `/dashboard` | Shield branding; legacy fallbacks | `/dashboard` (My Snapshot) | `financial_readiness_snapshot` | Client-safe snapshot only |
| Navigation | Full `NAV_SECTIONS` filtered | Shield modules in catalogue | `PROSPECT_NAV_SECTIONS` | Server entitlements | 6-item focused nav |
| Prospect home | None | No journey overview | `/prospect` | `financial_readiness_snapshot` | **New** premium home |
| Meeting prep | None | No dedicated page | `/meeting-preparation` | `meeting_preparation` | **New** checklist page |
| Submission | Discover save only | No stage transition | `/api/discover/submit` | `complete_information` | Server `fact_find_complete` + adviser task |
| Publication | Phase 9A | — | `/dashboard` | `prospect_readiness_snapshot` | Reuse fallback + published DTO |
| Adviser resolution | `clients.advisor_user_id` | Self-signup unassigned | — | `hasAssignedAdviser` | Unchanged; surfaced in UI |

## Phase 9A dependencies preserved

- `getClientEntitlements()` — authoritative nav
- `resolveClientFinancialReadinessAccess()` — dashboard API
- `resolveRestrictedClientModuleAccess()` — red-tier modules
- `publicationWorkflow` — adviser prepare/review/publish
- `clientSafeDtos` — allowlisted prospect snapshot
- `canClientSelfPromote()` — always false

## Key files

| Concern | Path |
|---------|------|
| Prospect nav | `lib/navigation.ts`, `lib/compliance/entitlements.ts` |
| Prospect home | `app/prospect/page.tsx`, `lib/compliance/prospectHomeData.ts` |
| Information collection | `components/aegis/discover/DiscoverWizard.tsx`, `lib/aegis/prospectProfileSections.ts` |
| Submission | `app/api/discover/submit/route.ts`, `lib/compliance/prospectSubmission.ts` |
| Meeting prep | `app/meeting-preparation/page.tsx`, `lib/compliance/meetingPreparationData.ts` |
| Documents | `lib/compliance/documentAccess.ts`, `lib/supabase/documentPersistence.ts` |
| Analytics | `lib/compliance/prospectAnalytics.ts` |
| Post-auth routing | `lib/compliance/postAuthRouting.ts`, `app/auth/continue/route.ts` |
| Appointment stage | `lib/compliance/appointmentStageTransition.ts` |
| Local privacy | `lib/aegis/discoverLocalDraft.ts`, `lib/aegis/localProfile.ts` |
| Document visibility | `lib/compliance/documentVisibility.ts` |

## Phase 9B hardening (acceptance pass)

| Control | Implementation |
|---------|----------------|
| First-time prospect routing | `resolvePostAuthDestination()` — prospect stages → `/prospect`; active → `/dashboard`; adviser/admin unchanged |
| No open redirect | `validateSafeReturnUrl()` allowlists paths; rejects `//`, `://`, `..` |
| Invitation deep-links | `validateInviteDestination()` — `/prospect`, `/discover`, `/meeting-preparation`, `/my-adviser` only |
| Appointment → `meeting_scheduled` | `maybeAdvanceRelationshipStageForAppointment()` in client + adviser booking paths |
| Stage regression guard | Later stages (`recommendation_prepared`, `active_client`) never downgraded by appointment |
| Local data privacy | Production disables sensitive `localStorage` drafts; account-scoped keys; cleanup on submit/logout |
| Submission idempotency | Server `computeServerSubmissionCompleteness()`; task `source_key`; stage advance only from `prospect` |
| Document signed URL | `createDocumentSignedUrl()` re-checks `canClientViewDocument()` at request time |
| Staff document access | `createStaffDocumentSignedUrl()` for adviser paths (assignment already verified) |

See also: `PHASE_9B_LOCAL_DATA_PRIVACY_REVIEW.md`, `PHASE_9B_ANALYTICS_EVENT_MATRIX.md`.

## UX review notes (code + static review)

**Verified in implementation**

- One primary CTA per prospect home state (`prospectJourney.ts`)
- Submission confirmation page (`/discover/submitted`) avoids dead-end
- Discover wizard preserves form state on validation errors (controlled form)
- Prospect nav limited to 6 items; mobile uses shared `AuthenticatedAppShell`
- Loading copy uses prospect terminology (`FinancialReadinessSnapshotView`, fallback panels)

**Unresolved — requires human staging**

- Full keyboard trap audit on Discover multi-step form
- Screen-reader announcement of section completion progress
- iOS Safari back-button behavior on `/discover` wizard
- Invitation email copy when Supabase invite fails (manual fallback instructions only)

No database migration required for Phase 9B. Uses existing `relationship_stage`, `advisor_tasks.source_key`, and `discover_profiles` JSON storage.
