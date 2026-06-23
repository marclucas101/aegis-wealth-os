# Phase 9F.3 Transaction Consistency Audit

## Scope

Publication workflow: document linkage → supersession → binder publish → client visibility → lifecycle notification → audit.

## Failure-point matrix

| Step | Failure | Mitigation | Residual risk |
|------|---------|------------|---------------|
| 1. Insert `documents` row | DB error | Binder stays unpublished; no client access | None |
| 2. Supersede prior binder | DB error | New document archived; `PUBLICATION_CONFLICT` | None — old version remains current |
| 3. Archive prior document | DB error | Same as step 2 rollback | None |
| 4. Publish binder row | DB error / unique violation | New document archived; `consistency_risk` audit | None — partial unique index prevents two current |
| 5. Unarchive document | DB error | Binder published but doc hidden; operator remediation | Low — rare; doc still blocked from signed URL via binder guard |
| 6. Lifecycle notification | Delivery error | Publication committed; failure audited | Acceptable by policy |
| 7. Audit write | Error | Operation already committed | Acceptable — audit is best-effort |

## Invariants enforced

| Invariant | Mechanism |
|-----------|-----------|
| No client-visible doc without published binder | Document inserted `is_archived: true`; unarchived only after `dbPublishBinderExport` succeeds |
| No published binder without linked document | CHECK `binder_exports_published_document_link` + publish update sets `published_document_id` atomically per row |
| One current published binder per lineage | Partial unique index `idx_binder_exports_lineage_current_published` |
| Prior not archived while new fails | Supersession runs before new publish; failure archives new doc only |
| No two current same-lineage | Unique index + version ordering check (`binder.version > prior.version`) |
| Mismatched client IDs | All DB ops scoped `.eq("client_id", …)`; `dbLoadBinderExportForClient` |

## RPC decision

**No database RPC added.** Service-layer sequencing plus:

1. Archived document insert until publish commit
2. Compensating archive on failure paths
3. Partial unique index for concurrency
4. List/signed-URL guards (`isBinderDocumentListedForClient`, `assertBinderDocumentClientAccessible`)

A single Postgres transaction via RPC would add deployment complexity without closing gaps the unique index and archived-insert pattern do not already address. Supabase JS client does not participate in a multi-statement transaction across storage; document and binder rows are the authoritative coupling surface.

## Concurrency notes

- Duplicate publish same binder: idempotent reuse on row state
- Concurrent publish different versions: second fails unique index or version ordering
- Publish vs withdraw race: withdraw requires `published_to_client`; publish sets it — last writer wins with index constraint
- Post-commit timeout: idempotent reuse prevents duplicate documents

## Operator remediation

`binder_publication_consistency_risk` audit when publish update fails after document creation. Operator may archive orphan document or complete binder linkage manually after investigation.
