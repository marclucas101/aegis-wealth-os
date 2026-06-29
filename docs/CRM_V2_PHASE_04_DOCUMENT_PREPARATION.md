# CRM V2 Phase 04 — Document Preparation

## Reuse model

- Reuse existing `document-vault` and secure upload authority.
- No new storage bucket added in Phase 04.
- Appointment detail links clients into existing vault workflow.

## Security constraints

- No raw storage path exposure in appointment APIs or UI.
- No persisted signed URLs in appointment DTOs.
- Upload authority remains authenticated client + relationship validation.
- Existing size/type restrictions and security controls remain authoritative.

## Checklist integration

- Only client/shared checklist visibility is exposed.
- Checklist completion for document tasks updates only after authorized flow.
- Adviser sees safe receipt/completion state via existing appointment support tables.
