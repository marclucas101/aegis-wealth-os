# Phase 9F.3 Final Manual Acceptance Tests

Execute on **staging** after migration apply. Enable features only in controlled test windows.

## 1. Adviser generation

- [ ] Generate meeting pack for assigned client with `binder_export` enabled
- [ ] Verify status becomes `ready` with version 1

## 2. Idempotent retry

- [ ] Repeat identical generation request
- [ ] Confirm same binder row returned (`reused: true`)

## 3. Regeneration

- [ ] Generate again with changed sections
- [ ] Confirm new version in same lineage

## 4. Adviser download

- [ ] Download via signed URL
- [ ] PDF opens; no storage path in API JSON

## 5. Publication

- [ ] Enable `binder_client_publication`
- [ ] Publish with explicit confirm
- [ ] Document appears in client vault

## 6. Client vault visibility

- [ ] Client sees meeting pack in document vault
- [ ] Unpublished binders not visible

## 7. Client signed download

- [ ] Client downloads PDF
- [ ] URL expires; no path in response

## 8. Withdrawal

- [ ] Adviser withdraws with allowlisted reason
- [ ] Client loses download access

## 9. Supersession

- [ ] Publish v2 in same lineage
- [ ] v1 unavailable; v2 current; one `superseded` notification

## 10. Simultaneous publication

- [ ] Two publish clicks on same binder
- [ ] One document; second returns reused

## 11. Feature disabled (`binder_client_publication`)

- [ ] Disable flag
- [ ] New publish blocked
- [ ] Already-published still readable until withdrawn

## 12. Notification disabled (`document_event_notifications`)

- [ ] Disable flag
- [ ] Publication still succeeds
- [ ] No new lifecycle notification

## 13. Stale notification

- [ ] Withdraw binder; open old notification
- [ ] Safe “no longer available” state

## 14. Cross-client access

- [ ] Client A cannot access client B binder/document
- [ ] Unassigned adviser cannot publish

## 15. PDF privacy inspection

- [ ] Open PDF in editor; no NRIC/account/policy markers
- [ ] No internal notes or storage paths

## 16. Storage path privacy

- [ ] Network tab: list/publish responses omit paths and hashes

## 17. Failed upload

- [ ] Simulate storage failure (staging)
- [ ] Binder `failed`; no client access

## 18. Document-link failure

- [ ] Verify rollback leaves binder unpublished if publish update fails

## 19. Orphan-object handling

- [ ] Review `binder_storage_orphan_risk` audit procedure

## 20. Feature-disabled read behavior

- [ ] With `binder_client_publication` off, previously published binder still downloadable until withdrawn
