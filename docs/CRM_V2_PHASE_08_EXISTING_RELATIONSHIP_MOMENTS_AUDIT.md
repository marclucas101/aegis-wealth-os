# CRM V2 Phase 08 — Existing Relationship Moments Audit

**Purpose:** Classify every pre-Phase-08 source related to birthdays, reviews, cultural preferences, and adviser reminders before introducing canonical `relationship_moments` and related CRM V2 authorities.  
**Rule:** One authoritative record per domain; projections, queues, and timeline entries are never SOT.

---

## Classification legend

| Label | Meaning |
|-------|---------|
| **Authoritative** | Existing SOT — mutations stay here |
| **Reuse** | Read or link without copying payload into a duplicate table |
| **Projection** | Assembled read model only |
| **New** | Greenfield canonical table introduced Phase 08 |
| **Deferred** | Out of Phase 08 scope |
| **Rejected** | Duplicate authority — must not create |

---

## 1. `clients.date_of_birth`

| Item | Detail |
|------|--------|
| Column | `clients.date_of_birth` (nullable DATE) |
| APIs | `GET/PATCH /api/advisor/clients/[clientId]/personal` — adviser updates DOB |
| Code | `app/api/advisor/clients/[clientId]/personal/route.ts`, Relationship 360 read model |
| Classification | **Authoritative** (client identity / personal profile) |
| Phase 08 decision | **Reuse** — DOB remains the single source for birthday facts. Phase 08 may **project** a `relationship_moments` row with `source_type = client_profile_dob` and `moment_type = birthday` when adviser workspace loads, but must not create a parallel DOB column or duplicate birthday table. Client preference updates for DOB corrections flow through `crm_client_preference_updates` pending adviser review, not direct client writes to `clients` without review. |

**Non-goals confirmed:**

- No automatic birthday outreach from DOB alone
- No migration of DOB into moment-only storage
- Legacy personal profile APIs remain operational with CRM V2 flags on/off

---

## 2. `advisor_tasks` — birthday reminders

| Item | Detail |
|------|--------|
| Table | `advisor_tasks` |
| Task type | `client_birthday` (among general, review, follow_up, document, roadmap, risk) |
| APIs | `GET/POST /api/advisor/tasks`, client-scoped task routes |
| Code | `lib/supabase/advisorTasksPersistence.ts`, work-queue `advisorTaskAdapter` |
| Classification | **Authoritative** (legacy adviser tasks) |
| Phase 08 decision | **Reuse / coexist** — `advisor_tasks` birthday reminders remain authoritative. Phase 08 `relationship_moments` provides structured CRM V2 moment records with acknowledgement, festive linkage, and Relationship 360 integration. **Do not** bulk-migrate `client_birthday` tasks into `relationship_moments`. Advisers may see both surfaces during transition; work-queue `advisorTaskAdapter` is unchanged. New birthday tracking in CRM V2 uses `relationship_moments` when adviser explicitly creates or confirms a moment. |

---

## 3. `clients.last_review_at` and `clients.next_review_due`

| Item | Detail |
|------|--------|
| Columns | `clients.last_review_at`, `clients.next_review_due` (nullable TIMESTAMPTZ/DATE) |
| APIs | Review pipeline, Relationship 360 overview, Service workspace Reviews view |
| Code | `lib/supabase/advisorReviewPipeline.ts`, `lib/crm-v2/relationships/readModel.ts` (`isReviewDue`) |
| Classification | **Authoritative** (client-level review scheduling fields) |
| Phase 08 decision | **Reuse** — `clients.next_review_due` remains the platform authority for "when is this client's next review due". Phase 08 introduces `crm_review_rhythm` as a **CRM V2 projection** that extends and surfaces cadence metadata; initial `annual_review` row seeds `next_due_date` from `clients.next_review_due` and `last_completed_date` from `clients.last_review_at`. Updates to review rhythm in the moments workspace write to `crm_review_rhythm`; operator may later wire bi-directional sync to `clients.next_review_due` — Phase 08 does **not** replace client columns. |

---

## 4. `annual_reviews`

| Item | Detail |
|------|--------|
| Table | `annual_reviews` — yearly review snapshots (`client_id`, `review_year`, scores, generated content) |
| APIs | `/api/advisor/clients/[clientId]/reports/annual-reviews/**`, `/api/annual-review/current` |
| Migration | `supabase/migrations/202606100007_roadmap_and_reviews.sql` |
| Classification | **Authoritative** (published yearly review artefacts) |
| Phase 08 decision | **Reuse / no merge** — `annual_reviews` stores completed review **outputs**, not operational cadence. `crm_review_rhythm` tracks scheduling and overdue state; it does **not** duplicate `annual_reviews` rows or replace review generation workflows. Relationship 360 continues to surface `last_review_at` / `next_review_due` from `clients`; moments workspace adds structured rhythm view. |

---

## 5. `clients.ethnicity` (new column — Phase 08)

