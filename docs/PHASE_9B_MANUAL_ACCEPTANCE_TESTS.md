# Phase 9B — Manual Acceptance Tests

## Prospect navigation

- [ ] Log in as prospect (`relationship_stage` = `prospect` or `fact_find_complete`)
- [ ] Confirm nav shows: Home, Complete My Information, My Snapshot, Prepare for My Meeting, My Adviser, Documents
- [ ] Confirm Shield, Stress, Roadmap, Blueprint, Annual Review are **not** in nav
- [ ] Deep-link to `/shield-diagnostic` — API returns fallback, not raw data

## Prospect home (`/prospect`)

- [ ] Personalised welcome with first name
- [ ] Assigned adviser name shown when linked
- [ ] Journey status chip (Getting started / Profile in progress / etc.)
- [ ] Primary CTA matches journey state
- [ ] No raw financial scores displayed

## Information collection (`/discover`)

- [ ] Form starts empty (no demo Marcus Tan data)
- [ ] Five section progress cards visible
- [ ] Auto-save after editing (network tab shows `/api/discover/save`)
- [ ] Manual "Save progress" works
- [ ] Exit and return — data preserved
- [ ] Review screen shows privacy acknowledgement
- [ ] Submit redirects to `/discover/submitted`

## Submission

- [ ] `clients.relationship_stage` becomes `fact_find_complete` (DB check)
- [ ] Repeated submit does not create duplicate adviser tasks
- [ ] Assigned adviser sees review task in Advisor OS
- [ ] Legacy `clients.status` does **not** auto-change to `active` on save

## My Snapshot (`/dashboard`)

- [ ] Before publication: fallback message, no scores
- [ ] After adviser publishes snapshot: readiness band and safe fields only

## Meeting preparation (`/meeting-preparation`)

- [ ] Appointment details when booked
- [ ] Educational questions (no product prompts)
- [ ] Link to update profile and book appointment

## My Adviser

- [ ] Platform vs adviser distinction shown
- [ ] Photo, firm, contact options
- [ ] Preparation checklist and booking

## Documents

- [ ] Prospect can upload identity/insurance documents
- [ ] Prospect cannot see adviser-internal uploads (without `client_visible` tag)

## Active client regression

- [ ] Active client retains full portal navigation
- [ ] Adviser retains full dashboard and publication workflow

## Analytics (audit log)

- [ ] `prospect_profile_submitted` event recorded without raw financial answers
- [ ] `prospect_onboarding_started` on first Prospect Home load
- [ ] `prospect_appointment_booked` on successful booking

## Post-auth routing (hardening)

- [ ] New prospect login lands on `/prospect` (not `/dashboard`)
- [ ] Active client login lands on `/dashboard`
- [ ] Adviser login lands on `/advisor`; admin on `/admin`
- [ ] `?next=https://evil.com` rejected — lands on role default
- [ ] `?next=/shield-diagnostic` for prospect rejected or redirected safely
- [ ] Expired session on `/auth/continue` → `/login` without loop

## Invitation deep-links

- [ ] Invite with destination `/discover` lands on Discover after auth
- [ ] Invalid destination falls back to `/prospect`
- [ ] Repeat invite acceptance is idempotent (no `active_client` promotion)

## Appointment stage

- [ ] Client books appointment → `meeting_scheduled` in DB
- [ ] Adviser creates appointment for prospect → `meeting_scheduled`
- [ ] Client at `recommendation_prepared` booking does not regress stage
- [ ] Cancelling appointment does not auto-regress stage

## Local data privacy

- [ ] Production: no full financial answers in `localStorage` (verify in prod build)
- [ ] Submit clears local draft; logout clears local draft
- [ ] Switching accounts on shared device does not show prior user's draft

## Document hardening

- [ ] Direct signed-URL request for internal document returns 404
- [ ] Document removed from visibility after list load cannot be downloaded

## Submission idempotency

- [ ] Double-click submit creates one adviser review task
- [ ] Refresh on submit confirmation does not duplicate task

## UX review (document unresolved issues)

- [ ] Desktop: one primary CTA per prospect page
- [ ] Mobile: bottom nav usable on all prospect routes
- [ ] Validation errors preserve entered values
- [ ] Back button does not corrupt wizard step
- [ ] Loading states use plain language (no internal module names)
