# Phase 9F.3 Generation Workflow

## Scope (Checkpoint 2)

Adviser-side only: generate, list, signed download. No client vault publication (Checkpoint 3).

---

## Pipeline

```
POST /api/advisor/clients/[clientId]/binder-export
  → feature gate: binder_export
  → resolveAccessibleClient()
  → validate section allowlist (BINDER_SECTIONS)
  → resolveBinderSections() — published outputs only
  → buildRedactedRenderModel()
  → buildBinderGenerationIdempotencyKey() — SHA-256
  → reuse if generation_status = ready (same key)
  → allocate lineage version (DB max + 1)
  → pending → generating
  → renderBinderPdf() — jsPDF server-only
  → uploadBinderPdf() — binder-exports, upsert: false
  → atomic finalize ready (ready_requires_artifact)
  → audit binder_generated | binder_generation_reused
```

---

## Server boundaries

| Layer | `server-only` | May use service-role |
|-------|---------------|----------------------|
| `lib/binder/*` | Yes | Via persistence helpers only |
| `lib/supabase/binderExportPersistence.ts` | Yes | Yes |
| `lib/supabase/binderStoragePersistence.ts` | Yes | Yes |
| API routes | Server components/routes | No direct — call services |

Client components must not import binder modules, storage paths, or PDF buffers.

---

## Idempotency

Canonical tuple (sorted arrays, normalized meeting date):

```json
{
  "client_id": "<uuid>",
  "adviser_user_id": "<uuid>",
  "binder_lineage_id": "<uuid|null>",
  "meeting_date": "YYYY-MM-DD|null",
  "sections": ["..."],
  "source_publications": ["<id>:<version>", "..."],
  "renderer_schema_version": "phase9f3-v1"
}
```

SHA-256 hex → `generation_idempotency_key` (64 chars). Key contains no PII or financial values.

| Change | Effect |
|--------|--------|
| Same tuple + ready row | Return existing (`reused: true`) |
| Different sections | New key → new generation |
| Different meeting date | New key |
| Different source publication version | New key |
| Renderer schema bump | New key |

### Retry against `failed`

1. Same idempotency key matches a `failed` row.
2. Service resets `generation_status` to `pending`, clears `generation_error_code`.
3. Re-enters `generating` on the **same row and version** (no duplicate version).
4. If storage upload succeeded but DB finalize failed previously, operator must remediate orphan object (see operations doc) before retry may succeed.

### Concurrency

- Unique index on `generation_idempotency_key` prevents duplicate generations.
- Concurrent inserts: losing race fetches existing row by key.
- `pending`/`generating` row with same key → `BINDER_GENERATION_CONFLICT`.

---

## Version allocation

Within `binder_lineage_id`:

1. `SELECT max(version)` for lineage
2. Insert new row with `version = max + 1`
3. Unique index `(binder_lineage_id, version)` enforces immutability

New client binders continue the latest client lineage when present; otherwise a new lineage UUID is allocated.

---

## Failure semantics

| Stage | `generation_status` | `generation_error_code` |
|-------|---------------------|-------------------------|
| Render error | `failed` | `BINDER_RENDER_FAILED` |
| PDF > 25 MiB | `failed` | `BINDER_TOO_LARGE` |
| Storage upload | `failed` | `BINDER_STORAGE_FAILED` |
| DB finalize after upload | `failed` + orphan audit | `BINDER_STORAGE_FAILED` |

Raw exception text is never persisted or returned.

---

## APIs (Checkpoint 2)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `…/binder-export` | Generate or reuse |
| GET | `…/binder-exports` | List (newest first, bounded) |
| GET | `…/binder-exports/[id]/signed-url` | Short-lived download |

All responses: `Cache-Control: private, no-store`. No storage paths, hashes, or PDF bytes in JSON.
