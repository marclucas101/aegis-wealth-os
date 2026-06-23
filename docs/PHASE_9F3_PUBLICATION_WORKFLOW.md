# Phase 9F.3 Publication Workflow

## End-to-end flow

```
Adviser: POST …/binder-exports/[id]/publish (confirm: true)
  → binder_client_publication gate
  → resolveAccessibleClient()
  → validate generation_status = ready + artifact complete
  → idempotent reuse if already published_to_client
  → supersede prior same-lineage publication (if any)
  → insertPublishedBinderDocument() — metadata only, binder-exports bucket
  → dbPublishBinderExport() — published_document_id linkage
  → lifecycle: available (initial) or superseded (prior) + available (new)
  → audit: binder_published_to_client
```

Withdrawal:

```
POST …/binder-exports/[id]/withdraw { reason: allowlisted }
  → archive documents row (no storage delete)
  → binder_exports.status = withdrawn
  → lifecycle: withdrawn
  → audit: binder_withdrawn_from_client
```

## No byte copy

The immutable PDF remains at `clients/{clientId}/binders/{id}/v{n}/meeting-pack.pdf` in `binder-exports`. The `documents` row references the same `storage_bucket` and `storage_path`.

## Concurrency

- Partial unique index `idx_binder_exports_lineage_current_published` — one current published row per lineage
- Idempotent reuse when `published_to_client` + `published_document_id` already set
- Compensating document archive if binder update fails after insert

## Client access

Published binders appear in `GET /api/documents/list`. Download via `POST /api/documents/signed-url` with binder linkage guard.

## Feature flags

| Flag | Effect |
|------|--------|
| `binder_export` | Generation (Checkpoint 2) |
| `binder_client_publication` | Publish + withdraw (default off) |
| `document_event_notifications` | Lifecycle notifications only |

Already-published binders remain client-readable when `binder_client_publication` is disabled until explicitly withdrawn.
