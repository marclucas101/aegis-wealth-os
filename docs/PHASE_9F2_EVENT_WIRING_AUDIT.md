# Phase 9F.2 Event Wiring Audit

Server-side proof for all six lifecycle events. Notifications originate from service layers only — never from React components or client-supplied recipient lists.

## Cross-cutting controls

| Control | Implementation |
|---------|----------------|
| Authoritative mutation first | Hooks run after successful DB mutation in service functions |
| Failed mutations | No notification calls on error/early return paths |
| Recipient resolution | `lifecycleNotificationRecipients.ts` — server-side only |
| Client recipient IDs | Rejected — not accepted in lifecycle APIs |
| State validation | Recipients re-checked at notification time |
| Idempotency | SHA-256 key from canonical tuple; unique index + legacy reference index |
| Notification failure | `emitLifecycleNotificationSafe` — lifecycle state not rolled back |
| Privacy | Generic title/summary; metadata allowlist; no bodies/PII |
| Destinations | `ALLOWED_NOTIFICATION_DESTINATIONS` — server-generated only |
| Feature gate | `document_event_notifications` + `client_in_app_notifications` |

---

## 1. `replaced`

| Requirement | Evidence |
|-------------|----------|
| Authoritative path | `uploadAdvisorProtectionReport()` → `archivePreviousProtectionReports()` in `lib/supabase/advisorDocumentPersistence.ts` |
| Mutation before notify | Archive via `deleteClientDocument()` completes before `emitLifecycleNotificationSafe` |
| Failed mutation | Upload aborts on archive failure for individual docs; new upload still proceeds |
| Recipients | Active client only (`isActiveClientStage`) |
| Access filter | Only clients who could view archived protection summaries (active client vault policy) |
| Idempotency | Key includes `transitionAt` ISO per archived document |
| Double notify | Distinct `sourceEntityId` per archived doc; upload itself uses separate `uploaded` path |

---

## 2. `superseded`

| Requirement | Evidence |
|-------------|----------|
| Published output path | `publishOutput()` after `dbSupersedePublishedOutput()` — `emitPublishedOutputLifecycleNotification({ event: "superseded" })` |
| Governed content path | `publishContent()` calls `withdrawContent({ lifecycleCause: "superseded" })` on parent |
| No double withdrawn+superseded | `withdrawContent` defaults `lifecycleCause` to `"withdrawn"`; publish passes explicit `"superseded"` only for parent withdraw |
| Adviser-only excluded | `validatePublicationRecipient` requires `output_audience === "client_published"` |
| Audience isolation | `resolveGovernedContentRecipients` uses `contentMatchesAudience` |
| Idempotency | `transitionAt` timestamp in canonical tuple |

**Explicit design:** Supersede emits `superseded` event only — not `withdrawn` — for the same transition when `lifecycleCause: "superseded"` is passed.

---

## 3. `withdrawn`

| Requirement | Evidence |
|-------------|----------|
| Publication output | `withdrawOutput()` after DB update |
| Governed content | `withdrawContent()` default `lifecycleCause: "withdrawn"` |
| Adviser document delete | `deleteAdvisorClientDocument()` after archive |
| Client self-delete | `emitDocumentEventNotification({ eventType: "removed" })` maps to `withdrawn` lifecycle |
| Deactivated client | `resolveClientRecipient` returns `client_not_found_or_inactive` / `client_not_active_stage` — skip with audit |
| Unlinked user | `client_user_inactive` / `client_user_missing` fail-closed |

---

## 4. `action_required`

| Requirement | Evidence |
|-------------|----------|
| Document upload | `uploadAdvisorClientDocument({ requiresClientAction: true })` — form field `requires_client_action` |
| Review resubmission | `requestClientReviewAction()` in `reviewSubmissionLifecycle.ts` |
| Repeated saves | Idempotency key includes `sourceLifecycleVersion` — same version → duplicate skip |
| Version change | New `transitionAt` ISO → new key only when lifecycle version genuinely changes |

---

## 5. `action_completed`

| Requirement | Evidence |
|-------------|----------|
| Authoritative path | `completeClientReviewSubmission()` |
| Task hook | `updateAdvisorTask()` → `syncReviewSubmissionOnTaskComplete()` when status → `completed` |
| Unrelated tasks | `syncReviewSubmissionOnTaskComplete` returns early unless `source_key` starts with `client_review_submission:` |
| Prefix guard | Submission ID parsed from task `source_key` suffix |

---

## 6. `downloaded` (audit-only)

| Requirement | Evidence |
|-------------|----------|
| Path | `createDocumentSignedUrl()` after `canClientViewDocument` |
| In-app notification | `lifecycleNotificationPolicy.downloaded.inAppEligible: false` — service returns `audit_only` |
| Email delivery | `emailEligible: false` — no `communication_deliveries` row |
| Audit | `writeAuditLog({ action: "document_downloaded" })` with hashed idempotency reference in metadata |

---

## Destination reauthorization

Client UI uses allowlisted routes only (`ClientNotificationsPanel.tsx`). Opening a notification does not use metadata URLs directly — routes resolved from `referenceType` or sanitized `destinationRoute`. Underlying document/content access revalidated when client navigates to vault/insights routes.

## Findings

| Severity | Finding | Status |
|----------|---------|--------|
| Info | Supersede and withdraw are disambiguated via `lifecycleCause` | Documented and wired |
| Info | `downloaded` cannot create notification rows by policy | Verified |
| Info | Unrelated adviser tasks cannot trigger `action_completed` | Prefix guard verified |

No blocking wiring gaps identified for release gate.
