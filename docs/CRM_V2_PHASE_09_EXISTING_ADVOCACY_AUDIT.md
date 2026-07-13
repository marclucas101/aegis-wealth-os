# CRM V2 Phase 09 — Existing Advocacy Audit

**Purpose:** Classify every pre-Phase-09 source related to referrals, introductions, testimonials, feedback, promotions, tasks, notes, timeline, service requests, relationship moments, and advocacy scoring before introducing canonical `advocacy_events` and related CRM V2 authorities.  
**Rule:** One authoritative record per domain; projections, queues, and timeline entries are never SOT.

---

## Classification legend

| Label | Meaning |
|-------|---------|
| **Authoritative** | Existing SOT — mutations stay here unless explicitly superseded for a narrow field |
| **Reuse** | Read or link without copying payload into a duplicate table |
| **Projection** | Assembled read model only |
| **New** | Greenfield canonical table introduced Phase 09 |
| **Deferred** | Out of Phase 09 scope |
| **Rejected** | Duplicate authority — must not create |

---

## 1. Referrals

| Item | Detail |
|------|--------|
| Storage | No dedicated `referrals` table in platform schema |
| Legacy surfaces | Informal adviser notes, CRM spreadsheets, verbal tracking outside AEGIS |
| Classification | **Deferred** (no legacy SOT to migrate) |
| Phase 09 decision | **New** — `advocacy_events` with `event_type` in (`referral_received`, `referral_contacted`, `referral_declined`) becomes the CRM V2 operational authority for referral lifecycle tracking. `referred_person_label` and `has_contact_details` are safe adviser fields only — no PII bulk import. No automatic lead creation or sales pipeline integration. |

---

## 2. Introductions

| Item | Detail |
|------|--------|
| Storage | No dedicated introductions table |
| Classification | **Deferred** (pre-Phase-09) |
| Phase 09 decision | **New** — `advocacy_events` with `introduction_offered`, `introduction_made`. Blocked when client `do_not_ask` preference is true. Not linked to Promotions or governed-content campaigns. |

---

## 3. Testimonials (`adviser_feedback`)

| Item | Detail |
|------|--------|
| Table | `adviser_feedback` — ratings, text, `permission_to_use_as_testimonial`, `status` (`submitted`, `reviewed`, `approved_testimonial`, `archived`) |
| APIs | `POST /api/adviser-feedback`, adviser review routes, `GET /api/my-adviser` (approved testimonials) |
| Code | `lib/supabase/adviserFeedbackPersistence.ts`, `src/lib/myAdviser/testimonialMapping.ts` |
| Classification | **Authoritative** (client-submitted feedback and published testimonial artefacts) |
| Phase 09 decision | **Reuse / coexist** — `adviser_feedback` remains SOT for structured client feedback submission and adviser-approved public testimonials. Phase 09 `advocacy_events` may reference via `source_type = adviser_feedback` and `source_id` but does **not** duplicate feedback rows or replace approval workflow. CRM V2 testimonial consent is tracked in `crm_client_advocacy_preferences.testimonial_consent` and event-level `consent_state`. |

---

## 4. Adviser feedback (general)

| Item | Detail |
|------|--------|
| Same as §3 | Ratings and narrative feedback |
| Classification | **Authoritative** |
| Phase 09 decision | **Reuse** — optional projection to `advocacy_events` with `client_feedback_received` when adviser records CRM engagement; feedback table unchanged. |

---

## 5. Promotions (`promotions`)

| Item | Detail |
|------|--------|
| Table | `promotions` — legacy marketing content (schema retained) |
| APIs | Retired adviser routes redirect; `legacy_promotions_write` remains **false** |
| Observation | **Phase 9F.4** — 30-day (operator-extended) observation per `docs/PHASE_9F4_OBSERVATION_PLAN.md` |
| Classification | **Authoritative** (historical rows only) / **Rejected** for new CRM advocacy workflows |
| Phase 09 decision | **Rejected for advocacy** — Phase 09 introduces **no** Promotions Stage 6 schema retirement, **no** campaign automation, **no** sales-opportunity tables, **no** adviser sales ranking or leaderboards. Advocacy thank-yous and referral follow-ups are adviser-recorded events, not promotion sends. Governed communications (`governed_content`) remains SOT for published client content (Phase 10). |

**Phase 9F.4 confirmation:**

- Promotions observation continues unchanged during Phase 09 implementation
- No Stage 6 DROP migrations in Phase 09 deliverables
- No re-enable of `legacy_promotions_write`
- CRM advocacy does not write to `promotions`

