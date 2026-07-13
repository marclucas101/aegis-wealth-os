# CRM V2 Phase 10 — Channel and Consent Model

**Scope:** Allowlisted communication channels, channel capabilities, client preferences, do-not-contact enforcement, and preference warnings surfaced to advisers.

---

## 1. Channel allowlist

All channels are defined in `CRM_COMMUNICATION_CHANNELS` (`lib/crm-v2/communications/types.ts`) and enforced by DB CHECK constraints on `crm_communication_threads`, `crm_communication_records`, and `crm_communication_templates`.

| Channel | Purpose | Draft | Log | Auto-send | Client-visible capability |
|---------|---------|-------|-----|-----------|---------------------------|
| `internal_client_message` | Adviser–client in-app message | Yes | Yes | **No** | Yes |
| `in_app_notification` | In-app notification record | Yes | Yes | **No** | Yes |
| `email_draft` | Email composed externally by adviser | Yes | Yes | **No** | No (draft/log only) |
| `phone_call_log` | Call log entry | No | Yes | **No** | No |
| `meeting_note_reference` | Meeting note reference | No | Yes | **No** | No |
| `whatsapp_draft` | WhatsApp draft for manual send | Yes | Yes | **No** | No |
| `sms_draft` | SMS draft for manual send | Yes | Yes | **No** | No |
| `external_message_log` | Generic external message log | No | Yes | **No** | No |

**Source of truth for capabilities:** `CHANNEL_CAPABILITIES` in `lib/crm-v2/communications/channels.ts`.

**Invariant:** `channelAllowsAutoSend()` returns `false` for every channel. Phase 10 never invokes `lib/email/emailProvider.ts` or any SMS/WhatsApp provider from CRM V2 transitions.

---

## 2. External draft channels

`EXTERNAL_DRAFT_CHANNELS` = `email_draft`, `whatsapp_draft`, `sms_draft`, `external_message_log`.

Adviser workflow:

1. Create draft in AEGIS with governed template (optional).
2. Copy or reference content externally (outside platform).
3. Transition `mark_sent` or `mark_logged` — records `delivery_state=logged_only`.
4. No platform dispatch occurs.

---

## 3. Preferred channel (client preference)

Migration `202606290017` adds `communication_preferences.preferred_channel` with CHECK constraint:

| Value | Meaning |
|-------|---------|
| `in_app` | Default — in-app operational messages |
| `email_draft` | Client prefers email-style contact (adviser still logs manually) |
| `phone_call_log` | Client prefers phone contact |
| `internal_client_message` | Client prefers adviser messages in `/messages` |

Preferred channel is **advisory** — it surfaces in adviser preference DTO but does not auto-route or auto-send.

---

## 4. Consent and preference fields

### 4.1 Phase 9E base (retained)

| Column | Default | Purpose |
|--------|---------|---------|
| `in_app_operational` | true | Operational in-app contact |
| `email_operational` | true | Operational email consent (9E governed delivery) |
| `educational_insights` | true | Insights feed categories |
| `market_updates` | true | Market update content |
| `event_announcements` | true | Event announcements |
| `adviser_messages` | true | Allow adviser messages and client replies |
| `promotional_content` | false | Marketing/promotional content opt-in |

### 4.2 Phase 10 extensions

| Column | Default | Purpose |
|--------|---------|---------|
| `do_not_contact` | false | Hard block — adviser cannot create new drafts |
| `festive_acknowledgement_opt_out` | false | Blocks festive/birthday-style acknowledgements |
| `client_message_visibility` | `visible` | Client inbox display mode |
| `last_confirmed_at` | null | When client last confirmed preferences |
| `version` | 1 | Optimistic concurrency |

---

## 5. Do-not-contact enforcement

| Surface | Behaviour |
|---------|-----------|
| `POST /api/advisor-v2/communications` (create draft) | **Rejected** with validation error when `do_not_contact=true` |
| `POST .../transition` with `mark_sent` | **Rejected** when `isCampaignStyleBlocked()` true (marketing opt-out OR do-not-contact) |
| Adviser preference DTO | `preferenceWarnings` includes `do_not_contact` |
| Work queue | Records still visible for review/close-out; no auto outreach |

**Fail-closed on create:** Server checks preferences before thread/record insert — client cannot bypass via API.

---

## 6. Marketing opt-out and campaign-style blocking

`isCampaignStyleBlocked(marketingOptOut, doNotContact)`:

- `marketingOptOut` = `promotional_content` is false (default)
- Returns true when either marketing opted out or do-not-contact set
- Blocks `mark_sent` transition (not `mark_logged` for operational logs)

**No campaign automation:** No batch jobs, no scheduled sends, no promotion table writes.

---

## 7. Festive acknowledgement opt-out

`festive_acknowledgement_opt_out` prevents adviser use of festive/birthday-style template categories for automated-style outreach.

| Enforcement | Detail |
|-------------|--------|
| DTO warning | `festive_acknowledgement_opt_out` in `preferenceWarnings` |
| No auto-send | No cron or moment-triggered messages in Phase 10 |
| Relationship moments | Phase 08 moments do not trigger communications |

---

## 8. Adviser messages toggle

| State | Client impact |
|-------|---------------|
| `adviser_messages=true` | Client can view messages and reply (`canReply=true` on outbound messages) |
| `adviser_messages=false` | `POST /api/messages/[id]/reply` rejected; warning on inbox |

---

## 9. Preference warnings model

`buildPreferenceWarnings()` returns string codes on adviser and client DTOs:

| Code | Condition |
|------|-----------|
| `do_not_contact` | `do_not_contact=true` |
| `marketing_opt_out` | `promotional_content=false` |
| `festive_acknowledgement_opt_out` | `festive_acknowledgement_opt_out=true` |
| `adviser_messages_disabled` | `adviser_messages=false` |

Adviser record labels include `preference_conflict` when any warning present.

---

## 10. Consent basis on records

| Value | Use |
|-------|-----|
| `operational` | Default adviser-initiated service communication |
| `client_request` | Client reply (`direction=inbound`) |
| `appointment` | Linked to appointment context |
| `service` | Linked to service request/commitment |
| `explicit_consent` | Documented explicit consent |
| `preference_conflict` | Recorded when adviser proceeds despite warnings (audit) |

---

## 11. Client visibility on records

| `client_visibility` | Client `/messages` visibility |
|---------------------|-------------------------------|
| `adviser_only` | Hidden |
| `client_visible` | Visible when lifecycle IN (`sent`, `logged`, `received`) |
| `both` | Visible (includes inbound replies) |

Draft and `pending_review` records are **never** client-visible regardless of visibility flag.

---

## 12. RLS and preference access

| Actor | `communication_preferences` access |
|-------|-----------------------------------|
| Client (owner) | SELECT/UPDATE own row (9E RLS) |
| Assigned adviser | Read via server admin client after `resolveAccessibleClient` |
| Admin | Full via admin tooling |

Phase 10 does not add adviser RLS write on preferences — client controls own preferences; adviser reads for context.

---

## 13. Prohibited consent uses

From `COMMUNICATION_PROHIBITED_USES`:

- `automated_outreach`
- `campaign_automation`
- `advocacy_score_priority`
- `ethnicity_targeting`
- `wealth_segmentation`
- `protection_gap_trigger`
- `sales_opportunity_ranking`
- `product_recommendation`

None are implemented in Phase 10 schema or application code.

**Branch:** `crm-v2-10-communications`
