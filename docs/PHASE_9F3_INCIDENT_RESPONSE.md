# Phase 9F.3 Incident Response

## Publication consistency risk

**Signal:** `binder_publication_consistency_risk` audit

**Meaning:** Document row may exist while binder publish update failed.

**Response:**

1. Identify `documentId` from operator logs (not client-facing)
2. Confirm binder row `status` ≠ `published_to_client`
3. Archive orphan document OR complete publish after root-cause fix
4. Do not expose document to client until binder linkage confirmed

## Storage orphan risk

**Signal:** `binder_storage_orphan_risk` audit

**Meaning:** PDF uploaded to `binder-exports` but DB not `ready`.

**Response:**

1. Locate object via service-role inventory (operator only)
2. Compare with `binder_exports.storage_path`
3. Retain object for investigation — **do not delete** without retention policy approval
4. Retry generation or mark binder `failed` with sanitized code

## Notification delivery failure

**Signal:** `binder_lifecycle_notification_failed`

**Response:** No rollback required. Retry is idempotent. Verify `document_event_notifications` enabled if notifications expected.

## Unique index violation on publish

**Signal:** `BINDER_PUBLICATION_CONFLICT` during concurrent publish

**Response:** Expected under race. Retry; idempotent path should return existing publication.

## Client reports unavailable document

**Likely causes:** Withdrawn, superseded, or archived document.

**Response:** Reauthorize via signed-URL path. UI shows generic unavailable copy — do not expose adviser-only reasons.

## Feature accidentally disabled

**`binder_client_publication` off:** Existing publications remain readable. Re-enable for new publish/withdraw operations.

## Escalation

Do not expose storage paths, signed URLs, or PDF content in tickets. Include binder export ID, version, lineage ID, and sanitized audit action only.
