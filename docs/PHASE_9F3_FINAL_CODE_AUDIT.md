# Phase 9F.3 Final Code Audit

**Date:** 2026-06-24  
**Scope:** Generation, publication, client access, privacy

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low / accepted | 3 | N/A |

No confirmed defects required code fixes in this batch. Diagnostic predicate matching was corrected in SQL generator only.

---

## Generation

| Control | Status | Evidence |
|---------|--------|----------|
| Adviser authorization | Pass | `resolveAccessibleClient` in `binderGenerationService.ts` |
| Client assignment | Pass | Adviser role checks `advisor_user_id` |
| Feature gates | Pass | `isFeatureEnabled("binder_export")` |
| Strict section allowlist | Pass | `validateSections` filters to `BINDER_SECTIONS` |
| Redaction allowlist | Pass | `assertNoSensitiveMarkersInText`, `binderPdfRedaction.ts` |
| Server-only boundaries | Pass | `import "server-only"` on services |
| Idempotency | Pass | `buildBinderGenerationIdempotencyKey` + unique index |
| Immutable versioning | Pass | `binder_lineage_id` + monotonic `version` |
| Stable error codes | Pass | `BINDER_ERROR_CODES` |
| PDF size limits | Pass | `BINDER_MAX_PDF_BYTES` (25 MiB) |
| Storage path construction | Pass | `buildBinderStoragePath` with UUID validation |
| `upsert: false` | Pass | `binderStoragePersistence.ts` upload options |
| Atomic ready metadata | Pass | `dbTransitionBinderGeneration` after upload |

## Publication

| Control | Status | Evidence |
|---------|--------|----------|
| Explicit adviser action | Pass | `confirmed` required in `publishBinderToClient` |
| Ready-only publication | Pass | `validateBinderPublishable` |
| Linked vault document | Pass | `insertPublishedBinderDocument` then `dbPublishBinderExport` |
| Archived insert before publish | Pass | Document inserted `is_archived: true`, unarchived on publish |
| Same-lineage supersession only | Pass | `dbFindCurrentPublishedBinderInLineage` |
| Version ordering | Pass | Rejects publish when `version <= prior.version` |
| Withdrawal idempotency | Pass | Reused path when already withdrawn |
| No storage deletion | Pass | `dbArchiveDocumentRow` only; no storage remove on withdraw |
| Safe notification failure | Pass | `binder_lifecycle_notification_failed` audit; no rollback |

## Client access

| Control | Status | Evidence |
|---------|--------|----------|
| Client ownership | Pass | `loadBinderByPublishedDocumentId` filters `client_id` |
| Published state | Pass | `status === published_to_client'` |
| Linked document validation | Pass | `published_document_id` match |
| Archived filtering | Pass | `isBinderDocumentListedForClient` |
| Withdrawn/superseded denial | Pass | `assertBinderDocumentClientAccessible` |
| Short-lived signed URLs | Pass | `SIGNED_URL_EXPIRY_SECONDS` |
| No path leakage | Pass | API responses omit `storage_path` |
| No public URLs | Pass | Private `binder-exports` bucket |

## Privacy

| Control | Status | Evidence |
|---------|--------|----------|
| No NRIC / accounts / internal notes | Pass | Redaction patterns + fixture tests |
| No raw scores | Pass | `BLOCKED_KEYS` in redaction |
| No service-role errors to client | Pass | `toBinderPublicError` |
| No DB identifiers in PDF | Pass | QA forbidden markers |
| No storage paths in APIs | Pass | Route validation in QA suite |
| No signed URLs in audit logs | Pass | `BinderAuditMetadata` excludes paths/URLs |

---

## Findings

### F-01 — Diagnostic predicate canonicalizer mismatch (fixed)

| Field | Value |
|-------|-------|
| Severity | Medium (diagnostic only) |
| File | `scripts/gen-phase9f3-diagnostics.ts` |
| Fixed | Yes |
| Detail | General-purpose predicate canonicalizer reported conflicting for `idx_binder_exports_generation_idempotent` and `idx_binder_exports_published_document` despite correct remote indexes. Replaced with index-specific anchored `IS NOT NULL` catalog checks. |

### F-02 — Binder routes use `auditBinderEvent` not `writeAuditLog` directly

| Field | Value |
|-------|-------|
| Severity | Low (accepted) |
| File | `lib/binder/binderAudit.ts`, publish/withdraw routes |
| Fixed | No |
| Justification | Dedicated binder audit actions provide richer metadata without storage paths. Security scanner INFO item is intentional. |

### F-03 — Binder publish/withdraw catch paths use `toBinderPublicError` not `toPublicErrorMessage`

| Field | Value |
|-------|-------|
| Severity | Low (accepted) |
| File | Binder API routes |
| Fixed | No |
| Justification | `toBinderPublicError` returns stable `BINDER_*` codes only — no service-role or DB messages. REVIEW scanner item is false positive for binder domain. |

### F-04 — Staging-only integration paths

| Field | Value |
|-------|-------|
| Severity | Informational |
| File | Generation/publication services |
| Fixed | N/A |
| Justification | End-to-end generation, publication, signed URL issuance require database — documented in local acceptance harness as staging-only. |
