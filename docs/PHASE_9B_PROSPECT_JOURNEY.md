# Phase 9B — Prospect Journey

## Required journey (implemented)

1. **Account invitation and login** — existing Supabase invite + `/signup` / `/login`
2. **Welcome and process explanation** — `/prospect` home with adviser-led messaging
3. **Progressive information collection** — `/discover` in five macro-sections
4. **Save and resume** — auto-save to server; non-sensitive local metadata only in production (see privacy review)
5. **Submission confirmation** — `/discover/submitted` after `/api/discover/submit`
6. **Safe Financial Readiness Snapshot** — `/dashboard` (My Snapshot) via Phase 9A envelope
7. **Meeting preparation** — `/meeting-preparation`
8. **Appointment booking** — `/my-adviser` booking panel
9. **Adviser review status** — shown on `/prospect` home
10. **Adviser-approved published snapshot** — published `financial_readiness_snapshot` on `/dashboard`

## Prospect navigation (server entitlement filtered)

| Label | Route | Feature key |
|-------|-------|-------------|
| Home | `/prospect` | `financial_readiness_snapshot` |
| Complete My Information | `/discover` | `complete_information` |
| My Snapshot | `/dashboard` | `financial_readiness_snapshot` |
| Prepare for My Meeting | `/meeting-preparation` | `meeting_preparation` |
| My Adviser | `/my-adviser` | `my_adviser` |
| Documents | `/document-vault` | `limited_documents` |

## Relationship stage automations (Phase 9B)

| Event | Server action |
|-------|---------------|
| Profile submit | `relationship_stage` → `fact_find_complete` (only from `prospect`) |
| Appointment booked | `relationship_stage` → `meeting_scheduled` (no regression from later stages) |
| Appointment cancelled | Stage **not** auto-regressed |
| Submit (repeat) | Idempotent — no duplicate stage change |
| Submit | One adviser `review` task via `source_key` |
| Discover save | No auto-promotion to `active` legacy status |

## Primary CTAs by state

Resolved in `lib/compliance/prospectJourney.ts`:

- Getting started → Start your financial profile
- Profile in progress → Continue your profile
- Near complete → Review missing information
- Submitted → Book your review
- Meeting scheduled → Prepare for your meeting
- Published snapshot → View your adviser-reviewed snapshot

## Status language

- Getting started
- Profile in progress
- Submitted for adviser review
- Meeting scheduled
- Adviser review completed

## Post-authentication routing

1. Login/signup/callback → `/auth/continue`
2. Server reads session + `relationship_stage` (never browser role/stage)
3. Prospect stages (`prospect`, `fact_find_complete`, `adviser_review`, `meeting_scheduled`, `recommendation_prepared`) → default `/prospect`
4. Optional safe `next` param if allowlisted (`PROSPECT_ENTITLED_PATHS` or adviser/admin homes)
5. Active client → `/dashboard`; adviser → `/advisor`; admin → `/admin`

## Invitation flow

1. Adviser/admin invites prospect via `inviteClientByEmail`
2. Supabase `redirectTo` → `/auth/callback?next=<allowlisted destination>`
3. Callback exchanges code → `/auth/continue?next=...`
4. Continue resolves final destination server-side
5. Accepting invitation does **not** promote to `active_client`
6. Invalid/expired auth → `/login?error=...` (safe recovery)

Allowlisted invite destinations: `/prospect`, `/discover`, `/meeting-preparation`, `/my-adviser`.

## Deferred to later phases

- Phase 9C: Adviser Meeting Studio
- Phase 9D: Converted-Client Portal refinements
- Phase 9E: Document notification and governance redesign
- Phase 9F: Controlled Beta
