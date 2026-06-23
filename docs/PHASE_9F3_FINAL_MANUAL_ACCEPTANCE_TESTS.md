# Phase 9F.3 Final Manual Acceptance Tests

Execute on **staging** after application deploy. Migration `202606200010` is already applied remotely. **Do not mark tests as passed until executed.**

## Feature-control defaults

| Feature | Staging start | Enable when |
|---------|---------------|-------------|
| `binder_export` | disabled | Test 1 |
| `binder_client_publication` | disabled | Test 7 |
| `document_event_notifications` | disabled | Test 15 (last) |

---

## Test 1 — Adviser generation

| Field | Detail |
|-------|--------|
| **Prerequisites** | Assigned adviser + client; migration applied |
| **Feature state** | `binder_export` = **enabled** |
| **Role** | Adviser (assigned) |
| **Action** | UI: Client workspace → Meeting packs → Generate with sections `cover_page`, `meeting_date`, `roadmap` |
| **HTTP/UI** | 200; status `ready`; `version` = 1 |
| **Database** | `binder_exports.generation_status = ready`; `content_hash` populated; `storage_path` set |
| **Storage** | Object at `clients/{clientId}/binders/{binderId}/v1/meeting-pack.pdf` |
| **Audit** | `binder_generated` |
| **Notification** | None |
| **Privacy** | API JSON has no `storage_path`, `content_hash`, signed URL |
| **Cleanup** | Keep row for subsequent tests |

## Test 2 — PDF inspection

| Field | Detail |
|-------|--------|
| **Prerequisites** | Test 1 binder ready |
| **Feature state** | `binder_export` enabled |
| **Role** | Adviser |
| **Action** | Download PDF; open in viewer and text search |
| **HTTP/UI** | PDF opens |
| **Database** | Unchanged |
| **Storage** | Unchanged |
| **Audit** | `binder_downloaded` |
| **Notification** | None |
| **Privacy** | No NRIC, account numbers, policy IDs, internal notes, storage paths, UUIDs in body |
| **Cleanup** | None |

## Test 3 — Adviser download

| Field | Detail |
|-------|--------|
| **Prerequisites** | Test 1 binder |
| **Feature state** | `binder_export` enabled |
| **Role** | Adviser |
| **Action** | `GET /api/advisor/clients/{clientId}/binder-exports/{id}/signed-url` |
| **HTTP/UI** | 200; `signedUrl` + `expiresIn`; no path field |
| **Database** | Unchanged |
| **Storage** | Unchanged |
| **Audit** | `binder_downloaded` |
| **Notification** | None |
| **Privacy** | Response omits storage path |
| **Cleanup** | None |

## Test 4 — Idempotent reuse

| Field | Detail |
|-------|--------|
| **Prerequisites** | Test 1 binder; identical generation input |
| **Feature state** | `binder_export` enabled |
| **Role** | Adviser |
| **Action** | Repeat identical `POST /api/advisor/clients/{clientId}/binder-export` |
| **HTTP/UI** | 200; `reused: true`; same `id` |
| **Database** | Single row; no duplicate version |
| **Storage** | No second object |
| **Audit** | `binder_generation_reused` |
| **Notification** | None |
| **Privacy** | N/A |
| **Cleanup** | None |

## Test 5 — Regeneration

| Field | Detail |
|-------|--------|
| **Prerequisites** | Test 1 lineage |
| **Feature state** | `binder_export` enabled |
| **Role** | Adviser |
| **Action** | Generate with different `sections` (e.g. add `financial_overview`) |
| **HTTP/UI** | 200; `version` = 2; same `binderLineageId` |
| **Database** | New row; `version` incremented |
| **Storage** | New object `v2/meeting-pack.pdf` |
| **Audit** | `binder_generated` |
| **Notification** | None |
| **Privacy** | N/A |
| **Cleanup** | Keep v2 for publication tests |

## Test 6 — Unassigned adviser denial

| Field | Detail |
|-------|--------|
| **Prerequisites** | Second adviser not assigned to client |
| **Feature state** | `binder_export` enabled |
| **Role** | Unassigned adviser |
| **Action** | Attempt generation for client |
| **HTTP/UI** | 403; `BINDER_ACCESS_DENIED` |
| **Database** | No new row |
| **Storage** | No upload |
| **Audit** | None |
| **Notification** | None |
| **Privacy** | N/A |
| **Cleanup** | None |

## Test 7 — Enable publication

| Field | Detail |
|-------|--------|
| **Prerequisites** | Ready binder (v2) |
| **Feature state** | Enable `binder_client_publication` in `platform_feature_controls` |
| **Role** | Admin |
| **Action** | `UPDATE platform_feature_controls SET enabled = true WHERE feature_key = 'binder_client_publication'` |
| **HTTP/UI** | N/A (SQL) |
| **Database** | Flag enabled |
| **Storage** | N/A |
| **Audit** | N/A |
| **Notification** | None |
| **Privacy** | N/A |
| **Cleanup** | Leave enabled for tests 8–14 |

## Test 8 — Publish

| Field | Detail |
|-------|--------|
| **Prerequisites** | Test 5 v2 ready; publication enabled |
| **Feature state** | `binder_client_publication` enabled |
| **Role** | Assigned adviser |
| **Action** | UI Publish with confirm, or `POST .../publish` with `{ "confirm": true }` |
| **HTTP/UI** | 200; `publicationStatus: published_to_client`; `documentId` returned |
| **Database** | `status = published_to_client`; `published_document_id` set; documents row unarchived |
| **Storage** | Unchanged (same object) |
| **Audit** | `binder_published_to_client` |
| **Notification** | None yet (`document_event_notifications` disabled) |
| **Privacy** | No storage path in response |
| **Cleanup** | Keep published |

