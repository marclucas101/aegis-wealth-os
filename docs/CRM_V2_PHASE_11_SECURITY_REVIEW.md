# CRM V2 Phase 11 — Security Review

**Phase:** 11  
**Date:** 2026-07-13

---

## 1. Threat model

Today is a read-only projection layer. Primary risks: unauthorized data exposure, IDOR via source IDs, feature bypass, and accidental write paths.

---

## 2. Controls

| Control | Implementation |
|---------|----------------|
| Authentication | `requireAdvisorAccess` via `assertCrmV2Access` chain |
| Feature gating | `crm_v2_today` fail-closed |
| Pilot gating | Master + pilot + allowlist |
| Assignment | Work queue + calendar adapters filter by `authUserId` |
| IDOR | Source workflows re-validate on navigation |
| No writes on read | GET-only APIs; projection has no mutations |
| Error redaction | `toPublicErrorMessage` on 500 |
| Route allowlist | `isAllowlistedTodayHref` |

---

## 3. Work queue

Virtual assembly only. `adviser_work_queue` separately gated. Panel marked `readOnly: true`.

---

## 4. Google Calendar

Connection status from stored records only. No OAuth tokens in responses. No provider API on Today read.

---

## 5. Audit

Today read does not create domain events. Preference changes (if added later) would audit only.

---

## 6. Rejected

- Persisted Today authority
- Generic work-item table
- Ranking / scoring schema
- Remote feature activation

---

## 7. Verdict

Security posture consistent with Phases 01–10. No new high-risk write surfaces.
