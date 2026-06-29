- Phase 05 Google event payload remains minimal: safe title, schedule, delivery mode, safe location, optional approved attendee email, optional Meet link.
- Google payload must never include ethnicity, advocacy, policy numbers, financial values, private adviser agenda, notes, checklist internals, document names, storage paths, NRIC, or cancellation reason details.
# CRM V2 — Visibility Model

**Phase:** 00

---

## 1. Visibility tiers

| Tier | Code | Who sees | Mutability | Examples |
|------|------|----------|------------|----------|
| **Adviser-only** (`adviser-only`) | `adviser` | Assigned adviser (+ admin ops) | Adviser writes | Private notes, internal agenda, advocacy score, unverified extraction, draft comms |
| **Client-visible** (`client-visible`) | `client` | Client portal user for that relationship | Client writes where owned | Shared commitments, appointment requests, published summaries, client-visible follow-ups |
| **Audit-only** (`audit-only`) | `audit` | Admin/compliance review; not in ordinary UI | Append-only | State transition events, `audit_logs`, extraction correction history |
| **System** | `system` | Platform jobs, cron, sync workers | System writes | `calendar_sync_status`, notification retry state, job run metadata |

---

## 2. Field-level rules by domain

### 2.1 Relationship list (`/advisor-v2/relationships`)

| Field | Visibility |
|-------|------------|
| Display name | Adviser |
| Lifecycle stage | Adviser |
| Last engagement (relative) | Adviser |
| Next appointment (date only) | Adviser |
| Review state badge | Adviser |
| Open commitment count | Adviser |
| Protection summary (verified/unverified/missing) | Adviser — **no amounts** |
| Email, phone | Adviser — **not in list DTO** |
| Financial amounts | **Never in list** |
| Ethnicity | **Never in list** |
| Advocacy score | **Never in list** |

### 2.2 Relationship 360

| Section | Adviser | Client | Notes |
|---------|---------|--------|-------|
| Overview | Full | N/A (adviser route) | Safe summary only |
| Financial Plan | Published outputs | Via client portal `/my-plan` | No raw discover in list |
| Engagement | Timeline projection | Subset via client portal when published | |
| Service | Commitments | Client-owned + shared | |
| Documents | Full vault | `client_visible` documents | |
| Relationship Profile | Full incl. ethnicity | Profile fields client edits | Ethnicity optional |

### 2.3 Appointments

| Field | Adviser | Client |
|-------|---------|--------|
| Scheduled time, type, location | Yes | Yes |
| Client discussion topics | Yes | Yes (client can add) |
| Adviser agenda, prep checklist (internal) | Yes | **No** |
| `private_adviser_note` | Yes | **No** |
| Outcome (internal) | Yes | **No** |
| Published meeting summary | Yes | Yes when published |
| Participant list | Per participant visibility flag | Own household only |
| Google event URL | Yes | Yes when shared |
| Financial data | **Never** | **Never** |

### 2.4 Service commitments

| Type | Adviser | Client |
|------|---------|--------|
| adviser_commitment | Yes | No |
| client_commitment | Yes | Yes |
| shared_commitment | Yes | Yes |
| client_service_request | Yes | Yes (own requests) |
| document_request | Yes | Yes |
| appointment_preparation_item | Yes | Yes (client portion) |
| appointment_follow_up_item | Yes | Client-visible subset when published |
| review_workflow_step | Yes | No (status summary only if configured) |

### 2.5 Protection portfolio

| State | Adviser | Client |
|-------|---------|--------|
| pending_review extraction | Yes | **No** |
| confirmed policy | Yes | Simplified summary (masked IDs) |
| Premium/coverage amounts | Yes | Aggregated bands only — operator configures client DTO |
| Source document | Yes | No unless published to vault |
| Policy number | Masked in UI | Masked |

### 2.6 Relationship moments

| Data | Adviser | Client | Google Calendar |
|------|---------|--------|-----------------|
| Birthday date | Yes | Own profile | Aggregate reminder only |
| Ethnicity | Yes (profile) | Own profile | **Never** |
| Festive suggestion list | Yes | No | Count only in aggregate event |
| Adviser override | Yes | No | N/A |
| Travel away/return dates | Yes | Optional client entry | No client names |

### 2.7 Advocacy

| Data | Adviser | Client |
|------|---------|--------|
| Individual events | Yes | **No** (unless separate approval) |
| Current-year score | Yes | **No** |
| Thank-you outstanding | Yes | No |
| Referral consent state | Yes | Own consent only |

### 2.8 Communications

| Stage | Adviser | Client |
|-------|---------|--------|
| CRM draft | Yes | No |
| Governed content draft | Yes | No |
| Published insight | Yes | Yes (feed) |
| Delivery failure detail | Yes (ops) | No |
| Internal delivery state | Yes | No |

### 2.9 Work queue / Today

| Rule | Application |
|------|-------------|
| DTO | Same as Phase 10.2 `AdviserWorkItem` — display name only, no amounts |
| Ethnicity | Never |
| Advocacy | Never affects sort |
| Wealth | Never |

---

## 3. Role matrix

| Action | Adviser (assigned) | Adviser (unassigned) | Client | Admin |
|--------|-------------------|---------------------|--------|-------|
| View relationship list | Yes | No | No | Deferred (book-wide Phase 12 ops) |
| View Relationship 360 | Yes | No (404/forbidden) | No | Read-only ops diagnostic Phase 12 |
| Mutate appointment | Yes | No | Limited (Phase 04) | No impersonation |
| View audit events | Via timeline subset | No | No | Ops Phase 12 |
| Feature flag toggle | No | No | No | Yes (API) |
| Pilot CRM V2 | If in allowlist | No | No | N/A |

**IDOR rule:** Forged `relationshipId` / `clientId` returns **404 or forbidden** with no existence leak — same as `resolveAccessibleClient`.

---

## 4. Logging and telemetry visibility

| Log | Allowed | Prohibited |
|-----|---------|------------|
| Request ID | Yes | — |
| User ID (actor) | Yes | — |
| Client ID | Yes (authorized) | In aggregate external logs |
| Display name | Avoid in production logs | — |
| Financial amounts | **No** | |
| Ethnicity | **No** | |
| Policy numbers | **No** | |
| Note bodies | **No** | |
| Discover JSONB | **No** | |

Align with Phase 10.2 and Phase 9F.4 retirement telemetry rules.

---

## 5. Visibility enforcement layers

```text
1. Feature flag (crm_v2_master, sub-flags)
2. Pilot allowlist (crm_v2_pilot_user_ids)
3. requireAdvisorAccess() / client session
4. resolveAccessibleClient(authUserId, role, clientId)
5. RLS (is_assigned_advisor)
6. API DTO mapper (strip forbidden fields)
7. UI component guards (disabled states when flag off)
```

---

## 6. Prohibited visibility patterns

- Ethnicity on calendar cards, queue items, or Google events
- Advocacy score in client portal (default)
- Client wealth or premium size in prioritization UI
- Cross-adviser relationship data in any CRM V2 response
- Internal notes exposed through client appointment APIs
- Unverified protection extraction in client summary