## Test 9 — Client vault visibility

| Field | Detail |
|-------|--------|
| **Prerequisites** | Test 8 published |
| **Feature state** | Publication enabled; notifications disabled |
| **Role** | Client |
| **Action** | Open Document Vault |
| **HTTP/UI** | Meeting pack visible; unpublished binders absent |
| **Database** | Unchanged |
| **Storage** | N/A |
| **Audit** | None |
| **Notification** | None |
| **Privacy** | List API omits storage paths |
| **Cleanup** | None |

## Test 10 — Client download

| Field | Detail |
|-------|--------|
| **Prerequisites** | Test 8 published |
| **Feature state** | Publication enabled |
| **Role** | Client |
| **Action** | `GET /api/documents/signed-url` for published document |
| **HTTP/UI** | 200; signed URL works; expires after TTL |
| **Database** | Unchanged |
| **Storage** | Read via signed URL only |
| **Audit** | `binder_client_downloaded` |
| **Notification** | None |
| **Privacy** | No path in API JSON |
| **Cleanup** | None |

## Test 11 — Same-lineage supersession

| Field | Detail |
|-------|--------|
| **Prerequisites** | v2 published; generate v3 and publish |
| **Feature state** | Both features enabled |
| **Role** | Adviser then client |
| **Action** | Generate v3 → publish |
| **HTTP/UI** | v3 current; v2 unavailable to client |
| **Database** | v2 `status = superseded` or withdrawn; v3 published |
| **Storage** | v2 object retained |
| **Audit** | `binder_superseded` on v2 |
| **Notification** | None (notifications still disabled) |
| **Privacy** | N/A |
| **Cleanup** | Keep v3 current |

## Test 12 — Withdrawal

| Field | Detail |
|-------|--------|
| **Prerequisites** | Published binder |
| **Feature state** | Publication enabled |
| **Role** | Adviser |
| **Action** | `POST .../withdraw` with `{ "reason": "adviser_withdrawal" }` |
| **HTTP/UI** | 200; `publicationStatus: withdrawn` |
| **Database** | `withdrawn_at` set; document archived |
| **Storage** | Object **not** deleted |
| **Audit** | `binder_withdrawn_from_client` |
| **Notification** | None |
| **Privacy** | N/A |
| **Cleanup** | None |

## Test 13 — Stale access denial

| Field | Detail |
|-------|--------|
| **Prerequisites** | Withdrawn binder; old notification if any |
| **Feature state** | Any |
| **Role** | Client |
| **Action** | Attempt download or open stale notification link |
| **HTTP/UI** | 403 or UI: "This document is no longer available." |
| **Database** | Unchanged |
| **Storage** | N/A |
| **Audit** | None |
| **Notification** | Stale destination safe state |
| **Privacy** | N/A |
| **Cleanup** | None |

## Test 14 — Cross-client denial

| Field | Detail |
|-------|--------|
| **Prerequisites** | Client A published binder |
| **Feature state** | Publication enabled |
| **Role** | Client B |
| **Action** | Attempt signed URL / vault access for Client A document |
| **HTTP/UI** | 403 `BINDER_ACCESS_DENIED` |
| **Database** | Unchanged |
| **Storage** | N/A |
| **Audit** | None |
| **Notification** | None |
| **Privacy** | N/A |
| **Cleanup** | None |

## Test 15 — Enable notifications (last)

| Field | Detail |
|-------|--------|
| **Prerequisites** | Tests 8–14 complete |
| **Feature state** | Enable `document_event_notifications` |
| **Role** | Admin |
| **Action** | Enable flag in `platform_feature_controls` |
| **HTTP/UI** | N/A |
| **Database** | Flag enabled |
| **Storage** | N/A |
| **Audit** | N/A |
| **Notification** | N/A |
| **Privacy** | N/A |
| **Cleanup** | Leave per environment policy |

## Test 16 — Lifecycle notifications

| Field | Detail |
|-------|--------|
| **Prerequisites** | Notifications enabled |
| **Feature state** | All three features enabled |
| **Role** | Client |
| **Action** | Publish new version; withdraw another |
| **HTTP/UI** | `available`, `superseded`, `withdrawn` notifications appear |
| **Database** | Notification rows created |
| **Storage** | N/A |
| **Audit** | Publication audits unchanged |
| **Notification** | Generic summaries; no storage paths |
| **Privacy** | No signed URLs in notification payload |
| **Cleanup** | None |

## Test 17 — Download audit-only

| Field | Detail |
|-------|--------|
| **Prerequisites** | Client download performed |
| **Feature state** | Any |
| **Role** | Operator |
| **Action** | Inspect `audit_logs` for `binder_client_downloaded` |
| **HTTP/UI** | N/A |
| **Database** | Metadata has `binderExportId`, `version`; **no** `signedUrl`, `storage_path` |
| **Storage** | N/A |
| **Audit** | Pass if clean |
| **Notification** | N/A |
| **Privacy** | Pass |
| **Cleanup** | None |

---

## Results table

| Test ID | Pass/Fail | Evidence | Tester | Timestamp | Notes |
|---------|-----------|----------|--------|-----------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |
| 11 | | | | | |
| 12 | | | | | |
| 13 | | | | | |
| 14 | | | | | |
| 15 | | | | | |
| 16 | | | | | |
| 17 | | | | | |

---

## Reset instructions

To re-run from clean publication state:

1. Withdraw all published binders in test lineage
2. Disable `document_event_notifications` → `binder_client_publication` → `binder_export` (reverse enablement order)
3. Archive test `documents` rows if needed
4. Optionally delete test `binder_exports` rows in staging only (never production without operator plan)
