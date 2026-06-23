# Phase 9F.2 — Existing Notification Audit

Authoritative sources: `docs/PHASE_9E_DOCUMENT_NOTIFICATION_POLICY.md`, `lib/communications/documentEventNotifications.ts`, Phase 9E communications schema and workflows.

## Already wired (Phase 9E — out of scope for the six deferred hooks)

| Event | Mutation path | Recipient | In-app | Email |
|-------|---------------|-----------|--------|-------|
| `uploaded` | `app/api/documents/upload/route.ts` | Converted client | Yes | No |
| `published_to_client` | `app/api/advisor/clients/[clientId]/documents/upload/route.ts` | Active client | Yes | No |
| `removed` | `app/api/documents/delete/route.ts` | Client (self-delete) | Yes | No |

Governed-content publication uses `deliverPublicationNotifications()` in `lib/communications/publicationDelivery.ts` (manual admin publish + Phase 9F.1 scheduled job). That path is separate from document lifecycle events.

## Six deferred hooks (Phase 9F.2 scope)

### 1. `replaced`

| Field | Value |
|-------|-------|
| Authoritative mutation path | `uploadAdvisorProtectionReport()` in `lib/supabase/advisorDocumentPersistence.ts` — archives prior client-visible protection portfolio summaries before saving a new PDF |
| Recipient type | Single converted/active client assigned to the vault document |
| In-app required | Yes |
| Email allowed | No (Phase 9E document policy — in-app only) |
| Idempotency key | `replaced:document:{documentId}:{clientId}:v{archivedAtIso}` per superseded document |
| Sensitive fields excluded | Filename, financial metadata in description, storage paths, signed URLs |
| Gap | Type and mapping existed; no caller on replacement/archive-before-upload flow |

### 2. `superseded`

| Field | Value |
|-------|-------|
| Authoritative mutation paths | (a) `publishOutput()` → `dbSupersedePublishedOutput()` in `lib/compliance/publicationWorkflow.ts`; (b) `publishContent()` → `withdrawContent({ lifecycleCause: "superseded" })` in `lib/communications/contentWorkflow.ts` |
| Recipient type | Client(s) who previously received the superseded publication (single client for `published_outputs`; audience-resolved clients for `governed_content`) |
| In-app required | Yes |
| Email allowed | No for supersession notice (publication email remains governed-content publish path only) |
| Idempotency key | `superseded:{entityType}:{entityId}:{clientId}:{transitionAtIso}` |
| Sensitive fields excluded | `safe_payload`, financial values, withdrawal reasons with PII |
| Gap | Event type defined; no `EVENT_TO_NOTIFICATION` mapping or service caller |

### 3. `withdrawn`

| Field | Value |
|-------|-------|
| Authoritative mutation paths | (a) `withdrawOutput()` in `lib/compliance/publicationWorkflow.ts`; (b) `withdrawContent()` (non-supersede) in `lib/communications/contentWorkflow.ts`; (c) `deleteAdvisorClientDocument()` in `lib/supabase/advisorDocumentPersistence.ts` |
| Recipient type | Assigned client for outputs/documents; audience-resolved clients for governed content |
| In-app required | Yes |
| Email allowed | No (pending insight emails cancelled via existing delivery ledger) |
| Idempotency key | `withdrawn:{entityType}:{entityId}:{clientId}:{withdrawnAtIso}` |
| Sensitive fields excluded | Withdrawal reason text, file paths, provider payloads |
| Gap | Mapping existed; adviser delete and publication/content withdrawal did not emit notifications |

### 4. `action_required`

| Field | Value |
|-------|-------|
| Authoritative mutation paths | (a) Adviser document upload when `requires_client_action=true` (`uploadAdvisorClientDocument`); (b) `requestClientReviewAction()` in `lib/compliance/reviewSubmissionLifecycle.ts` when adviser reopens a review submission |
| Recipient type | Single active client |
| In-app required | Yes |
| Email allowed | No |
| Idempotency key | `action_required:{entityType}:{entityId}:{clientId}:{transitionAtIso}` |
| Sensitive fields excluded | Submission payload, internal review notes |
| Gap | Mapping existed; no workflow emitted the event |

### 5. `action_completed`

| Field | Value |
|-------|-------|
| Authoritative mutation path | `completeClientReviewSubmission()` in `lib/compliance/reviewSubmissionLifecycle.ts` — invoked when an adviser completes a linked review task (`updateAdvisorTask` → task `source_key` prefix `client_review_submission:`) |
| Recipient type | Submitting client |
| In-app required | Yes |
| Email allowed | No |
| Idempotency key | `action_completed:client_review_submission:{submissionId}:{clientId}:reviewed` |
| Sensitive fields excluded | Submission payload, adviser task description |
| Gap | Type defined; no mapping or completion workflow hook |

### 6. `downloaded`

| Field | Value |
|-------|-------|
| Authoritative mutation path | `createDocumentSignedUrl()` in `lib/supabase/documentPersistence.ts` (client vault access) |
| Recipient type | N/A — audit-only per Phase 9E policy |
| In-app required | No |
| Email allowed | No |
| Idempotency key | `downloaded:document:{documentId}:{clientUserId}:{downloadDate}` (audit dedupe) |
| Sensitive fields excluded | Signed URL, storage path |
| Gap | No audit hook on successful client download |

## Supporting infrastructure audited

| Component | Role |
|-----------|------|
| `client_notifications` | In-app store; unique index `(client_id, notification_type, reference_type, reference_id)` |
| `communication_deliveries` | Email ledger; unique `(communication_id, client_id, channel)` |
| `communication_preferences` | Channel/category opt-out |
| `document_event_notifications` | Feature gate (reused for lifecycle — no separate flag) |
| `client_in_app_notifications` | Master in-app gate |
| Client API | `GET /api/client/notifications`, `PATCH /api/client/notifications/[id]` |
| Unread count | Derived client-side from `readAt === null` |

## Feature-control decision

Reuse existing `document_event_notifications` (default enabled in DB seed). Lifecycle notifications are document/publication lifecycle extensions of the same governed channel. No new `document_lifecycle_notifications` flag — operators disable via existing control; lifecycle transitions remain available.
