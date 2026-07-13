# CRM V2 Phase 08 — Visibility and Privacy

**Types:** `lib/crm-v2/moments/types.ts`  
**Model alignment:** `docs/CRM_V2_VISIBILITY_MODEL.md`

---

## 1. Visibility tiers

| Tier | Phase 08 examples |
|------|-------------------|
| **Adviser-only** | `sensitivity_class`, festive suggestion internals, pending preference payloads, `adviser_user_id`, deactivation metadata |
| **Client-visible** | Client-visible moments (`visibility: client_visible` \| `both`), preferences on `/preferences`, ethnicity self-view |
| **Both** | Confirmed important dates explicitly marked `both` |
| **Audit-only** | `relationship_moment_events.safe_metadata` — IDs and types, no ethnicity |
| **System** | `festive_holiday_mappings` seed config — read-only |

---

## 2. Moment visibility column

`relationship_moments.visibility`:

| Value | Client sees | Adviser sees |
|-------|-------------|--------------|
| `adviser_only` | No | Yes |
| `client_visible` | Yes (in preferences important dates) | Yes |
| `both` | Yes | Yes |

Default on create: `adviser_only`. Festive confirmed moments default `adviser_only` until adviser changes visibility.

Client loader filters: `.in("visibility", ["client_visible", "both"])`.

---

## 3. Adviser DTO — included fields

`AdviserRelationshipMomentDto` includes full operational context:

- `sensitivityClass` — drives `sensitive_use_restricted` label
- `confirmationState` — `confirmed`, `suggested`, `rejected`, `pending_client`
- `labels` — `confirmed`, `unconfirmed`, `suggested`, `client_visible`, `adviser_only`, `sensitive_use_restricted`
- `linkedAppointmentId`, `linkedCommitmentId`
- `holidayKey` for festive moments
- `version` for concurrency

---

## 4. Client DTO — exclusions

`ClientRelationshipPreferencesDto` and GET `/api/preferences` **never** expose:

| Excluded | Reason |
|----------|--------|
| `sensitivity_class` | Adviser operational classification |
| `confirmation_state` for adviser-only moments | Not client-visible |
| `adviser_user_id` | Assignment internal |
| `source_type`, `source_id` | Provenance internal |
| `idempotency_key` | Write integrity internal |
| Festive suggestions before confirm | Suggested state is adviser-only |
| Review rhythm adviser fields | `crm_review_rhythm` not exposed to client API in Phase 08 |
| Queue item metadata | Empty by design |
| Ethnicity of other clients | N/A — own record only |

Client `importantDates` shows title, date, and simplified `confirmed` boolean.

---

## 5. Ethnicity privacy

| Surface | Ethnicity shown? |
|---------|------------------|
| Client `/preferences` | Own value only, optional |
| Adviser moments workspace | Label "Cultural background" in client preferences panel |
| Timeline | **Never** in event title or summary |
| Notifications | **Never** in title/summary text |
| Work queue | **Never** in metadata |
| Audit `safe_metadata` | **Never** |

`prefer_not_to_say` stored like other values but suppresses festive suggestions.

---

## 6. Timeline projection rules

`lib/crm-v2/relationships/timelineProjection.ts`:

- Sources `relationship_moment_events` only
- Event type label: `relationship_moment`
- Deterministic sort by `occurred_at DESC`
- No query or render path includes `clients.ethnicity`
- Safe metadata JSON — bounded keys, no free-text client cultural notes

---

## 7. Notification privacy

`lib/crm-v2/moments/notifications.ts`:

- Channel: in-app (`dbCreateClientNotification`) only
- No SMS, WhatsApp, or `sendEmail`
- Summaries truncated to 200 chars
- Review due notification uses review type label — no ethnicity
- Preference submitted: generic "Your adviser will review" — no proposed value echo

---

## 8. Festive suggestion privacy

Adviser workspace shows suggestions with `labels: ["suggested", "sensitive_use_restricted"]`.

Until adviser confirms:

- No `relationship_moments` row created (except on confirm)
- No client notification
- No governed communication draft

Confirmed festive moment: `sensitivity_class = cultural_preference`.

---

## 9. Review rhythm client visibility

`crm_review_rhythm.client_visibility` boolean:

- Default `false`
- When true, future client surfaces may show cadence summary (Phase 08 client API does not expose rhythm rows)
- `next_due_date` on client record (`clients.next_review_due`) remains separate legacy visibility path

---

## 10. Bounded lists

| Constant | Value | DTO field |
|----------|-------|-----------|
| `CRM_V2_MOMENTS_MAX_ITEMS` | 50 | `bounded: true` when exceeded |
| `CRM_V2_MOMENTS_MAX_EVENTS` | 50 | timeline cap |
| `CRM_V2_MOMENTS_MAX_TITLE_LENGTH` | 200 | title sanitization |

Prevents unbounded PII exposure in list APIs.

---

## 11. RLS and API layering

- Adviser APIs use service-role client + `resolveAccessibleClient` assignment check
- Client APIs use `ensureUserClientProfile` — own `client.id` only
- RLS on `crm_client_preference_updates` allows client insert/select own rows
- `relationship_moment_events` SELECT adviser-assigned; INSERT allows client actor for preference events

---

## 12. DTO comparison matrix

| Field | Adviser workspace | Client preferences | Timeline | Queue |
|-------|-------------------|--------------------|---------|----|
| moment title | ✓ | ✓ (if visible) | ✓ (from event) | ✓ |
| sensitivity_class | ✓ | ✗ | ✗ | ✗ |
| ethnicity | ✓ (preferences panel) | ✓ (own) | ✗ | ✗ |
| holiday_key | ✓ | ✗ | ✗ | ✗ |
| review status | ✓ | ✗ | ✗ | ✓ (status only) |
| pending preference JSON | ✓ (count/warning) | count only | ✗ | ✗ |

---

## 13. Operator verification

- [ ] Client API response JSON inspected — no `sensitivity_class`
- [ ] Timeline entries inspected — no ethnicity strings
- [ ] Queue network payload — `metadata: {}`
- [ ] Adviser-only moment not returned in client `importantDates`
