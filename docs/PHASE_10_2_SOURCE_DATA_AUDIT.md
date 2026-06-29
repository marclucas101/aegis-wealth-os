# Phase 10.2 — Source Data Audit

**Checkpoint:** 10.2 Work Queue Core Domain  
**Branch:** `phase-10-2-work-queue-core-domain`  
**Date:** 2026-06-24  

---

## Summary

This audit maps every candidate operational source to queue suitability based on repository evidence (`lib/supabase/*`, migrations, phase audits). Sources without stable semantics are excluded.

---

## Included sources

| Source | Identifier | Client scope | Adviser scope | Lifecycle | Dates | Actionability | Destination | Suitability | Reason |
|--------|------------|--------------|---------------|-----------|-------|---------------|-------------|-------------|--------|
| `advisor_tasks` / `advisorTasks.ts` | `id` UUID | `client_id` | `assigned_to_user_id`, assignment | open, in_progress, completed, cancelled | `due_date` | Adviser | Client overview tasks | **Include** | Persisted, due dates, stable status |
| `roadmap_items` / `advisorRoadmapActions.ts` | `id` UUID | `client_id` | adviser assignment on client | not_started, in_progress, completed | `updated_at` | Adviser/client/shared | `/advisor/clients/[id]/roadmap` | **Include** | `task_owner`, `client_visible` |
| Review pipeline / `advisorReviewPipeline.ts` | `clientId` virtual | `clients` row | `advisor_user_id` | servicingState overdue/review_due | `nextRecommendedReviewDate` | Adviser | Shield/review tab | **Include** | Uses existing 12/15 month rules |
| `adviser_appointments` / `appointmentsPersistence.ts` | `id` UUID | `client_id` | `adviser_user_id` | pending, confirmed | `starts_at` | Adviser | `/advisor/appointments` | **Include** | Bounded window query |
| `meeting_sessions` / `meetingSessionPersistence.ts` | `id` UUID | `client_id` | session adviser | prepared/in_progress/completed | `scheduled_start`, `completed_at` | Adviser | Meeting Studio | **Include** | Prep/follow-up signals |
| `published_outputs` / `compliancePublication.ts` | `id` UUID | `client_id` | assigned adviser | draft, adviser_reviewed | `updated_at` | Adviser | Planning outputs | **Include** | Unpublished workflow |
| `binder_exports` / `binderExportPersistence.ts` | `id` UUID | `client_id` | `adviser_user_id` | generation_status failed | `updated_at` | Adviser | Meeting packs tab | **Include** | Actionable failures only |
| File quality / `clientFileQuality.ts` | virtual per client+gap | `client_id` | assignment | gap_detected | n/a | Adviser | Overview / vault | **Include** | Existing checklist only |

---

## Deferred sources

| Source | Suitability | Reason |
|--------|-------------|--------|
| `advisor_task_suggestions` | **Defer** | Computed; duplicates file-quality and review signals; promotion creates real tasks |
| `advisor_notifications` | **Defer** | Ephemeral computed feed; not persisted per operator decision |
| `communication_deliveries` | **Defer** | Admin API only; no adviser-scoped failure surface in 10.2 |
| `client_notifications` | **Reject** | Client-facing queue |

---

## Assignment resolution

All batch loaders scope to clients where `clients.advisor_user_id = authUserId` (adviser role). Admin book-wide queue deferred (`admin_scope_deferred`).

---

## Evidence references

- Tasks: `lib/supabase/advisorTasks.ts`
- Roadmap: `lib/supabase/advisorRoadmapActions.ts`, migration `202606200005_phase9d`
- Review: `lib/supabase/advisorReviewPipeline.ts` (`REVIEW_DUE_MONTHS=12`, `OVERDUE_MONTHS=15`)
- Appointments: `lib/supabase/appointmentsPersistence.ts`
- Meetings: `lib/supabase/meetingSessionPersistence.ts`
- Publications: `lib/compliance/types.ts` `PublicationStatus`
- Binder: `lib/binder/binderPdfTypes.ts` `BinderGenerationStatus`
- File quality: `lib/supabase/clientFileQuality.ts`
