# CRM V2 Phase 09 — Visibility and Privacy

**Scope:** Distinct adviser vs client DTOs, field redactions, and cross-surface privacy boundaries for advocacy data.

---

## 1. Visibility tiers (advocacy extension)

| Tier | Advocacy examples |
|------|-------------------|
| **Adviser-only** | Event `notes`, `referred_person_label`, yearly score, follow-up internals, deactivated events |
| **Client-visible (preferences)** | Consent booleans, testimonial consent state, acknowledgement history (safe) |
| **Audit-only** | Full `advocacy_domain_events.safe_metadata`, `recorded_by`, `idempotency_key` |
| **Never client** | Score, referral labels, individual event history (Phase 09 default) |

---

## 2. Adviser DTO — `AdviserAdvocacyEventDto`

### Included

- `safeTitle`, `eventType`, `eventDate`, `consentState`, `visibility`
- `followUpStatus`, `nextFollowUpDate`
- `referredPersonLabel`, `hasContactDetails` (assigned book only)
- `labels` — `consent_granted`, `do_not_ask`, `follow_up_due`, etc.
- Link IDs for appointment, service request, moment

### Redacted from workspace list DTO

| Field | Reason |
|-------|--------|
| `notes` | Available via PATCH response / detail only if extended — not in default list map |
| `points` | Score computation internal |
| `idempotency_key` | Operational |
| `recorded_by` | Audit domain |

### Adviser summary — `AdviserAdvocacySummaryDto`

| Field | Visible |
|-------|---------|
| `yearlyScore` | Yes — assigned adviser only |
| `scoreExplanation` | Yes |
| Client preference flags | Yes |
| Cross-client comparison | **No** — per relationship only |

---

## 3. Client DTO — `ClientAdvocacyPreferencesDto`

### Included

- `testimonialConsent`, `referralAskOptOut`, `permissionToMention`, `doNotAsk`
- `safeAcknowledgementHistory` — sanitized domain events
- `version`

### Redacted

| Field | Reason |
|-------|--------|
| `yearlyScore` | Prohibited — `advocacyScoreMustNotAppearInClientDto()` |
| Advocacy event list | Adviser workspace only |
| `referred_person_label` | Third-party privacy |
| Event `notes` | Adviser internal |
| Other clients' data | Assignment scope |

---

## 4. Relationship list and 360

| Surface | Advocacy data |
|---------|---------------|
| Relationship list | **No score, no event counts** |
| Relationship 360 overview | Safe engagement link: label + count text via `loadCrmAdvocacyEngagementSummary` |
| Relationship 360 engagement tab | Link to advocacy workspace — no score in tab header |
| Timeline projection | Future: safe domain event titles only — no notes |

---

## 5. Work queue DTO — `AdviserWorkItem`

| Field | Advocacy adapter value |
|-------|------------------------|
| `title` | Event `safe_title` |
| `summary` | Generic follow-up text |
| `priority` | `normal` — never score-derived |
| `metadata` | Empty `{}` |
| `clientDisplayName` | Standard queue display name |

**Excluded:** score, `referred_person_label`, consent details, notes

---

## 6. Event visibility column

| `visibility` | Phase 09 behaviour |
|--------------|-------------------|
| `adviser_only` | Default — client APIs do not return event |
| `client_visible` | Stored for future client history UI — not exposed Phase 09 |
| `both` | Intent flag — client preferences path separate |

---

## 7. Redaction rules summary

```text
Client API  → preferences aggregate only, no score, no events
Adviser API → full workspace minus operational secrets in list DTO
Queue       → action title + generic summary, priority normal
List/360    → no score; engagement link is count text only
Audit       → full metadata in advocacy_domain_events (admin/ops)
```

---

## 8. PII and safe text

| Field | Handling |
|-------|----------|
| `safe_title` | Trimmed, max 200 chars |
| `notes` | Max 2000 chars, adviser-only |
| `referred_person_label` | Max 120 chars, initials-style label — not full contact import |
| `has_contact_details` | Boolean flag only — no phone/email columns |

---

## 9. Cross-role matrix

| Data | Assigned adviser | Unassigned adviser | Client | Admin |
|------|------------------|-------------------|--------|-------|
| Advocacy workspace | Yes | No | No | RLS admin |
| Client preferences API | No (client writes) | No | Own only | No |
| Yearly score | Yes | No | **No** | Diagnostic Phase 12 deferred |
| Domain events | SELECT assigned | No | INSERT own consent | SELECT |

---

## 10. Alignment with platform visibility model

Extends `docs/CRM_V2_VISIBILITY_MODEL.md` §2.7:

- Individual events: adviser yes, client no (Phase 09)
- Current-year score: adviser yes, client no
- Thank-you outstanding: adviser yes, client no
- Referral consent state: adviser sees aggregate; client sees own preferences only
