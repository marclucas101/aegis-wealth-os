# Phase 9F.3 Generation Operations

## Storage

| Property | Value |
|----------|-------|
| Bucket | `binder-exports` (private) |
| Path | `clients/{clientId}/binders/{binderExportId}/v{version}/meeting-pack.pdf` |
| Upload | Service-role, `upsert: false` |
| Max size | 25 MiB (pre-upload check + bucket limit) |
| Integrity | SHA-256 `content_hash` on finalize |

---

## Orphan risk handling

**Scenario:** Storage upload succeeds; atomic DB update to `generation_status = ready` fails.

**System behaviour:**

1. Audit `binder_storage_orphan_risk` with binder ID, lineage, version (no path/URL).
2. Set `generation_status = failed`, `generation_error_code = BINDER_STORAGE_FAILED`.
3. API returns generic `BINDER_STORAGE_FAILED`.
4. Storage object is **not** auto-deleted.

**Operator remediation:**

1. Locate object at canonical path for `{clientId}`, `{binderExportId}`, `v{version}`.
2. Verify no `ready` row references the path.
3. Delete orphaned object via service-role storage console or scripted removal.
4. Adviser retries generation (failed-row retry path reuses same row).

---

## Signed download

- Route: `GET …/binder-exports/[binderExportId]/signed-url`
- Expiry: 120 seconds (`SIGNED_URL_EXPIRY_SECONDS`)
- Requires: assignment, same client, `generation_status = ready`
- Audit: `binder_downloaded` (no URL, path, client name, or financial data in metadata)

---

## Feature flags

| Flag | Checkpoint 2 |
|------|----------------|
| `binder_export` | Required for generate/list/download |
| `binder_client_publication` | **Not used** (Checkpoint 3) |

---

## What was not performed (Checkpoint 2)

- No `supabase db push` to remote
- No remote bucket creation outside migration file
- No deployment or feature activation beyond code
- No client vault publication or client binder access

---

## Monitoring checklist

- Spike in `binder_generation_failed` audit events
- `binder_storage_orphan_risk` — investigate immediately
- `BINDER_GENERATION_CONFLICT` rate — concurrent duplicate requests
- Storage bucket size growth under `clients/*/binders/`
