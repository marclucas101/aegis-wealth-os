# Phase 9F.3 Binder PDF Architecture

## Overview

Server-side PDF generation produces an immutable adviser meeting pack from approved published outputs and selected binder sections. Rendering, storage upload, and metadata persistence are orchestrated in a single server-only service layer (checkpoint 2+). This document defines the architecture; **no renderer is implemented in checkpoint 1**.

---

## Pipeline (target state)

```
POST binder-export (adviser API)
        │
        ▼
binderGenerationService
        │
        ├─ Feature gate: binder_export
        ├─ Assignment: resolveAccessibleClient()
        ├─ Idempotency: buildBinderGenerationIdempotencyKey()
        ├─ Section resolvers (approved outputs only)
        ├─ binderPdfRedaction (strip PII / adviser-internal)
        ├─ binderPdfRenderer (jspdf — server-only)
        ├─ SHA-256 content hash
        ├─ Upload → binder-exports bucket (service-role, upsert: false)
        ├─ Update binder_exports (generation_status = ready)
        └─ Audit: binder_generated
```

---

## Module layout (checkpoint 2+)

| Module | Responsibility |
|--------|----------------|
| `lib/binder/binderPdfTypes.ts` | Section payloads, render context, status enums |
| `lib/binder/binderSectionResolvers.ts` | Fetch client-safe content per `BINDER_SECTIONS` entry |
| `lib/binder/binderPdfRedaction.ts` | Field allowlist; strip NRIC, raw scores, internal notes |
| `lib/binder/binderPdfRenderer.ts` | Assemble PDF buffer via `jspdf` |
| `lib/binder/binderGenerationIdempotencyKey.ts` | Canonical tuple → SHA-256 hex |
| `lib/binder/binderGenerationService.ts` | Orchestrate resolve → render → upload → persist |
| `lib/binder/binderPublicationService.ts` | Publish / withdraw / supersede (checkpoint 3) |
| `lib/supabase/binderStoragePersistence.ts` | Service-role storage helpers |

Existing modules extended (not replaced):

- `lib/communications/binderExport.ts` — delegate to generation service
- `lib/supabase/binderExportPersistence.ts` — new column mappings

---

## Sections

From `BINDER_SECTIONS` in `lib/communications/binderExport.ts`:

| Section | Content source | Redaction level |
|---------|----------------|-----------------|
| `cover_page` | Client + adviser display names, generation date | No financial data |
| `client_adviser_info` | Assigned adviser profile (public fields) | No contact PII beyond name |
| `meeting_date` | Request parameter | — |
| `financial_overview` | Current `published_outputs` (client-safe) | Full redaction envelope |
| `my_plan` | Published plan summary output | Client-safe only |
| `agreed_priorities` | Published priorities / goals summary | Client-safe only |
| `roadmap` | Published roadmap presentation | No adviser-internal notes |
| `meeting_summary` | Published meeting summary output | Exclude Meeting Studio internal notes |
| `document_index` | Vault document titles + categories | **Metadata only** — no paths |
| `next_review_date` | Client review schedule if published | — |

**Inclusion rule:** `isCurrentPublishedOutput()` for all publication-backed sections. Missing approved content → section omitted or generation fails with safe error (configurable per section in implementation).

---

## Renderer choice

| Library | Role |
|---------|------|
| `jspdf` | Primary PDF assembly (server-only for binder) |
| `html2canvas` | **Not used** for binder — DOM/canvas dependency; browser-only |

Rendering is **server-only** (`import "server-only"`). No client-side binder PDF generation.

---

## A4 report utilities (protection report — separate from binder)

Premium A4 summary-report work (`lib/reports/a4Print.ts`, `app/report-a4-print.css`, `generateProtectionReportPdf.ts`) targets the **protection report** client print flow:

