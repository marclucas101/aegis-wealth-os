# CRM V2 Phase 14 — Adviser Feature Parity Inventory

**Branch:** `crm-v2-14-cutover` (or current working branch)  
**Type:** Audit inventory (no schema changes)  
**Status:** Complete — codebase audit as of Phase 14 implementation  
**Verdict:** Legacy adviser capabilities preserved; CRM V2 native areas linked; client-context tools routed via client roster.

---

## Purpose

Document every important legacy adviser capability, its actual route and API surface, and how it is reached from CRM V2 after Phase 14 adviser workspace replacement.

Routes were verified in the repository — no invented URLs.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Native CRM V2** | Implemented under `/advisor-v2/*` with CRM V2 gates |
| **Linked from CRM V2** | Preserved legacy route linked in CRM V2 **More → Classic tools** |
| **Classic fallback only** | Available at `/advisor/classic` or legacy sub-routes without CRM V2 nav link |
| **Missing / requires follow-up** | Not yet linked or no standalone route |

---

## Feature parity table

| Legacy feature | Existing route | Existing API(s) | Existing component(s) | CRM V2 destination | Status |
|----------------|----------------|-----------------|----------------------|----------------------|--------|
| **Adviser command centre (classic home)** | `/advisor/classic` | `GET /api/advisor/command-center`, `GET /api/advisor/command-center/heavy` | `ClassicAdvisorWorkspace`, `AdvisorDashboardClient` | More → Classic Adviser Workspace | Linked from CRM V2 |
| **CRM V2 adviser home** | `/advisor` (pilot), `/advisor-v2` (alias) | `GET /api/advisor-v2/shell` | `AdviserCrmV2Shell`, `AdviserCrmV2LandingContent` | Home (`/advisor`) | Native CRM V2 |
| **Protection report generator** | `/advisor/protection-report` | `POST /api/advisor/clients/[clientId]/documents/save-protection-report` | `ProtectionReportClient`, `ProtectionReportPreview` | More → Protection Report Generator | Linked from CRM V2 |
| **Protection reports (per client)** | `/advisor/clients/[clientId]?tab=protection-reports` | Same save API + client document APIs | `AdvisorClientReportsPanel`, `AdvisorClientWorkspace` | More → Document Vault / client file | Linked from CRM V2 (via `/advisor/clients`) |
| **Protection portfolio (CRM V2)** | `/advisor-v2/relationships/[relationshipId]/protection` | `GET/POST /api/advisor-v2/relationships/[id]/protection/*` | CRM V2 protection workspace pages | Relationships → Protection tab | Native CRM V2 |
| **Shield diagnostic / AEGIS diagnostic** | `/advisor/clients/[clientId]?tab=shield-diagnostic` | `GET /api/advisor/clients/[clientId]/shield-diagnostic` | `AdvisorClientShieldDiagnosticPanel` | More → Shield Diagnostic (→ client roster) | Linked from CRM V2 |
| **Scoring engine / Shield Score / AWRI** | `/advisor/clients/[clientId]` (overview + score panels) | Client command-center APIs, scoring via shield diagnostic | `AdvisorClientScorePanel`, `ShieldScoreCard`, `AdvisorCommandMetrics` | Classic workspace + client file | Linked from CRM V2 (via client roster / classic) |
| **Stress test** | `/advisor/clients/[clientId]?tab=stress-test` | `GET/POST /api/advisor/clients/[clientId]/stress-tests` | `AdvisorClientStressTestsPanel`, `AdvisorClientStressPanel` | More → Stress Test (→ client roster) | Linked from CRM V2 |
| **Planning roadmap** | `/advisor/clients/[clientId]/roadmap`, `?tab=meeting-packs` | `GET/POST /api/advisor/clients/[clientId]/roadmap-actions`, `[actionId]` | `AdvisorClientRoadmapEditor`, `AdvisorClientRoadmapPanel` | More → Planning & Roadmap (→ client roster) | Linked from CRM V2 |
| **Planning outputs** | `/advisor/clients/[clientId]/planning-outputs` | Publications/review APIs under `/api/advisor/clients/[clientId]/publications/*` | `AdvisorPlanningOutputsClient` | More → Planning Outputs (→ client roster) | Linked from CRM V2 |
| **Client binder** | `/advisor/clients/[clientId]?tab=meeting-packs` | `/api/advisor/clients/[clientId]/binder-export`, `binder-exports/*` | `AdvisorClientBinderPanel` | More → Client Binder (→ client roster) | Linked from CRM V2 |
| **Document vault** | `/advisor/clients/[clientId]?tab=document-vault` | `/api/advisor/clients/[clientId]/documents/*` | `AdvisorClientDocumentsPanel` | More → Document Vault (→ client roster) | Linked from CRM V2 |
| **Meeting Studio** | `/advisor/clients/[clientId]/meeting-studio`, `.../present` | `/api/advisor/clients/[clientId]/meeting-sessions/*` | `MeetingStudioClient`, `MeetingStudioHistoryPanel` | More → Meeting Studio (→ client roster) | Linked from CRM V2 |
| **Governed content / insights authoring** | `/advisor/insights` | `GET/POST /api/advisor/insights`, `[contentId]/submit` | `AdviserInsightsManagerClient` | More → Insights Authoring | Linked from CRM V2 |
| **Communications (CRM V2 bridge)** | `/advisor-v2/communications` | `/api/advisor-v2/communications/*` | CRM V2 communications pages | Primary nav → Communications | Native CRM V2 |
| **Templates** | `/advisor-v2/templates` | CRM V2 templates APIs (if enabled) | CRM V2 templates page | More → Templates | Native CRM V2 |
| **Reports (CRM V2)** | `/advisor-v2/reports` | `/api/advisor-v2/reports/*` | CRM V2 reports page | More → Reports | Native CRM V2 |
| **Legacy wealth / annual review prints** | `/advisor/clients/[clientId]/reports/wealth-blueprints/[blueprintId]/print`, `.../annual-reviews/[reviewId]/print` | `/api/advisor/clients/[clientId]/reports/wealth-blueprints/*`, `annual-reviews/*` | `AdvisorReportViewer`, print pages | More → Wealth Blueprint Print / Annual Review Print (→ client roster) | Linked from CRM V2 |
| **Operations (CRM V2)** | `/advisor-v2/operations` | `/api/advisor-v2/operations/*` | CRM V2 operations page | More → Operations | Native CRM V2 |
| **Google Calendar operations** | `/advisor-v2/operations/google-calendar` | CRM V2 Google Calendar service + sync APIs | Google Calendar operations page | More → Google Calendar Operations | Linked from CRM V2 |
| **Google Calendar connect (manual)** | `/advisor/my-profile?section=calendar` (alias `/advisor/calendar` → redirect) | `/api/advisor/calendar/connect`, `disconnect`, `status`, `settings` | `MyProfileWorkspace`, `CalendarConnectionTab` | More → Google Calendar Setup | Linked from CRM V2 |
| **Today / work queue (CRM V2)** | `/advisor-v2/today` | `GET /api/advisor-v2/today`, `work-queue` | `AdviserTodayClient` | Primary nav → Today | Native CRM V2 |
| **Today (classic dashboard section)** | `/advisor/classic` (#advisor-today) | `GET /api/advisor/command-center/heavy` | `AdvisorTodayPanel` | Classic Adviser Workspace | Classic fallback only |
| **Relationship 360** | `/advisor-v2/relationships/[relationshipId]` | `/api/advisor-v2/relationships/*` | CRM V2 relationship pages | Primary nav → Relationships | Native CRM V2 |
| **Legacy client roster** | `/advisor/clients` | `GET /api/advisor/clients` | `MyClientsListClient`, `MyClientsTable` | More → Shield/Binder/Vault/Meeting Studio entry | Linked from CRM V2 |
| **Legacy client file / 360** | `/advisor/clients/[clientId]` | `GET /api/advisor/clients/[clientId]/command-center`, `heavy` | `AdvisorClientWorkspace` | Client roster (classic) | Classic fallback only |
| **Appointments (CRM V2)** | `/advisor-v2/appointments`, `/new`, `[appointmentId]` | `/api/advisor-v2/appointments/*` | CRM V2 appointment pages | Primary nav → Appointments | Native CRM V2 |
| **Appointments (legacy)** | `/advisor/appointments` | `/api/advisor/appointments/*` | `AppointmentsManagerClient` | More → Legacy Appointments | Linked from CRM V2 |
| **Service requests / commitments** | `/advisor-v2/service` | `/api/advisor-v2/service/*`, commitments APIs | CRM V2 service pages | Primary nav → Service | Native CRM V2 |
| **Tasks / work queue (legacy)** | `/advisor/classic` (#advisor-tasks) | `/api/advisor/tasks`, `task-suggestions/*` | `AdvisorTaskPanel`, `AdvisorTaskSuggestionsPanel` | More → Tasks & Follow-ups (classic workspace) | Linked from CRM V2 |
| **Review pipeline** | `/advisor/classic` (#advisor-review-pipeline) | `GET /api/advisor/review-pipeline` | `AdvisorReviewPipelinePanel` | More → Review Pipeline (classic workspace) | Linked from CRM V2 |
| **Client profile / preferences (CRM V2 client)** | Client portal `/preferences` (not adviser) | Client profile APIs | Client preferences pages | N/A — client portal only | Not adviser CRM V2 |
| **Relationship moments** | `/advisor-v2/relationships/[relationshipId]/moments` | `/api/advisor-v2/relationships/[id]/moments/*` | CRM V2 moments pages | Relationships → Moments | Native CRM V2 |
| **Advocacy** | `/advisor-v2/relationships/[relationshipId]/advocacy` | `/api/advisor-v2/relationships/[id]/advocacy/*` | CRM V2 advocacy pages | Relationships → Advocacy | Native CRM V2 |
| **Client feedback review** | `/advisor/feedback` | `/api/advisor/feedback/*` | `AdvisorFeedbackReviewClient` | More → Client Feedback | Linked from CRM V2 |
| **Adviser profile & booking setup** | `/advisor/my-profile`, `/advisor/setup` (→ profile redirect) | `/api/advisor/profile`, `profile/photo` | `MyProfileWorkspace` | More → Adviser Profile; Google Calendar Setup | Linked from CRM V2 |
| **Book health / file quality** | `/advisor/classic` | `/api/advisor/file-quality`, per-client file-quality | `AdvisorBookHealthPanel`, `AdvisorBookQualityPanel` | More → Book Health & File Quality (classic workspace) | Linked from CRM V2 |
| **Client onboarding / placeholders** | `/advisor/classic` (#advisor-onboarding) | `POST /api/advisor/clients/create-placeholder`, invitations | `AdvisorClientOnboardingPanel` | More → Client Onboarding (classic workspace) | Linked from CRM V2 |
| **Legacy promotions** | `/advisor/promotions` (retired redirect) | Retired — redirects to insights | `LegacyPromotionsRetiredNotice` | Retired | N/A |

---

## CRM V2 navigation mapping (Phase 14)

### Primary nav (native)

- Home → `/advisor`
- Today → `/advisor-v2/today`
- Relationships → `/advisor-v2/relationships`
- Appointments → `/advisor-v2/appointments`
- Service → `/advisor-v2/service`
- Communications → `/advisor-v2/communications`

### More → CRM V2

- Reports → `/advisor-v2/reports`
- Operations → `/advisor-v2/operations`
- Templates → `/advisor-v2/templates`
- Settings → `/advisor-v2/settings`

### More → Classic tools (Phase 14.1 complete)

- Protection Report Generator → `/advisor/protection-report`
- Shield Diagnostic → `/advisor/clients` (open from client file)
- Stress Test → `/advisor/clients` (open from client file)
- Planning & Roadmap → `/advisor/clients`
- Planning Outputs → `/advisor/clients` (open from client file)
- Client Binder → `/advisor/clients`
- Document Vault → `/advisor/clients`
- Meeting Studio → `/advisor/clients`
- Wealth Blueprint Print → `/advisor/clients` (open from client file)
- Annual Review Print → `/advisor/clients` (open from client file)
- Insights Authoring → `/advisor/insights`
- Client Feedback → `/advisor/feedback`
- Legacy Appointments → `/advisor/appointments`
- Review Pipeline → `/advisor/classic#advisor-review-pipeline`
- Client Onboarding → `/advisor/classic#advisor-onboarding`
- Book Health & File Quality → `/advisor/classic`
- Tasks & Follow-ups → `/advisor/classic#advisor-tasks`
- Adviser Profile → `/advisor/my-profile`
- Google Calendar Setup → `/advisor/my-profile?section=calendar`
- Google Calendar Operations → `/advisor-v2/operations/google-calendar`
- Classic Adviser Workspace → `/advisor/classic`

---

## Phase 14.1 Navigation Completeness

**Purpose:** Close gaps in CRM V2 **More → Classic tools** before Phase 14 commit.

### Tools added to More (Phase 14.1)

| Tool | CRM V2 link | Entry route |
|------|-------------|-------------|
| Client Feedback | More → Client Feedback | `/advisor/feedback` |
| Stress Test | More → Stress Test | `/advisor/clients` |
| Planning Outputs | More → Planning Outputs | `/advisor/clients` |
| Review Pipeline | More → Review Pipeline | `/advisor/classic#advisor-review-pipeline` |
| Client Onboarding | More → Client Onboarding | `/advisor/classic#advisor-onboarding` |
| Book Health & File Quality | More → Book Health & File Quality | `/advisor/classic` |
| Tasks & Follow-ups | More → Tasks & Follow-ups | `/advisor/classic#advisor-tasks` |
| Wealth Blueprint Print | More → Wealth Blueprint Print | `/advisor/clients` |
| Annual Review Print | More → Annual Review Print | `/advisor/clients` |
| Adviser Profile | More → Adviser Profile | `/advisor/my-profile` |

Nav link descriptions (tooltips) clarify client-file vs classic-workspace entry.

### Tools that remain accessible only through classic UI sections

| Tool | Why not a direct standalone link |
|------|-----------------------------------|
| Book health panels (detail) | No dedicated route — panels render on classic dashboard only; nav links to `/advisor/classic` |
| Per-client file quality detail | Client-context only — open client file from `/advisor/clients` |
| Print views (wealth blueprint / annual review) | Require `clientId` + report id — nav routes to client roster; adviser opens client file → reports |
| Planning outputs editor | Sub-route `/advisor/clients/[clientId]/planning-outputs` — nav routes to roster first |
| Stress test / Shield diagnostic tabs | Client-context tabs — nav routes to roster with tooltip guidance |
| Legacy promotions | Retired — `/advisor/promotions` redirects; not linked |

### Items that could not be directly deep-linked

No fake client IDs are used. Client-context workflows use `/advisor/clients` as the safe entry point. Classic-dashboard workflows use `/advisor/classic` with verified section anchors where they exist (`#advisor-review-pipeline`, `#advisor-onboarding`, `#advisor-tasks`).

---

## Items requiring follow-up (post Phase 14.1)

| Item | Gap | Recommended follow-up |
|------|-----|----------------------|
| Native CRM V2 book health | Classic dashboard only | Project into CRM V2 Today or Operations when ready |
| Client-context deep links | Roster-first routing | Optional relationship-scoped deep links from CRM V2 Relationship 360 |
| Legacy route prefix unification | `/advisor-v2/*` sub-routes | Future route migration phase |

---

## Explicit non-goals (Phase 14)

- No legacy route deletion
- No schema migrations
- No scoring / advice / protection calculation changes
- No client portal promotion or global CRM V2 exposure

---

## Related documents

- [CRM_V2_PHASE_14_ADVISER_WORKSPACE_REPLACEMENT.md](./CRM_V2_PHASE_14_ADVISER_WORKSPACE_REPLACEMENT.md)
- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