---

## 6. `advisor_tasks`

| Item | Detail |
|------|--------|
| Table | `advisor_tasks` — types include `follow_up`, `review`, `general`, etc. |
| Classification | **Authoritative** (legacy adviser tasks) |
| Phase 09 decision | **Reuse / coexist** — general follow-up tasks remain on `advisor_tasks`. Advocacy-specific follow-ups with consent context use `advocacy_events.follow_up_status` and work-queue `advocacyEventAdapter`. No bulk migration of tasks into advocacy events. |

---

## 7. Tags and notes

| Item | Detail |
|------|--------|
| Storage | No CRM-wide unstructured adviser notes table; `documents.tags` is document-domain only |
| Phase 08 decision | Deferred — moments `data_quality` warnings only |
| Classification | **Deferred** |
| Phase 09 decision | **Deferred** — `advocacy_events.notes` is bounded (2000 chars) event-scoped adviser note, not a general notes system. No new tags table. |

---

## 8. Timeline (engagement projection)

| Item | Detail |
|------|--------|
| Assembly | `lib/crm-v2/relationships/timelineProjection.ts` — multi-source virtual projection |
| Classification | **Projection** |
| Phase 09 decision | **Projection** — future timeline entries may surface safe advocacy domain events (`advocacy_domain_events`) without storing duplicate timeline rows. Phase 09 primary read surface is advocacy workspace + Relationship 360 engagement link via `advocacyProjection.ts`. |

---

## 9. Service requests (`client_service_requests`)

| Item | Detail |
|------|--------|
| Table | `client_service_requests` — Phase 06 canonical client-initiated asks |
| Classification | **Authoritative** |
| Phase 09 decision | **Reuse** — `advocacy_events.linked_service_request_id` FK for contextual linkage only. Service request lifecycle unchanged; advocacy does not auto-create service requests from referrals. |

---

## 10. Relationship moments (`relationship_moments`)

| Item | Detail |
|------|--------|
| Table | Phase 08 canonical moments |
| Classification | **Authoritative** (moment lifecycle) |
| Phase 09 decision | **Reuse** — `advocacy_events.linked_relationship_moment_id` optional FK. Moments and advocacy remain separate domains; no merge. |

---

## 11. Advocacy score fields

| Item | Detail |
|------|--------|
| Pre-Phase-09 | No `advocacy_score` column on `clients`; no ranking tables |
| Classification | **New** (computed) |
| Phase 09 decision | **New** — `advocacy_score_config` (operator weights/caps), per-event `points` and `score_eligible` on `advocacy_events`, yearly score computed in `lib/crm-v2/advocacy/score.ts`. Score is a **projection** for assigned adviser transparency only — prohibited for queue priority, client list badges, sales ranking, advice, or segmentation (see `restrictions.ts`). |

---

## 12. Client consent preferences (pre-Phase-09)

| Item | Detail |
|------|--------|
| Storage | `adviser_feedback.permission_to_use_as_testimonial`; `clients.feedback_prompt_dismissed_at` |
| Classification | **Authoritative** (feedback-domain consent) |
| Phase 09 decision | **New** for CRM advocacy consent aggregate — `crm_client_advocacy_preferences` is SOT for testimonial consent state, referral ask opt-out, permission to mention, and do-not-ask. Does not delete or overwrite `adviser_feedback` rows. |

---

## Summary matrix

| Source | Classification | Phase 09 treatment |
|--------|----------------|-------------------|
| Referrals (informal) | Deferred | New event types in `advocacy_events` |
| Introductions | Deferred | New event types in `advocacy_events` |
| `adviser_feedback` / testimonials | Authoritative | Reuse; optional `source_id` link |
| Promotions | Observation only (9F.4) | **Rejected** — no Stage 6, no campaigns, no ranking |
| `advisor_tasks` | Authoritative | Coexist; no migration |
| Tags/notes | Deferred | Event-scoped `notes` only |
| Timeline | Projection | Safe domain event projection |
| `client_service_requests` | Authoritative | Optional FK link |
| `relationship_moments` | Authoritative | Optional FK link |
| Yearly advocacy score | New (projection) | Computed; restricted uses |
| `crm_client_advocacy_preferences` | New | Client + adviser consent SOT |

---

## Non-goals confirmed (Phase 09)

- No Promotions Stage 6 schema retirement
- No campaign automation or drip sequences
- No adviser sales leaderboards or client wealth ranking
- No automatic referral-to-lead conversion
- No duplicate testimonial approval workflow
- No advocacy score in client portal or relationship list DTOs
