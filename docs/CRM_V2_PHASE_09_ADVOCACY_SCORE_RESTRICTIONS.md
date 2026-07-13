# CRM V2 Phase 09 — Advocacy Score Restrictions

**Principle:** The calendar-year advocacy score is an event-based, capped sum for assigned-adviser transparency only. It must never influence sales priority, advice, service tiering, or client ranking.

**Implementation:** `lib/crm-v2/advocacy/restrictions.ts`, `lib/crm-v2/advocacy/score.ts`

---

## 1. Score computation model

| Aspect | Rule |
|--------|------|
| Window | Current calendar year (`event_date` between Jan 1 and Dec 31) |
| Eligibility | `active = true` AND `score_eligible = true` |
| Points source | `advocacy_score_config.points` per `event_type`, fallback to event `points` |
| Category caps | Per `event_type` cap from config (e.g. introductions max 10 pts) |
| Global cap | `max_yearly_score` (seed: 50) |
| Empty year | `cappedScore: null`, `explanation: null` |
| Storage | **Not persisted** — computed on read |

**Seed weights (migration `202606290015`):**

| Config key | Event type | Points | Category cap |
|------------|------------|--------|--------------|
| `intro_made` | `introduction_made` | 2 | 10 |
| `referral_received` | `referral_received` | 3 | 15 |
| `testimonial_consented` | `testimonial_consented` | 2 | 6 |
| `review_completed` | `review_completed` | 1 | 5 |
| `thank_you_sent` | `thank_you_sent` | 1 | 10 |

---

## 2. Allowed uses

Defined in `ADVOCACY_SCORE_ALLOWED_USES`:

| Use | Surface |
|-----|---------|
| `adviser_relationship_360_summary` | Engagement tab safe summary link text only (count, not score in list) |
| `adviser_advocacy_workspace_yearly_summary` | `AdviserAdvocacySummaryDto.yearlyScore` |
| `transparent_explanation_to_assigned_adviser` | `scoreExplanation` string in adviser workspace |

---

## 3. Prohibited uses

Defined in `ADVOCACY_SCORE_PROHIBITED_USES`:

| Prohibited context | Rationale |
|--------------------|-----------|
| `work_queue_priority` | Queue must remain action-based, not score-based |
| `client_ranking` | No book sorting by advocacy |
| `lead_scoring` | Referrals are not sales leads in CRM V2 |
| `sales_priority` | No premium opportunity ranking |
| `financial_advice` | Score unrelated to suitability |
| `product_recommendation` | No product tie-in |
| `service_tiering` | No VIP tiers from advocacy |
| `urgency_classification` | Follow-up urgency from `follow_up_status`, not score |
| `ethnicity_segmentation` | Hard prohibition (platform-wide) |
| `wealth_segmentation` | Hard prohibition |
| `premium_opportunity` | No upsell targeting |
| `protection_gap_opportunity` | No cross-sell from score |
| `client_list_badges` | Relationship list excludes score |
| `automated_outreach` | No auto-campaigns from score thresholds |

`assertAdvocacyScoreNotUsedForPriority(context)` throws if a prohibited context is referenced at runtime.

---

## 4. Work queue integration

`advocacyEventAdapter` explicitly:

- Sets `priority: "normal"` for all items
- Uses `follow_up_status` and `consent_state` for `requiresAction` — **not** score
- Never reads `computeAdvocacyYearScore` in adapter path

`advocacyScoreMustNotAffectQueuePriority()` guard returns true by convention for static analysis.

---

## 5. DTO exclusions

| DTO | Score present? |
|-----|----------------|
| `AdviserAdvocacySummaryDto` | Yes (`yearlyScore`, `scoreExplanation`) |
| `AdviserAdvocacyEventDto` | No per-event score in DTO (points stored server-side) |
| `ClientAdvocacyPreferencesDto` | **No** |
| Relationship list DTO | **No** |
| `AdviserWorkItem` | **No** |

`advocacyScoreMustNotAppearInClientDto()` documents the client boundary.

---

## 6. Operator configuration

`advocacy_score_config` is operator-managed (SQL/admin API). Advisers cannot mutate weights. Changes apply to future score computations; historical events retain recorded `points` on rows but computation prefers config at read time.

---

## 7. Year rollover

Events are **never deleted** on calendar year change. Prior-year events remain in `advocacy_events`; score computation filters by `event_date` year only.

---

## 8. Compliance alignment

| Platform rule | Advocacy score compliance |
|---------------|---------------------------|
| Blueprint P7 (no prohibited scoring) | Enforced via restrictions module |
| Phase 9F.4 Promotions | No score → promotion targeting |
| CRM visibility model §2.1 | Score never in list |
| Work queue Phase 10.2 | Virtual projection only |

---

## 9. Testing expectations

Manual and automated tests must verify:

1. Queue items for advocacy show `priority: "normal"` regardless of event points
2. Client `GET /api/preferences/advocacy` JSON contains no score fields
3. Relationship list API contains no `yearlyScore` or `advocacyScore`
4. No API returns cross-client score rankings or sorted leaderboards
