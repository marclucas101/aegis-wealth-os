# Phase 9C — Meeting Studio Architecture Audit

Audit date: 2026-06-20. Scope: adviser meeting workflow prior to Meeting Studio implementation.

## Summary

The adviser client workspace (`AdvisorClientWorkspace`) provides full internal analysis. **Adviser-visible data is not automatically suitable for client presentation.** Meeting Studio introduces a controlled Prepare → Present → Close workflow with allowlisted `meeting_presentation` DTOs.

---

## Feature audit matrix

| Feature | Route / component | Adviser-internal | Safe for presentation | Internal-only content | Reuse | Transformation | Meeting Studio section |
|---------|-------------------|------------------|----------------------|----------------------|-------|----------------|------------------------|
| Client workspace | `app/advisor/clients/[clientId]/page.tsx` + `AdvisorClientWorkspace` | Yes | No | Full command center, notes, tasks | Shell only | N/A — stay outside presentation | Prepare context |
| Dashboard (Phase 8C) | `AdvisorClientDashboardPanel` / `GET .../dashboard` | Yes | Partial | Raw scores, AWRI, benchmarks | Yes — internal in Prepare | `financial_foundation` DTO | `financial_foundation` |
| Shield Diagnostic | `AdvisorClientShieldDiagnosticPanel` / `GET .../shield-diagnostic` | Yes | Partial | Coefficients, product logic, raw scores | Yes — internal in Prepare | `protection_resilience` presentation DTO | `protection_resilience` |
| Stress Test | `AdvisorClientStressTestsPanel` / `GET .../stress-tests` | Yes | Partial | Full engine output, recommendations | Engine unchanged; adviser selects scenarios | `scenario_education` DTO | `scenario_education` |
| Financial profile | `AdvisorClientPersonalPanel`, `AdvisorClientScorePanel` | Yes | Partial | Discover score, raw profile | Facts via canonical discover model | Fact confirmation workflow | `facts_and_assumptions` |
| Budget | `AdvisorClientBudgetPanel` | Yes | No | Detailed line items | No in presentation | Broad cash-flow only | `financial_foundation` |
| Protection reports | `AdvisorClientReportsPanel` | Yes | No | Full report PDFs | Link from Prepare only | Publication workflow for client copy | N/A in live presentation |
| Document vault | `AdvisorClientDocumentsPanel` | Yes | No | All document metadata | Checklist in Prepare | Checklist only | Prepare checklist |
| Appointments | `AdvisorClientAppointmentsPanel` / `adviser_appointments` | Yes | Partial | Internal notes | Link to session | Display time/format only | Prepare header |
| Notes | `AdvisorClientNotesPanel` | Yes | **No** | All adviser notes | Never in presentation | Separate close-out fields | `adviser_observations` (meeting-visible only) |
| Tasks | `AdvisorClientTasksPanel` | Yes | Partial | Internal assignments | Create on close | Client-safe task labels | `next_steps` |
| Task suggestions | `AdvisorClientTaskSuggestionsPanel` | Yes | **No** | Internal suggestions | Never in presentation | N/A | N/A |
| Annual review | `AdvisorClientReviewPanel` / print routes | Yes | No | Full review content | Publication path only | `annual_review_summary` via 9A | N/A |
| Wealth blueprint | Print routes / adviser reports | Yes | No | Full blueprint | Publication path only | `wealth_blueprint_summary` via 9A | N/A |
| Publication workflow | `GET/POST .../publications` | Adviser | When published | Draft/review payloads | Yes | `meeting_presentation` audience | Close — optional publication |
| Prospect meeting prep (9B) | `app/meeting-preparation` | Client (prospect) | N/A | N/A | Separate journey | Not merged into adviser studio | N/A |
| Relationship stage | `relationship_stage` column + APIs | Server | Stage label only | Transition rules | Yes | Server-side on completion | Prepare + completion |
| Feature controls | `platform_feature_controls` | Admin | N/A | All flags | Extended for 9C | Fail-closed gates | All stages |
| Audit logs | `audit_logs` + `meeting_session_events` | Admin/adviser | N/A | Metadata only | Extended | Privacy-conscious refs | All writes |

---

## Security observations

1. **No client routes** for meeting sessions, presentation payloads, or meeting history.
2. **Assignment revalidated** on every API via `resolveAccessibleClient` + `assertMeetingSessionAccess`.
3. **Presentation DTOs** are allowlisted in `meetingPresentationDtos.ts` — raw internal objects never returned.
4. **Completed sessions** are immutable except explicit amendment (deferred to later phases).
5. **Phase 8C financial views** remain independent of Meeting Studio feature flags.

---

## Gaps addressed by Phase 9C

- No prior meeting-session model → `meeting_sessions` table
- No controlled presentation mode → full-screen `MeetingStudioClient` present stage
- No fact confirmation during meetings → `meetingFactConfirmation.ts`
- No meeting summary lifecycle → `summary_status` + adviser-only draft
- No adviser meeting history in workspace → `MeetingStudioHistoryPanel`
