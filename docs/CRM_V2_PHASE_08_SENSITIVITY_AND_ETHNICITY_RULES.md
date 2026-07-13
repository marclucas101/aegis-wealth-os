# CRM V2 Phase 08 — Sensitivity and Ethnicity Rules

**Module:** `lib/crm-v2/moments/sensitivity.ts`  
**Scope:** `clients.ethnicity`, festive suggestions, cultural_preference moments, DTO and queue boundaries.

---

## 1. Hard platform restrictions (all CRM V2 phases)

From blueprint and rollout index — **non-negotiable**:

- No ethnicity-based financial advice
- No ethnicity-based service priority or sales targeting
- No automatic outreach from ethnicity or festive mapping alone
- No work-queue urgency derived from cultural background
- No client ranking or opportunity scoring from ethnicity
- Work queue remains a **projection** — not authoritative

Phase 08 encodes these in code constants and guard functions.

---

## 2. Allowed uses of ethnicity

`ETHNICITY_ALLOWED_USES` in `sensitivity.ts`:

| Context | Description |
|---------|-------------|
| `festive_suggestion` | Optional holiday suggestion in adviser moments workspace |
| `adviser_review` | Adviser sees client-stated background for greeting context only |
| `client_preference_confirmation` | Client submits `ethnicity_correction` pending adviser approval |

`assertEthnicityUseAllowed(context)` throws if context is in prohibited list.

---

## 3. Prohibited uses (enforced in code)

`ETHNICITY_PROHIBITED_USES`:

```text
financial_advice
product_recommendation
risk_scoring
protection_analysis
work_queue_priority
client_ranking
sales_opportunity_scoring
urgency
lead_quality
service_tier
automated_outreach
hidden_segmentation
```

Calling `assertEthnicityUseAllowed("work_queue_priority")` throws at runtime — used as compile-time documentation and defensive guard in festive loader.

---

## 4. Festive suggestions — festive only

Module: `lib/crm-v2/moments/festiveSuggestions.ts`

| Rule | Implementation |
|------|----------------|
| Optional | Returns `[]` when ethnicity is null or `prefer_not_to_say` |
| No auto-send | `festiveSuggestionMustNotAutoSend()` — suggestions are `confirmation_state: suggested` until adviser confirms |
| Confirmation required | `festiveSuggestionRequiresConfirmation()` — confirm creates `relationship_moments` row with `sensitivity_class: cultural_preference` |
| Override precedence | `adviser_moment_overrides.exclude` suppresses; `include` forces |
| No lunar date engine | Lunar holidays return `suggestedDate: null` — adviser sets date manually |
| Guard on load | `assertEthnicityUseAllowed("festive_suggestion")` at start of `loadFestiveSuggestionsForClient` |

Confirmed festive moments carry label `sensitive_use_restricted` in adviser DTO.

---

## 5. Storage rules

| Location | Ethnicity stored? |
|----------|-------------------|
| `clients.ethnicity` | Yes — optional, CHECK-constrained enum |
| `relationship_moments` | No ethnicity column — only `holiday_key` + `sensitivity_class` |
| `relationship_moment_events.safe_metadata` | IDs and moment types only — no ethnicity values |
| Work queue `metadata` | Empty object `{}` — `ethnicityMustNotAppearInWorkQueueMetadata()` |
| Timeline text | No ethnicity — `ethnicityMustNotAppearInTimelineText()` |
| Notifications | No ethnicity in title/summary — `ethnicityMustNotAppearInNotificationText()` |
| Client preferences DTO | Ethnicity shown to **client** on `/preferences` only when set; adviser workspace shows label "Cultural background" without using it for sorting |

---

## 6. Sensitivity classes on moments

| Class | When assigned | UI label |
|-------|---------------|----------|
| `standard` | Default moment types | — |
| `cultural_preference` | `festive_greeting` moments | `sensitive_use_restricted` |
| `life_event` | Reserved for `life_event_follow_up` | Adviser discretion |

Sensitivity class is **adviser DTO only** — excluded from client API paths (`loadClientRelationshipPreferences` does not expose `sensitivity_class`).

---

## 7. Client preference flow for ethnicity

1. Client PATCH `/api/preferences` with `preferenceType: ethnicity_correction`
2. Row inserted in `crm_client_preference_updates` (`status: pending_review`)
3. Adviser reviews in moments workspace Client Preferences view
4. Approval applies value to `clients.ethnicity` (adviser action — not auto-applied in Phase 08 stub)

Opt-out preferences: `birthday_acknowledgement_opt_out`, `festive_acknowledgement_opt_out` — client-editable flags stored via preference update pipeline.

---

## 8. Google Calendar boundary (blueprint)

Phase 08 does not implement Google aggregate reminders. When Phase 05/11 extend calendar:

- Aggregate event text only (e.g. "Prepare festive greetings — N relationships")
- **No** client names or ethnicity in Google event body

---

## 9. QA enforcement

`scripts/run-crm-v2-relationship-moments-validation.ts` checks:

- `sensitivity.ts` contains `work_queue_priority` prohibition
- `festiveSuggestions.ts` respects `prefer_not_to_say`
- Timeline projection excludes `ethnicity` string
- Client loader path excludes `sensitivity_class`
- Notifications module has no SMS/email/WhatsApp send

---

## 10. Operator acceptance criteria

- [ ] Festive suggestion never auto-creates confirmed moment without adviser action
- [ ] Queue items for moments/reviews show `priority: normal` regardless of ethnicity
- [ ] Client with `prefer_not_to_say` sees zero festive suggestions in adviser workspace
- [ ] Network inspection: no ethnicity in timeline event titles
- [ ] Ethnicity correction creates pending review row — not immediate `clients` update without adviser
