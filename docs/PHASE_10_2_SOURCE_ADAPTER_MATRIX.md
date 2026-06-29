# Phase 10.2 — Source Adapter Matrix

| Source type | Adapter | Category | Owner | Blocking | Due date | Route builder |
|-------------|---------|----------|-------|----------|----------|---------------|
| advisor_task | advisorTaskAdapter | task | persisted | urgent overdue | yes | clientTasks |
| roadmap_item | roadmapItemAdapter | roadmap | persisted | no | no | clientRoadmap |
| review_due | reviewDueAdapter | review | computed | no | yes | clientShieldReview |
| appointment | appointmentAdapter | meeting | persisted | no | yes | adviserAppointments |
| meeting_follow_up | meetingFollowUpAdapter | meeting | persisted | prep missing | yes | clientMeetingStudio |
| planning_output | planningOutputAdapter | planning | persisted | no | no | clientPlanningOutputs |
| binder_export | binderExportAdapter | binder | persisted | yes (failed) | no | clientMeetingPacks |
| data_completeness | dataCompletenessAdapter | data_quality | computed | no | no | clientOverview |
| document_follow_up | dataCompletenessAdapter | document | computed | no | no | clientDocumentVault |

**Deferred:** advisor_task_suggestions, advisor_notifications, communication_delivery  
**Rejected:** client_notifications

All adapters implement `AdviserWorkItemAdapter` in `lib/work-queue/adapters/types.ts`.

Batch data loaded once in `loadWorkQueueBatchData.ts`; adapters are synchronous maps over `WorkQueueBatchData`.
