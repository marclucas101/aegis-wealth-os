# Phase 9C — Security and Privacy Review

Acceptance review date: 2026-06-20. Branch: `phase-9c-meeting-studio`.

## Executive summary

Meeting Studio is **adviser-controlled only**. No client APIs, no public presentation links, no share tokens. All writes go through server routes using `requireAdvisorAccess()` (via `requireAdvisorMeetingAuth`), assignment revalidation, rate limiting, and privacy-conscious audit metadata.

---

## 1. API security inventory

| Route | Methods | Purpose | Auth | Assignment | Rate limit | Audit |
|-------|---------|---------|------|------------|------------|-------|
| `.../meeting-sessions` | GET | List sessions + preparation context | ✓ | ✓ | — | — |
| `.../meeting-sessions` | POST | Create session | ✓ | ✓ | ✓ | ✓ |
| `.../meeting-sessions/[sessionId]` | GET | Load session | ✓ | ✓ | — | — |
| `.../meeting-sessions/[sessionId]` | PATCH | Save close state (allowlisted keys) | ✓ | ✓ | ✓ | — |
| `.../meeting-sessions/[sessionId]/prepare` | POST | Save preparation + scenarios | ✓ | ✓ | ✓ | ✓ |
| `.../meeting-sessions/[sessionId]/start` | POST | Start meeting (prepared→in_progress) | ✓ | ✓ | ✓ | ✓ |
| `.../meeting-sessions/[sessionId]/presentation` | GET | Allowlisted presentation DTO | ✓ | ✓ | — | — |
| `.../meeting-sessions/[sessionId]/section-shown` | POST | Record section reveal | ✓ | ✓ | ✓ | ✓ |
| `.../meeting-sessions/[sessionId]/confirm-fact` | POST | Confirm/correct canonical facts | ✓ | ✓ | ✓ | ✓ |
| `.../meeting-sessions/[sessionId]/record-acknowledgement` | POST | Record approved acknowledgement | ✓ | ✓ | ✓ | ✓ |
| `.../meeting-sessions/[sessionId]/complete` | POST | Complete meeting (idempotent) | ✓ | ✓ | ✓ | ✓ |
| `.../meeting-sessions/[sessionId]/prepare-summary` | POST | Draft adviser-only summary | ✓ | ✓ | ✓ | ✓ |

Denial responses return `{ ok: false, reason | error }` only — no partial client payloads.

Presentation GET sets `Cache-Control: private, no-store, max-age=0, must-revalidate`.

---

## 2. RLS model

**Tables:** `meeting_sessions`, `meeting_session_events`

| Actor | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| Client (authenticated) | Denied (no policy) | Denied | Denied | Denied |
| Assigned adviser (direct DB) | Allowed via `is_assigned_advisor(client_id)` | Denied | Denied | Denied |
| Admin (direct DB) | Allowed via `is_admin()` | Denied | Denied | Denied |
| Service role (API layer) | Bypass RLS | All writes | All writes | Cascade only |

**Intentional design:** All mutations occur via service-role API routes with assignment revalidation. No `authenticated USING (true)` policies. No client `owns_client()` policies on meeting tables.

Foreign keys: `client_id → clients`, `adviser_user_id → users`, `appointment_id → adviser_appointments`.

---

## 3. Appointment linkage

`dbValidateAppointmentForClient` verifies:

- Appointment exists
- `client_id` matches session client
- `adviser_user_id` matches assigned adviser
- Status is not `cancelled`

Browser-provided appointment IDs cannot cross client/adviser boundaries.

---

## 4. Lifecycle and concurrency

Central helper: `lib/compliance/meetingSessionLifecycle.ts`

Allowed transitions:

- `draft → prepared | cancelled`
- `prepared → in_progress | cancelled | archived`
- `in_progress → completed | cancelled`
- `cancelled → archived`

Rejected: `draft → completed`, `completed → in_progress`, etc.

Optimistic concurrency: `dbUpdateMeetingSession(..., { expectedStatus })` prevents duplicate start/complete under simultaneous requests.

Start is idempotent when already `in_progress`. Complete is idempotent when already `completed`.

---

## 5. Completed-session immutability

Enforced at:

- Workflow: `assertSessionMutable` / `IMMUTABLE_MEETING_STATUSES`
- Lifecycle: `assertSessionPatchAllowed` blocks immutable JSON fields
- Persistence: reload + reject updates when status is `completed` or `archived`
- API PATCH: explicit 400 for completed sessions

---

## 6. Presentation DTO safety

- Explicit allowlist in `meetingPresentationDtos.ts`
- No spread of raw Dashboard/Shield/Stress objects
- Prohibited nested keys rejected (`internalNotes`, `modelCoefficients`, etc.)
- `staleAnalysisWarning` when `requires_analysis_refresh`
- Negative tests: `scripts/meeting-presentation-dto-negative-tests.ts`

---

## 7. Analysis refresh policy

When material facts are corrected:

- `requires_analysis_refresh = true` on session
- Meeting snapshot (`data_snapshot_version`) preserved
- Presentation continues with visible `staleAnalysisWarning`
- No automatic client publication or recalculation in Meeting Studio

Documented in workflow as `ANALYSIS_REFRESH_POLICY`.

---

## 8. Audience separation

| Store | Field | Presentation | Client published |
|-------|-------|--------------|------------------|
| Internal adviser notes | `close_state.internalAdviserNotes` | Never | Never |
| Meeting-visible observations | `close_state.meetingVisibleObservations` | Selected sections | Only via publication |
| Client-safe summary | `close_state.clientSafeSummaryText` | Never | Phase 9A review required |

`sanitizeCloseStatePatch` rejects non-allowlisted keys.

---

## 9. Feature controls (fail-closed)

| Key | Code default | Migration seed | Admin | Client |
|-----|--------------|----------------|-------|--------|
| `adviser_meeting_studio` | on | on | override | hidden |
| `meeting_presentation_mode` | on | on | override | hidden |
| `meeting_exact_amount_presentations` | **off** | **off** | override | hidden |
| `meeting_client_acknowledgements` | on | on | override | hidden |
| `meeting_summary_publication` | on | on | override | hidden |

DB unavailable → code defaults in `featureFlags.ts` (fail-closed for restricted features).

Phase 8C adviser financial views remain independent of Meeting Studio flags.

---

## 10. Audit privacy

`sanitizeMeetingAuditMetadata` blocks sensitive keys (income, assets, notes, scenario results, etc.).

Events record references: `fieldKey`, `sectionType`, `scenarioKey`, `itemKey`, counts — not raw financial payloads.

---

## 11. Remaining human staging tests

- Device testing: iPad landscape presentation readability and exit control
- Simultaneous completion from two browser tabs (verify single summary)
- Admin disable `adviser_meeting_studio` in staging and confirm 503
- Assignment revocation mid-session (reassign client, retry presentation API)

---

## 12. Remaining compliance-review items

- Formal legal review of acknowledgement wording (non-binding confirmation)
- Firm policy sign-off on exact-amount presentation when enabled
- Phase 9E binder export integration for meeting summaries