| Item | Detail |
|------|--------|
| Column | `clients.ethnicity` nullable TEXT with CHECK constraint |
| Allowed values | `chinese`, `malay`, `indian`, `eurasian`, `mixed`, `other`, `prefer_not_to_say` |
| Migration | `202606290013_phase08_crm_v2_relationship_moments_core.sql` |
| Classification | **New** (optional profile extension on existing `clients` table) |
| Phase 08 decision | **Festive suggestions only** — ethnicity may inform optional `festive_holiday_mappings` suggestions in adviser moments workspace. Prohibited: advice, ranking, queue priority, automated outreach. See `docs/CRM_V2_PHASE_08_SENSITIVITY_AND_ETHNICITY_RULES.md`. Client may submit `ethnicity_correction` via `crm_client_preference_updates`. |

---

## 6. `relationship_moments` (new table — Phase 08)

| Item | Detail |
|------|--------|
| Table | `relationship_moments` |
| Authority | Canonical CRM V2 record for adviser-managed relationship moments |
| Types | `birthday`, `wedding_anniversary`, `child_birthday`, `policy_anniversary`, `review_anniversary`, `festive_greeting`, `client_preference`, `life_event_follow_up`, `custom_adviser_reminder` |
| Classification | **New** |
| Phase 08 decision | **SOT NEW** for structured moment lifecycle (confirmation, acknowledgement, deactivation, links to appointments/commitments). Does not replace `clients.date_of_birth`, `advisor_tasks`, or `annual_reviews`. |

Supporting tables: `adviser_moment_overrides`, `festive_holiday_mappings`, `relationship_moment_events`, `crm_review_rhythm`, `crm_client_preference_updates`.

---

## 7. Tags and notes placeholders

| Item | Detail |
|------|--------|
| Prior state | Relationship 360 Profile tab showed Phase 08/09 placeholders; no `client_tags` or `relationship_notes` table |
| UI | `lib/crm-v2/relationships/readModel.ts` — profile section includes moments summary link; tags/notes remain **deferred** |
| Classification | **Deferred** |
| Phase 08 decision | **No new tags/notes tables** — moments workspace `data_quality` view surfaces missing birthday and pending preference warnings instead. Future advocacy (Phase 09) or communications (Phase 10) may introduce governed note patterns; Phase 08 does not invent unstructured adviser note storage. Document vault tags (`documents.tags`) remain document-domain only. |

---

## 8. Work queue adapters (existing + Phase 08)

| Adapter | Source | Phase | Classification |
|---------|--------|-------|----------------|
| `advisorTaskAdapter` | `advisor_tasks` | 10.2 | **Reuse** — unchanged; includes `client_birthday` tasks |
| `serviceCommitmentAdapter` | `service_commitments` | 06 | **Reuse** |
| `protectionExtractionAdapter` | `protection_extractions` | 07 | **Reuse** |
| `relationshipMomentAdapter` | `relationship_moments` | **08** | **Projection** — read-only |
| `crmReviewRhythmAdapter` | `crm_review_rhythm` | **08** | **Projection** — read-only |
| `clientPreferenceUpdateAdapter` | `crm_client_preference_updates` | **08** | **Projection** — read-only |

Phase 08 adapters registered in `lib/work-queue/adapters/index.ts`, `sourceRegistry.ts`, `batchData.ts`, `loadWorkQueueBatchData.ts`. Queue items deep-link to `/advisor-v2/relationships/[id]/moments` with view query params. **No ethnicity in metadata; priority fixed `normal`.**

---

## 9. Rejected duplications

| Proposed duplicate | Reason rejected |
|--------------------|-----------------|
| `client_birthdays` table | `clients.date_of_birth` + `relationship_moments` sufficient |
| `review_schedule` table replacing `clients.next_review_due` | Client columns remain authority |
| `annual_review_cadence` mirroring `annual_reviews` | Output table ≠ scheduling projection |
| `ethnicity_segments` for marketing | Prohibited by blueprint hard restrictions |
| `advisor_work_items` persistence | Virtual queue per Phase 10.2 |
| Auto-send festive communications | Requires adviser confirmation; no auto-send |

---

## 10. Compatibility matrix

| Legacy surface | Phase 08 impact |
|----------------|-----------------|
| `/advisor/clients/[id]` personal tab | Unchanged; DOB edit path retained |
| `/advisor/tasks` birthday tasks | Coexist with CRM V2 moments |
| Service workspace Reviews | Still projects `clients.next_review_due` pipeline |
| Annual review generator | Unchanged |
| Google Calendar sync | Unchanged; aggregate moment reminders deferred to blueprint guidance |
| Protection portfolio | Unchanged |
| Phase 9F.4 observation | Unchanged |

---

## 11. Operator sign-off checklist (audit)

- [ ] Confirmed DOB authority remains `clients.date_of_birth`
- [ ] Confirmed `advisor_tasks.client_birthday` not bulk-migrated
- [ ] Confirmed `annual_reviews` not duplicated by `crm_review_rhythm`
- [ ] Confirmed ethnicity CHECK constraint matches TypeScript allowlist
- [ ] Confirmed no tags/notes tables introduced
- [ ] Confirmed three new work-queue adapters are read-only projections
