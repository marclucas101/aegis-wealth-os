# Phase 9F.3 Storage Security Audit

## Bucket `binder-exports`

| Control | Status |
|---------|--------|
| Private (`public = false`) | Enforced in migration |
| No public URL path | Signed URLs only; short TTL |
| No authenticated storage policy | Verified — migration adds none |
| No client enumeration API | Clients use document vault APIs |
| No adviser direct storage list | Adviser uses binder APIs; paths omitted |
| Service-role upload only | `binderStoragePersistence.ts` uses admin client |
| `upsert: false` | Immutable objects per version |
| MIME `application/pdf` only | Bucket + app validation |
| 25 MiB limit | Bucket `file_size_limit` + `BINDER_MAX_PDF_BYTES` |
| UUID path validation | `isValidBinderStorageUuid` |
| Canonical path | `clients/{clientId}/binders/{binderExportId}/v{version}/meeting-pack.pdf` |

## API response hygiene

- List APIs omit `storage_path`, `content_hash`, bucket
- Signed URL returned only from authorized download endpoints
- Signed URLs not logged in audit metadata

## Client access after state change

| State | New signed URL |
|-------|----------------|
| `published_to_client` + linked doc | Allowed (reauthorized each request) |
| Withdrawn | Denied |
| Superseded | Denied |
| Unpublished / ready only | Denied (client) |
| Feature `binder_client_publication` disabled | New publish/withdraw blocked; existing published remain readable until withdrawn |

Already-issued URLs expire naturally (`SIGNED_URL_EXPIRY_SECONDS` = 120).

## Orphan-object risk

If PDF upload succeeds but DB finalize fails, `binder_storage_orphan_risk` is audited. Objects are **not** auto-deleted. Operator may reconcile using binder row absence vs storage inventory (see `PHASE_9F3_INCIDENT_RESPONSE.md`).

## PDF bytes

Publication references existing immutable object — **no copy** on client publication.
