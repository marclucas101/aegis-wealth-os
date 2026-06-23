# Phase 9F.3 Checkpoint 3 Operations

## Publication failure remediation

| Failure | State | Operator action |
|---------|-------|-----------------|
| Document insert fails | Binder remains ready, unpublished | Retry publish |
| Binder update fails after document insert | Orphan document row (archived by service) | `binder_publication_consistency_risk` audit; verify binder still ready; retry |
| Supersession fails | New document archived; publish aborted | Retry; verify only one current published per lineage |
| Notification fails | Publication committed | Idempotent notification retry via lifecycle key |

## Withdrawal

- Storage object **retained**
- `documents.is_archived = true`
- Binder row `status = withdrawn`

## Feature disable

Disabling `binder_client_publication` blocks new publish/withdraw. Existing published binders remain client-visible until withdrawn.

## Out of scope

- No storage object deletion
- No remote `db push` from implementation checkpoint
- No automatic publication after generation
