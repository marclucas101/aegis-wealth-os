# CRM V2 Phase 05 — Sync and Reconciliation

## Sync lifecycle

- `not_connected`
- `not_synced`
- `sync_pending`
- `synced`
- `update_required`
- `sync_failed`
- `reauthorization_required`

## Create/update/cancel behavior

- Eligible lifecycle states create/update external event.
- Cancel/no-show states call provider cancel and retain mapping history.
- Repeated sync and repeated retry remain idempotent via mapping keys.

## Reconciliation rules

- Phase 05 is one-way authority from AEGIS to Google.
- External provider edits do not overwrite AEGIS lifecycle or schedule.
- Missing provider event is recorded as drift/failure for adviser remediation.
- Connection revocation moves mapping status to action-required.
