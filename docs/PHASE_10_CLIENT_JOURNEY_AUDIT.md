# Phase 10 — Client Journey Audit

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  

---

## Journey trace

```text
invited → account activated → profile completed → financial information provided →
diagnostic viewed → plan reviewed → meeting attended → actions accepted →
documents accessed → progress tracked → annual review
```

Entitlements gate navigation via `lib/compliance/entitlements.ts` and `GET /api/client/entitlements`.

---

## Stage-by-stage analysis

### Invited

| Dimension | Finding |
|-----------|---------|
| **Client experience** | Receives invitation; activates account via auth flow |
| **AEGIS screen** | Auth callback; admin `/api/admin/client-invitations` |
| **Clarity** | Clear if invitation email configured |
| **Dead ends** | Unassigned adviser blocks meaningful portal use |
| **Classification** | Compliance-required (identity) |

### Account activated

| Dimension | Finding |
|-----------|---------|
| **Client experience** | Lands on stage-appropriate home (`/prospect` or `/dashboard`) |
| **AEGIS screen** | Entitlements resolve nav |
| **Unclear next steps** | Prospect home guides to Discover; active client may see empty plan state |
| **Classification** | Genuine client value |

### Profile completed

| Dimension | Finding |
|-----------|---------|
| **Client experience** | `/profile` for account record; Discover for financial profile |
| **Duplicate entry** | Personal info may overlap Discover `personal` section and `/profile` |
| **Classification** | Mixed — account vs financial separation unclear in labels ("Phase 3F") |

### Financial information provided

| Dimension | Finding |
|-----------|---------|
| **Client experience** | `/discover` wizard (11 sections) |
| **AEGIS screen** | `DiscoverWizard.tsx` |
| **Progress feedback** | Section completeness scores visible |
| **Duplicate entry** | Budget Optimiser separate from Discover expenses when active |
| **Classification** | Genuine client value + compliance data collection |

### Diagnostic viewed

| Dimension | Finding |
|-----------|---------|
| **Client experience** | Prospect: readiness snapshot on `/dashboard`; Active: **blocked from raw shield by default** |
| **Dead ends** | Active clients without published overview see waiting message |
| **Discoverability** | Diagnostic not in active client nav — intentional governance |
| **Classification** | Adviser-only operational detail for raw scores; client sees governed snapshot only |

### Plan reviewed

| Dimension | Finding |
|-----------|---------|
| **Client experience** | `/my-plan`, `/dashboard` financial overview |
| **Source of truth** | `published_outputs` with client audience |
| **Unclear adviser ownership** | Empty states reference adviser — no named contact inline |
| **Missing confirmation** | No "I have read this plan" capture |
| **Classification** | Genuine client value |

### Meeting attended

| Dimension | Finding |
|-----------|---------|
| **Client experience** | Booking via `/my-adviser`; prospect prep at `/meeting-preparation` |
| **In-app meeting** | No client Meeting Studio — meetings are external |
| **Meeting packs** | Appear in document vault if adviser publishes binder (`binder_client_publication`) |
| **Notification gaps** | Appointment confirmations via email path; in-app notifications on insights only |
| **Classification** | Genuine client value for booking; pack access partial |

### Actions accepted

| Dimension | Finding |
|-----------|---------|
| **Client experience** | `/roadmap` for visible items; `/goals-reviews` for submissions |
| **Missing confirmation** | Roadmap status update only — no explicit accept/decline |
| **Visibility gap** | Engine roadmap items hidden until adviser sets `client_visible` |
| **Classification** | Genuine client value when visible |

### Documents accessed

| Dimension | Finding |
|-----------|---------|
| **Client experience** | `/document-vault` |
| **Classification** | Genuine client value |
| **Gap** | Upload requests not structured as tasks client can see |

### Progress tracked

| Dimension | Finding |
|-----------|---------|
| **Client experience** | Roadmap status, goals, notifications panel |
| **Missing progress feedback** | **No unified progress dashboard** — scattered across nav items |
| **Dead ends** | Legacy `/api/roadmap/current` fallback may confuse if active envelope fails |
| **Classification** | Genuine client value (Track B opportunity) |

### Annual review

| Dimension | Finding |
|-----------|---------|
| **Client experience** | `/goals-reviews` submit; published annual review summary when available |
| **Duplicate concepts** | Client submission vs adviser annual review snapshot vs published summary |
| **Notification gaps** | Review due not surfaced as client notification unless lifecycle event fires |
| **Classification** | Compliance-required + genuine value |

---

## Gap summary

### Unclear next steps

- Active client empty plan state — waits on adviser publish without ETA
- No client-facing "what happens next" after Discover submit beyond prospect submitted page
- Communication preferences API exists but **no UI** — clients cannot manage consent in-app

### Dead ends

- `/promotions` redirects to insights (retired) — bookmarks OK
- `/wealth-blueprint`, `/annual-review` redirect — legacy URLs handled
- Raw shield/stress routes gated — may 403 or redirect for active clients

### Duplicate data entry

- Discover vs Budget Optimiser expenses/income
- Discover personal vs `/profile` account fields
- Discover retirement goals vs `client_goals` table

### Missing progress feedback

- No single "Your progress" view combining completeness, roadmap, documents, next meeting
- Roadmap items hidden by default — client may see empty roadmap despite adviser work

### Unclear adviser ownership

- Empty states generic; `/my-adviser` requires navigation
- No persistent "your adviser is preparing X" status entity

### Missing client confirmations

- Plan publication view without acknowledgement
- Meeting acknowledgements captured in Meeting Studio (adviser-side), not client portal
- Roadmap status ≠ formal acceptance

### Notification gaps

- In-app notifications on `/insights` sub-panel — **not in main nav**
- Email preferences not client-configurable in UI
- Review due reminders depend on lifecycle wiring

### Discoverability issues

- Notifications buried under Insights
- Meeting packs only in document vault without nav label
- Communication preferences invisible

### Language / accessibility

- Some UI labels reference internal phase names ("Phase 3F")
- Financial jargon in pillar names — no plain-language layer verified

---

## Value classification

| Item | Category |
|------|----------|
| Published plan and overview | Genuine client value |
| Document vault | Genuine client value |
| Roadmap (when visible) | Genuine client value |
| Raw shield/stress scores | Adviser-only operational detail |
| Discover 11-section wizard | Compliance-required + client value |
| Budget optimiser | Genuine client value (parallel silo) |
| Insights feed | Genuine client value (governed education) |
| Internal publication draft states | Adviser-only — correctly hidden |
| Dual review submission types | Unnecessary complexity for clients — consolidate in future phase |
| Legacy roadmap API fallback | Unnecessary complexity — defer removal |

---

## Client journey conclusion

The **active client portal is functional** for viewing governed content, documents, roadmap, goals, and adviser contact. The largest client-facing gap is **progress cohesion** — no Action Centre tying together actions, documents due, next meeting, and review status. However, adviser operational fragmentation is the more urgent end-to-end blocker because advisers cannot reliably drive client portal content without a unified queue (see adviser journey audit).

**Track B (Client Progress and Action Centre)** is valuable but **depends on advisers consistently publishing and flagging client-visible items** — an adviser-side queue (Track A) should precede or ship alongside it.
