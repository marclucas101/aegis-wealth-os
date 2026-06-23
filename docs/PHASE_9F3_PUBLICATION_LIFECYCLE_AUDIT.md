# Phase 9F.3 Publication Lifecycle Audit

## Initial publication

| Requirement | Implementation |
|-------------|----------------|
| Event | `available` (governed registry) |
| Once per publication | Idempotent notification keys |
| Generic copy | Policy strings — no PDF title/path |
| Destination | `/document-vault` allowlist |
| Notification failure | Does not roll back publication; `binder_lifecycle_notification_failed` audit |

## Supersession (same lineage only)

| Requirement | Implementation |
|-------------|----------------|
| Prior binder withdrawn | `dbSupersedePublishedBinder` |
| Prior document archived | `dbArchiveDocumentRow` |
| Prior not client-downloadable | `assertBinderDocumentClientAccessible` + list filter |
| Event | `superseded` once (idempotent) |
| No duplicate `withdrawn` | Supersession uses reason `superseded_by_new_version`, not client withdrawal event |
| Unrelated lineages | `dbFindCurrentPublishedBinderInLineage` scopes by `binder_lineage_id` |

## Withdrawal

| Requirement | Implementation |
|-------------|----------------|
| Event | `withdrawn` once |
| Repeat call | Idempotent reuse |
| Document archived | Yes |
| Storage retained | No `.remove()` |
| Client signed URL | Denied |

## Download

| Requirement | Implementation |
|-------------|----------------|
| `downloaded` / client notification | **Audit-only** (`binder_client_downloaded`) |
| In-app notification | None |
| Email | None |

## Idempotency keys

Publication and lifecycle keys are SHA-256 of canonical tuples — no PII, storage paths, or financial values in key material.
