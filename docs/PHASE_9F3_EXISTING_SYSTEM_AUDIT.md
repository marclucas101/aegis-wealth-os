# Phase 9F.3 Existing System Audit

**Date:** 2026-06-23  
**Scope:** Read-only inventory of binder export, document vault, storage, and lifecycle integration prior to PDF generation implementation.

---

## Executive summary

Phase 9E delivered a **binder export manifest** (database record with section list, approved publication IDs, and a placeholder `storage_path`) but explicitly deferred PDF rendering and client vault publication. Phase 9F.3 completes that deferred work. The codebase already has strong foundations — feature gates, assignment checks, audit logging, private `client-documents` storage, signed URL issuance, and Phase 9F.2 lifecycle notifications — but **no PDF bytes are written** and **no publish-to-vault workflow** exists.

---

## Binder export (current)

| Item | Location | State |
|------|----------|-------|
| Table | `binder_exports` (`202606200006`) | Manifest rows only |
| Service | `lib/communications/binderExport.ts` | Creates DB row; no PDF render |
| Persistence | `lib/supabase/binderExportPersistence.ts` | `status: generated`, `version: 1`, placeholder path |
| API | `POST /api/advisor/clients/[clientId]/binder-export` | Adviser-assigned; `binder_export` feature gate |
| Sections | `BINDER_SECTIONS` (10 selectable sections) | Validated server-side |
| Publications | `isCurrentPublishedOutput()` filter | Only current published outputs linked |
| Audit | `binder_generated` | Metadata: sections, publication count |
| PDF libs | `jspdf`, `html2canvas` in `package.json` | **Not used** in binder path (9E hardening test enforces) |

### What creates manifest only vs actual PDF bytes

| Component | Output |
|-----------|--------|
| `generateBinderExport()` (`lib/communications/binderExport.ts`) | **Manifest only** — DB row + placeholder `storage_path`; no upload |
| `POST /api/advisor/clients/[clientId]/binder-export` | Invokes manifest generator only |
| `generateProtectionReportPdf.ts` | **Actual PDF bytes** — protection report only (not binder) |
| Binder PDF renderer (9F.3 checkpoint 2+) | **Not implemented** — planned server `jspdf` |

---

1. `storage_path` placeholder uses non-canonical prefix `binders/{clientId}/…` — no file uploaded.
2. No `generation_status`, idempotency key, content hash, or file metadata columns.
3. No adviser download signed-URL route for binder PDF.
4. No publish/withdraw workflow; `published_to_client` never set by application code.
5. No link from `binder_exports` to `documents` for client vault visibility.

---

## Document vault (current)

| Item | Location | State |
|------|----------|-------|
| Table | `documents` (`202606100008`) | Metadata + `storage_bucket` / `storage_path` |
| Bucket | `client-documents` (`202606100010`) | Private (`public = false`) |
| Path convention | `clients/{clientId}/documents/{timestamp}-{file}` | `buildDocumentStoragePath()` |
| Upload | `uploadClientDocument()` | Service-role upload; client/adviser APIs |
| Signed URL | `createDocumentSignedUrl()` | 120s expiry; `canClientViewDocument()` gate |
| Lifecycle | Phase 9F.2 `downloaded` event | Audit-only on client download |
| Visibility | `canClientViewDocument()` | Prospects need `client_visible` tag or own upload |

### Gaps

1. No `binder_published` document tag or source feature constant for published binders.
2. No server path for adviser-published binder appearing in client vault list.
3. `documents.storage_path` UNIQUE constraint — published binder must use distinct path per version.

---

## Storage architecture (current)

| Bucket | Public | Authenticated policies | Access pattern |
|--------|--------|------------------------|----------------|
| `client-documents` | No | SELECT/INSERT/UPDATE for client owner; DELETE adviser/admin | Direct storage RLS + API signed URLs |
| `adviser-photos` | No | Adviser-scoped SELECT/INSERT/UPDATE/DELETE | Signed URLs |
| `promotion-assets` | No | None (service-role) | Signed URLs |
| **binder PDFs** | — | **Does not exist** | — |

