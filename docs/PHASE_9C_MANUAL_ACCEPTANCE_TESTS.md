# Phase 9C — Manual Acceptance Tests

## Prepare

- [ ] Assigned adviser opens Meeting Studio from client workspace
- [ ] Unassigned adviser receives 403 on meeting APIs
- [ ] Client account receives 403 on `/api/advisor/.../meeting-sessions`
- [ ] Create session with valid appointment linkage
- [ ] Reject session with another adviser's appointment
- [ ] Save draft preparation with section selection
- [ ] Readiness checklist shows missing information

## Present

- [ ] Start meeting enters full-screen presentation
- [ ] Only selected sections appear in presentation
- [ ] Hidden section query param returns 404
- [ ] Previous/Next navigation works on tablet landscape
- [ ] Exit presentation returns to Close stage
- [ ] Section-shown events recorded in audit

## Close

- [ ] Confirm fact (no recalculation flag for insurance summary)
- [ ] Correct fact updates discover profile and flags refresh
- [ ] Select scenarios before complete
- [ ] Record verbal acknowledgement
- [ ] Complete meeting is idempotent
- [ ] Relationship stage advances to `adviser_review` when appropriate
- [ ] Later stages not regressed
- [ ] Summary prepared as `draft` adviser-only

## Feature controls (admin)

- [ ] Disable `adviser_meeting_studio` — APIs return 503
- [ ] Disable `meeting_presentation_mode` — presentation blocked; dashboard still works
- [ ] `meeting_exact_amount_presentations` default off
- [ ] Disable `meeting_client_acknowledgements` — acknowledgement API fails closed

## Regression

- [ ] Phase 8C dashboard, shield, stress views unchanged
- [ ] Prospect meeting preparation unchanged
- [ ] Appointment booking unchanged
- [ ] Phase 9A publication workflow unchanged

## Hardening (acceptance review)

- [ ] Completed session PATCH returns 400
- [ ] Presentation API returns `Cache-Control: private, no-store`
- [ ] Cancelled appointment rejected for session linkage
- [ ] Concurrent start/complete does not duplicate events
- [ ] `requires_analysis_refresh` shows stale warning in presentation
- [ ] Unknown acknowledgement item rejected
- [ ] Prohibited fact field (e.g. relationship_stage) rejected
- [ ] Assignment revocation blocks next presentation request
