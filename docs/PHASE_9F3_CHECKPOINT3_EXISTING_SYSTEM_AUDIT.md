# Phase 9F.3 Checkpoint 3 — Existing System Audit

**Date:** 2026-06-24  
**Branch:** `phase-9f3-binder-client-vault`  
**Scope:** Client vault publication and client access (Checkpoint 3)

---

## Authoritative `documents` creation path

| Path | Module | Notes |
|------|--------|-------|
| Client upload | `uploadClientDocument()` | `client-documents` bucket |
| Adviser upload | `uploadAdvisorClientDocument()` | Same bucket |
| Protection report | `uploadAdvisorProtectionReport()` | `client-documents`; supersede via archive |
| **Binder publish (Checkpoint 3)** | `insertPublishedBinderDocument()` | **Metadata only** — `binder-exports` bucket, no byte copy |

Insert pattern: service-role `documents` row with `storage_bucket` + `storage_path` from `binder_exports` (immutable PDF already uploaded at generation).

---

## Document ownership and client visibility

| Mechanism | Location |
|-----------|----------|
| Row ownership | `documents.client_id` |
| Prospect visibility | `canClientViewDocument()` — requires `client_visible` tag or client upload |
| Active client | All non-archived documents visible |
| Binder tags (planned) | `binder_published`, `client_visible` |
| Source feature | `advisor_binder_export` constant on row |
| Withdrawal | `is_archived = true` on document; **no storage delete** for binder PDFs |

---

## Can `documents` reference `binder-exports`?

**Yes.** `storage_bucket` is unconstrained. `issueSignedUrlForDocument()` signs any bucket on the row. Architecture requires single object in `binder-exports`; publication links metadata only.

`documents.storage_path` UNIQUE is satisfied by versioned binder paths.

---

## Signed-URL helper and `client-documents` assumption

`issueSignedUrlForDocument()` uses `document.storage_bucket` dynamically — **not hard-coded** to `client-documents`. Client binder download reuses `POST /api/documents/signed-url` after publication creates a vault row.

Additional gate (Checkpoint 3): `assertBinderDocumentClientAccessible()` verifies linked `binder_exports` row is `published_to_client` and not withdrawn before signing.

---

## Vault list support for generated binders

`GET /api/documents/list` → `listClientDocuments()` returns all non-archived client documents. Published binder rows appear as normal vault items with `source_feature: advisor_binder_export`. **No parallel client binder repository required.**

Withdrawn binders: document archived → hidden from default list.

---

## Lifecycle event for initial binder availability

| Event | Use |
|-------|-----|
| `available` | **New (Checkpoint 3)** — first publication of a binder document to client vault |
| `superseded` | Prior binder document when newer lineage version published |
| `withdrawn` | Adviser withdrawal from client |
| `replaced` | Protection-report pattern — **not used** for binders |
| `action_required` | **Not overloaded** for binder availability |
| `downloaded` | Audit-only on client signed URL (unchanged) |

Gated by `document_event_notifications` + `client_in_app_notifications`. Publication succeeds if notification fails.

---

## Transactional gap (pre–Checkpoint 3)

| Gap | Mitigation (Checkpoint 3) |
|-----|---------------------------|
| Document insert without binder update | Compensating archive of orphan document row |
| Binder update without document | Prevented by `binder_exports_published_document_link` constraint |
| Two current published versions per lineage | Partial unique index `idx_binder_exports_lineage_current_published` |
| Concurrent publish | Idempotent reuse when `published_to_client` + `published_document_id` already set; unique index on lineage current |
| Delete destroys binder PDF | `deleteClientDocument()` skips storage removal when `binder_published` tag present |

Full multi-statement atomicity: service-layer ordered operations + DB constraints. No client/authenticated RPC exposure.

---

## Feature flags

| Flag | Checkpoint 3 behavior |
|------|----------------------|
| `binder_export` | Adviser generate/list/download (Checkpoint 2) |
| `binder_client_publication` | Publish, withdraw, **new** client publication paths — default **off** |
| `document_event_notifications` | Lifecycle notifications only; does not block publish |

**Disabled `binder_client_publication`:** blocks new publish/withdraw; **already-published** binders remain readable via vault until withdrawn (document row + binder state check).

---

## RLS posture (unchanged)

- No client policies on `binder_exports`
- Client access via `documents` + authorized APIs
- No authenticated storage policies on `binder-exports`

---

## Implementation decisions (Checkpoint 3)

1. Central `binderPublicationService` / `binderWithdrawalService` — routes delegate only.
2. Vault integration over `GET /api/client/binders` — existing document list sufficient.
3. Client download via existing `POST /api/documents/signed-url` with binder linkage guard.
4. Add lifecycle event `available` to fixed registry.
5. Amend migration `202606200010` with lineage current-publication unique index only (no migration `011`).