`client_id_from_storage_path()` parses first path segment as UUID — works for `{client_id}/…` in `client-documents` but not for legacy placeholder `binders/{clientId}/…`.

---

## Feature controls (current)

| Key | Default (9E seed) | Purpose |
|-----|-------------------|---------|
| `binder_export` | `enabled: true` | Manifest generation (extend to PDF in 9F.3) |
| `binder_client_publication` | `enabled: false` | Publish to client vault — **must stay off** until operator enables |
| `document_event_notifications` | `enabled: true` | Lifecycle notifications (9F.2) |

No new feature control seeded in 9F.3 migration — `binder_export` scope expands in application layer only.

---

## Security and RLS (current)

| Table | RLS | Client policies | Write path |
|-------|-----|-----------------|------------|
| `binder_exports` | Enabled | None | Service-role API only |
| `documents` | Enabled | Limited (see `202606100009`) | Service-role + authenticated upload policies |

Clients cannot enumerate `binder_exports`. Client binder access must flow through `documents` row created on explicit publication.

---

## Lifecycle integration (current)

Phase 9F.2 provides `emitLifecycleNotificationSafe` for six document/publication events. Relevant hooks for 9F.3 (not yet wired):

| Event | Planned trigger |
|-------|-----------------|
| Publish to vault | New in-app notification when binder published |
| Withdraw | `withdrawn` when adviser withdraws published binder |
| Supersede | Prior published binder withdrawn when new version published |
| Download | Reuse existing `downloaded` audit-only via `createDocumentSignedUrl` |

---

## A4 report and PDF library boundaries

| Library / module | Used for binder? | Server-safe? |
|------------------|------------------|--------------|
| `jspdf` | Planned (checkpoint 2+) | Yes — server PDF assembly |
| `html2canvas` | No | No — requires browser DOM |
| `lib/reports/a4Print.ts` | No (protection report) | Helpers only |
| `generateProtectionReportPdf.ts` | No | Yes — produces PDF bytes for protection report |
| `app/report-a4-print.css` | No | Browser print only |

Existing A4 components **cannot be reused wholesale** for server-side binder rendering because binder sections assemble from published outputs programmatically, not from a print DOM snapshot.

---

## Dependencies

| Dependency | Version | Required for |
|------------|---------|--------------|
| `binder_exports` table | `202606200006` | Manifest + PDF metadata |
| `documents` table | `202606100008` | Client vault publication linkage |
| `platform_feature_controls` | `202606200006` | Feature gates |
| Phase 9F.2 lifecycle columns | `202606200009` | Notification idempotency |
| `jspdf` | `package.json` | Server-side PDF render (checkpoint 2+) |

---

## Path convention mismatch (action item)

| Source | Path pattern | Issue |
|--------|--------------|-------|
| Current `generateBinderExport()` | `binders/{clientId}/{timestamp}.pdf` | No upload; wrong prefix for `client_id_from_storage_path` |
| `documentPersistence` vault | `clients/{clientId}/documents/…` | Canonical for client-documents |
| **9F.3 decision** | `clients/{clientId}/binders/{binderId}/v{version}/meeting-pack.pdf` | Dedicated `binder-exports` bucket; service-role only |

---

## Deferred from Phase 9E (confirmed in scope for 9F.3)

From `docs/PHASE_9E_BINDER_EXPORT_POLICY.md` and `docs/PHASE_9E_SECURITY_AND_PRIVACY_REVIEW.md`:

- Full PDF binder rendering
- Client vault publication workflow
- Immutable versioned artefacts
- Client download authorization

---

## Out of scope (this phase boundary)

- Phase 9F.4 compliance-role / Promotions retirement
- Email delivery of binder attachments
- Automatic publish on generate
- Storage object deletion / retention GC
- Background job queue for PDF generation

---

## Verdict

The system is **ready for schema and architecture checkpoint** work. Implementation checkpoint 2+ should build on:

1. Dedicated private `binder-exports` bucket (no authenticated storage policies).
2. Extended `binder_exports` columns for generation state, idempotency, and publication linkage.
3. Publication creates `documents` row pointing at immutable PDF in `binder-exports` bucket.
4. Client access exclusively via API signed URLs and `canClientViewDocument` with `binder_published` tag.
