# CRM V2 Phase 09 — Consent and Privacy

**Scope:** Testimonial consent, referral ask preferences, permission to mention, withdrawal flows, and privacy boundaries for advocacy data.

---

## 1. Consent states

Allowlisted `consent_state` values (events and preferences):

| State | Meaning | Typical use |
|-------|---------|-------------|
| `not_required` | No explicit consent needed for this event type | Thank-you, referral outcome updates |
| `pending` | Awaiting client decision | `testimonial_offered`, `permission_to_mention_granted` |
| `granted` | Client gave explicit consent | Testimonial use approved |
| `limited` | Consent with restrictions | Partial mention permission |
| `withdrawn` | Client revoked prior consent | Post-withdrawal blocks re-grant without new explicit action |
| `declined` | Client declined | `do_not_ask_recorded` |
| `unknown` | Not yet captured | Default for new clients |

**Transition rule:** `withdrawn` → `granted` is **rejected** without a new explicit grant workflow (`validateConsentTransition`).

---

## 2. Testimonial rules

| Rule | Detail |
|------|--------|
| Public testimonials | Remain governed by `adviser_feedback` with `status = approved_testimonial` |
| CRM consent aggregate | `crm_client_advocacy_preferences.testimonial_consent` tracks CRM-level permission |
| Event-level consent | `advocacy_events.consent_state` on testimonial-related events |
| Explicit consent required | `testimonial_offered`, `testimonial_consented`, `permission_to_mention_granted` default to `pending` |
| Withdrawal | Client may set `testimonial_consent = withdrawn` via PATCH or POST `/api/preferences/advocacy/withdraw` |
| Side effect on withdraw | `permission_to_mention` forced false; domain event `consent_withdrawn`; adviser in-app notification |
| No auto-publish | Advocacy consent does not auto-approve `adviser_feedback` for public display |

---

## 3. Referral and mention preferences

| Preference | Column | Effect |
|------------|--------|--------|
| Referral ask opt-out | `referral_ask_opt_out` | Client signal; adviser sees in summary — does not auto-block all referral events |
| Permission to mention | `permission_to_mention` | Client grants name mention in marketing contexts |
| Do not ask | `do_not_ask` | Blocks adviser creation of `introduction_offered` events (validation error) |

---

## 4. Withdrawal flow

```text
Client POST /api/preferences/advocacy/withdraw { expectedVersion }
  → testimonial_consent = withdrawn
  → permission_to_mention = false
  → version increment
  → advocacy_domain_events: consent_withdrawn
  → notifyAdvocacyConsentWithdrawn (in-app only)
  → audit_logs: crm_v2_client_advocacy_preferences_updated
```

Idempotent: repeated withdraw when already `withdrawn` returns current preferences without error.

Alternative: `PATCH /api/preferences/advocacy` with `testimonialConsent: "withdrawn"`.

---

## 5. Client preferences API privacy

**Exposed to client (`ClientAdvocacyPreferencesDto`):**

- `testimonialConsent`, `referralAskOptOut`, `permissionToMention`, `doNotAsk`
- `safeAcknowledgementHistory` — bounded list from domain events (type, date, safe title)
- `version`

**Never exposed to client:**

- Individual `advocacy_events` list (unless future explicit client-visible events with `visibility` flag — Phase 09 default is adviser workspace)
- Yearly advocacy score
- `referred_person_label` on other people's referrals
- Adviser notes on events
- Raw `advocacy_domain_events.safe_metadata`

---

## 6. Adviser visibility of client preferences

Adviser summary (`AdviserAdvocacySummaryDto`) includes:

- `consentStatus`, `doNotAsk`, `referralAskOptOut`, `permissionToMention`
- `yearlyScore`, `scoreExplanation` (adviser-only)
- `followUpDueCount`

Adviser event DTO includes `consentState`, `labels` (`consent_granted`, `do_not_ask`, etc.) — not full client preference row history.

---

## 7. Event visibility column

| Value | Meaning |
|-------|---------|
| `adviser_only` | Default — adviser workspace only |
| `client_visible` | May surface in future client history (Phase 09 stores; client UI optional) |
| `both` | Shared visibility intent |

Phase 09 client portal exposes preferences only, not full event history.

---

## 8. Notifications

| Event | Channel |
|-------|---------|
| Consent withdrawn | In-app `client_notifications` only |
| Testimonial permission updated | In-app adviser notification |
| Referral follow-up due | In-app (adviser-oriented copy) |

**No** SMS, email, or WhatsApp from advocacy consent flows in Phase 09.

---

## 9. Audit and domain events

All consent mutations append `advocacy_domain_events` with actor role (`client` or `adviser`). Domain events are SELECT-only for clients on their own `client_id` via RLS; INSERT allowed for assigned adviser, admin, or owning client.

---

## 10. Privacy principles

1. Consent is explicit, revocable, and versioned.
2. Withdrawal is idempotent and immediate for CRM preferences.
3. Advocacy score is adviser-only transparency — not a client-facing metric.
4. Referral labels are adviser-entered safe text — not imported contact databases.
5. Phase 9F.4 Promotions observation continues — advocacy does not bypass governed-content rules for published marketing.