| Utility | Server reusable? | Notes |
|---------|------------------|-------|
| `lib/reports/a4Print.ts` | Partial | Pure layout constants/helpers; no DOM |
| `app/report-a4-print.css` | No | Browser print CSS |
| `generateProtectionReportPdf.ts` | Uses `jspdf` + slice pagination | Protection report only; not binder sections |
| `html2canvas` | No | Browser capture for print preview paths |

**Binder checkpoint 2+** should use **server-only `jspdf`** with programmatic layout — not `html2canvas`, not print CSS, not React server components that require DOM.

---

## Immutability and versioning

**Model decision:** Extend `binder_exports` only (no separate `binder_export_versions` table). Each immutable generation is a row sharing `binder_lineage_id` with monotonically increasing `version`. `supersedes_binder_id` links the prior row in the chain.

| Rule | Implementation |
|------|----------------|
| New generation (new inputs) | New row; `version = max(lineage) + 1`; new storage path |
| Regenerate same inputs | Idempotency key collision → return existing `ready` row |
| Storage | `clients/{clientId}/binders/{binderExportId}/v{version}/meeting-pack.pdf`; `upsert: false` |
| Publish | `status = published_to_client`; `published_document_id` → `documents` row; PDF bytes unchanged |
| Withdraw | `status = withdrawn`; `withdrawn_at` + reason; storage object retained |
| Current client-visible | Highest `version` where `status = published_to_client` per lineage (application rule) |

### Dual state machines

**`generation_status`** (PDF pipeline):

```
legacy_manifest  →  (pre-9F.3 rows; no PDF pipeline)
pending          →  row created; render not started
generating       →  render/upload in progress
ready            →  PDF in binder-exports; adviser may download/publish
failed           →  generation_error_code set; safe retry allowed
```

**`status`** (binder lifecycle / client visibility):

```
generated            →  default after manifest or successful PDF generation
published_to_client  →  linked documents row; client vault visibility
withdrawn            →  withdrawn_at required; prior publication hidden
```

**Combined happy path:**

```
pending → generating → ready → published_to_client → withdrawn
                ↘ failed (retry → new pending row or same idempotent ready)
```

Publication and withdrawal transitions update `status` only; `generation_status` remains `ready` for the immutable PDF row.

---

## Idempotency

Canonical tuple (sorted arrays, normalized dates):

```
(client_id, adviser_user_id, meeting_date, sections_sorted,
 source_publication_ids_sorted, binder_schema_version)
```

- SHA-256 hex → `generation_idempotency_key`
- Partial unique index on `binder_exports`
- Retry → `skipped_duplicate` audit; return existing row

---

## Privacy and redaction

Documented in detail in `docs/PHASE_9F3_SECURITY_AND_PRIVACY.md` (checkpoint 2). Summary:

- **Exclude:** shield diagnostic raw scores, adviser-internal outputs, NRIC, account numbers, storage paths, email addresses, Meeting Studio internal notes.
- **PDF hardening:** no embedded JavaScript/actions; sanitize filenames.
- **API responses:** no `content_hash`, `storage_path`, or signed URLs in list endpoints.

---

## Failure semantics

| Failure | Behavior |
|---------|----------|
| Resolver missing required section | Fail closed; `generation_status = failed` |
| Render error | `generation_status = failed`; generic API error |
| Storage upload failure | No `ready` status; audit `binder_generation_failed` |
| DB update after upload | Orphan object possible; audit risk flag |
| Lifecycle notification failure | Publication/generation state retained (9F.2 pattern) |

---

## Integration points (checkpoint 2+)

| System | Integration |
|--------|-------------|
| Phase 9F.2 lifecycle | Publish → in-app notification; withdraw → `withdrawn` |
| Audit log | `binder_generated`, `binder_generation_failed`, `binder_downloaded` |
| Feature flags | `binder_export`, `binder_client_publication` |
| Document vault | `documents` row on publish with `binder_published` tag |

---

## Checkpoint 1 deliverables (this document only)

- Architecture defined; schema migration `202606200010` prepared
- No `lib/binder/*` modules yet
- No API or renderer code

Implementation begins at checkpoint 2 after operator staging validation of migration diagnostics.
