# Phase 9F.3 Storage Architecture

## Decision

**Use a dedicated private bucket `binder-exports` with zero authenticated `storage.objects` policies. All reads and writes go through the service-role API layer and short-lived signed URLs.**

Published client-facing binders remain in `binder-exports` (not copied to `client-documents`). A `documents` metadata row links the client vault UI to the immutable PDF object.

---

## Options considered

| Option | Description | Rejected because |
|--------|-------------|------------------|
| **A — Dedicated `binder-exports` bucket** ✅ | Private bucket; service-role only; paths under `clients/{id}/binders/…` | — **Selected** |
| B — Subfolder in `client-documents` | Reuse existing bucket and RLS | Client storage SELECT policy would expose unpublished adviser-internal paths if path convention overlaps; harder to isolate adviser-only artefacts |
| C — Copy on publish to `client-documents` | Generate in `binder-exports`; copy bytes to vault bucket on publish | Duplicate storage; two objects to reconcile on withdraw; unnecessary complexity for MVP |

---

## Rationale

1. **Isolation** — Adviser-internal generated PDFs (unpublished) must not appear in client storage enumeration. `binder_exports` already has RLS with no client policies; matching storage posture is consistent.
2. **No public buckets** — `public = false`; no CDN or anonymous access.
3. **No authenticated storage policies** — Clients cannot call Supabase Storage directly for binder objects even if they guess a path. Mirrors `promotion-assets` and pre-9F.3 `binder_exports` table access pattern.
4. **Signed URL mediation** — `createAdminSupabaseClient().storage.createSignedUrl()` works for any private bucket. Existing `issueSignedUrlForDocument()` already uses `document.storage_bucket` dynamically.
5. **Immutability** — Append-only paths per version; no in-place overwrite (`upsert: false`).
6. **Single object on publish** — Publication creates a `documents` row referencing the same storage object; no byte duplication.

---

## Bucket specification

| Property | Value |
|----------|-------|
| `id` / `name` | `binder-exports` |
| `public` | `false` |
| `file_size_limit` | `26214400` (25 MiB) |
| `allowed_mime_types` | `['application/pdf']` |
| Authenticated policies | **None** (intentional) |
| Service-role upload | Generation service (checkpoint 2+) |
| Service-role signed URL | Adviser download + client download APIs |

---

## Path convention

```
clients/{client_id}/binders/{binder_export_id}/v{version}/meeting-pack.pdf
```

| Segment | Purpose |
|---------|---------|
| `clients/{client_id}` | Client scoping; operational clarity; future path parsers |
| `binders/{binder_export_id}` | Binder lineage folder |
| `v{version}` | Immutable version directory |
| `meeting-pack.pdf` | Stable filename (no household name in path) |

**Legacy cleanup:** Pre-9F.3 placeholder paths (`binders/{clientId}/…`) in existing rows are not valid storage objects. New generations use the canonical path above. `generation_status = legacy_manifest` marks pre-9F.3 rows.

---

## Publication linkage

When an adviser publishes a binder to the client vault (checkpoint 2+):

1. Verify `generation_status = ready` and `binder_client_publication` feature enabled.
2. Insert `documents` row:
   - `storage_bucket = 'binder-exports'`
   - `storage_path` = binder immutable path
   - `mime_type = 'application/pdf'`
   - `tags` includes `binder_published` and `client_visible`
   - `source_feature` = `advisor_binder_export` (application constant)
3. Set `binder_exports.published_document_id` and `status = published_to_client`.
4. Withdraw/supersede prior published binder for same client lineage → update status + lifecycle notification.

Client list APIs filter via existing `documents` queries + `canClientViewDocument()`.

---

## Signed URL policy

| Actor | Route (checkpoint 2+) | Expiry |
|-------|----------------------|--------|
| Adviser | `GET …/binder-exports/[id]/signed-url` | 120s (`SIGNED_URL_EXPIRY_SECONDS`) |
| Client | `POST /api/documents/signed-url` or dedicated binder route | 120s |

No signed URL returned in list endpoints. Audit: `binder_downloaded` (adviser), `document_downloaded` + lifecycle `downloaded` audit-only (client).

---

## Threat model summary

| Threat | Mitigation |
|--------|------------|
| Public bucket exposure | `public = false`; diagnostic verifies |
| Direct storage enumeration | No authenticated policies on `binder-exports` |
| Cross-client access | API assignment / ownership checks before signed URL |
| Path guessing | UUID path segments; short-lived URLs |
| Unpublished binder leak | No `documents` row until explicit publish |
| MIME confusion | Bucket allowlist PDF only |

---

## Migration objects (storage)

Defined in `202606200010_phase9f3_binder_pdf_client_vault.sql`:

- `INSERT INTO storage.buckets … ON CONFLICT DO UPDATE` for `binder-exports`
- **No** `CREATE POLICY` on `storage.objects`

Diagnostic checks: `bucket.public = false`, MIME allowlist, `zero_authenticated_policies`.

---

## Operator note

Migration SQL creates bucket metadata only. **No remote `db push` or bucket creation on linked project during implementation checkpoint 1.** Operator applies migration in staging before enabling `binder_client_publication`.
