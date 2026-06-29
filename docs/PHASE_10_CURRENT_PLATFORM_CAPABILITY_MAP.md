# Phase 10 — Current Platform Capability Map

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  
**Method:** Repository inspection of routes, APIs, lib services, migrations, and existing phase audits. Status reflects wiring and production-readiness evidence, not file presence alone.

**Status legend:** Complete = route + API + persistence actively wired; Partial = embedded, flag-gated, or missing first-class surface; Dormant = redirect/stub only; Legacy = superseded path retained for migration.

**Production use legend:** Confirmed = exercised in phase manual tests or production sign-off docs; Assumed = wired but limited operator confirmation; Unknown = no production telemetry.

---

## Adviser capabilities

| Capability | Persona | Entry point | APIs | Persistence | Status | Production use | Manual work | Known gaps | Dependencies | Risk |
|------------|---------|-------------|------|-------------|--------|----------------|-------------|------------|--------------|------|
| Dashboard (Advisor OS) | Adviser | `/advisor` | `GET /api/advisor/command-center`, `.../heavy`, `.../overview`, `.../review-pipeline`, `.../tasks`, `.../task-suggestions`, `.../file-quality`, `.../notifications` | `clients`, `shield_scores`, `discover_profiles`, `roadmap_items`, `documents`, `stress_tests`, `annual_reviews`, `audit_logs`, `advisor_tasks`, `advisor_notes` | Complete | Confirmed | Adviser scans multiple panels for priorities | No unified work queue; notifications computed not persisted | Auth, adviser assignment | Low |
| Client list | Adviser | `/advisor/clients` | `GET /api/advisor/clients` | `clients`, `shield_scores`, `documents`, `client_budgets`, `adviser_appointments`, `adviser_feedback`, `discover_profiles` | Complete | Confirmed | Filter/search for servicing signals | Servicing badges depend on dual status models | Assignment RLS | Low |
| Client overview | Adviser | `/advisor/clients/[clientId]?tab=overview` | `GET .../command-center`, `.../heavy` | Same as dashboard per client | Complete | Confirmed | Cross-tab navigation for full picture | Tasks, roadmap, meetings not consolidated into one action list | Command center loaders | Low |
| Financial readiness | Adviser | Embedded: overview File Quality, `?tab=dashboard`, planning outputs | `GET .../dashboard`, `GET /api/advisor/file-quality`, publications `financial_readiness_snapshot` | `client_profiles`, `discover_profiles`, `shield_scores`, `pillar_scores`, `published_outputs` | Partial | Assumed | Adviser interprets checklist manually | No dedicated nav item; readiness split across panels | Discover completeness, scoring | Medium |
| Diagnostics (Shield) | Adviser | `/advisor/clients/[clientId]?tab=shield-diagnostic` | `GET .../shield-diagnostic`, `GET|PATCH .../review-status` | `shield_scores`, `pillar_scores`, `clients`, `annual_reviews` | Complete | Confirmed | Review status updates manual | Read-only diagnostic; client cannot see raw scores by default | Scoring engine v1 | Low |
| Stress testing | Adviser | `/advisor/clients/[clientId]?tab=stress-test` | `GET .../stress-tests` | `stress_tests` | Complete | Assumed | Adviser explains results in meetings | Read-only adviser view | Client stress run history | Low |
| Goals | Adviser | Embedded in planning outputs (`goal_plan_summary`), Meeting Studio | `.../publications`, meeting-session APIs | `published_outputs`, `client_goals`, `client_review_submissions`, `advisor_tasks` | Partial | Assumed | Adviser uses publications + meetings for goals | No adviser equivalent of client Goals & Reviews page | Publication workflow | Medium |
| Roadmap | Adviser | Overview panel + `/advisor/clients/[clientId]/roadmap` | `GET|POST .../roadmap-actions`, `PATCH|DELETE .../[actionId]` | `roadmap_items` | Complete | Confirmed | Adviser sets client visibility manually | Engine items default not client-visible | Scoring, 9D presentation | Low |
| Planning outputs | Adviser | `/advisor/clients/[clientId]/planning-outputs` | `GET|POST .../publications`, review/publish/withdraw | `published_outputs` | Complete | Confirmed | Prepare → review → publish manual steps | Prerequisite hints only; no auto-queue | Compliance publication | Medium |
| Meeting preparation | Adviser | Meeting Studio prepare stage, binder `meeting_preparation` | `.../meeting-sessions`, `.../prepare`, binder readiness | `meeting_sessions`, `binder_exports`, `published_outputs` | Partial | Confirmed | Prep embedded in Meeting Studio | No standalone adviser prep page (prospects have `/meeting-preparation`) | Appointments optional | Low |
| Meeting Studio | Adviser | `/advisor/clients/[clientId]/meeting-studio` | Full meeting-session lifecycle APIs | `meeting_sessions`, `meeting_session_events` | Complete | Confirmed | Three-stage workflow manual | Sessions may exist without appointment link | Publications for summaries | Low |
| Meeting packs (Binder) | Adviser | `/advisor/clients/[clientId]?tab=meeting-packs` | `.../binder-export`, `.../binder-exports/**` | `binder_exports`, `documents` | Complete | Confirmed | Section selection and publish manual | Client publication gated by `binder_client_publication` (default off) | Published outputs readiness | Medium |
| Documents | Adviser | `/advisor/clients/[clientId]?tab=document-vault` | `.../documents/upload`, signed-url, delete, save-protection-report | `documents` | Complete | Confirmed | Upload and categorise manually | Category mapping at write time | Storage bucket RLS | Low |
| Calendar | Adviser | `/advisor/my-profile?section=calendar` | `/api/advisor/calendar/**`, Google callback | `adviser_profiles`, calendar connection tables | Complete | Assumed | Google OAuth setup per adviser | Consolidated under My Profile; `/advisor/calendar` redirects | Google Calendar API | Medium |
| Communications (Insights authoring) | Adviser | `/advisor/insights` | `/api/advisor/insights/**` | `governed_content` | Complete | Confirmed | Draft → submit → admin approve | Legacy Promotions retired (`/advisor/promotions` redirects) | Admin approval queue | Low |
| Follow-up | Adviser | Embedded in `/advisor` and client overview | `/api/advisor/tasks/**`, `.../task-suggestions/**`, `.../notes` | `advisor_tasks`, `advisor_notes` | Complete | Assumed | Promote suggestions to tasks manually | Distributed UX; suggestions not persisted | Task idempotency keys | Low |
| Client servicing | Adviser | Pipeline on dashboard, review panel on shield tab | `/api/advisor/review-pipeline`, `PATCH .../review-status` | `clients`, `annual_reviews`, review pipeline computed | Complete | Assumed | Manual status and review date updates | `clients.status` vs `relationship_stage` dual models | Shield, annual reviews | Medium |
| Appointments | Adviser | `/advisor/appointments` | `/api/advisor/appointments/**` | `adviser_appointments` | Complete | Confirmed | Notification retry manual if failed | No admin scheduling surface | Calendar connection | Low |
| Client feedback | Adviser | `/advisor/feedback` | `/api/advisor/feedback/**` | `adviser_feedback` | Complete | Assumed | Review and publish testimonials | — | Client submission flow | Low |
| Protection report | Adviser | `/advisor/protection-report` | Protection report generation APIs | Scoring + documents | Complete | Assumed | Standalone book tool | Not per-client tab | Discover policies section | Low |

---

## Client capabilities

| Capability | Persona | Entry point | APIs | Persistence | Status | Production use | Manual work | Known gaps | Dependencies | Risk |
|------------|---------|-------------|------|-------------|--------|----------------|-------------|------------|--------------|------|
| Dashboard | Client | `/dashboard` | `/api/dashboard/current`, `/api/client/financial-overview`, `/api/client/entitlements` | `published_outputs`, `discover_profiles`, `clients` | Complete | Confirmed | — | Prospect vs active dual mode; active requires published overview | Entitlements, publications | Low |
| Onboarding (prospect) | Client | `/prospect`, `/discover`, `/discover/submitted` | `/api/prospect/**`, `/api/discover/**` | `discover_profiles`, `financial_profiles`, `clients` | Complete | Confirmed | Complete Discover sections | Submit minimum lower than full completeness | Adviser assignment on convert | Low |
| Financial data | Client | `/discover` (capture); published views only when active | Discover, shield, stress APIs | `discover_profiles` JSONB, scoring tables | Complete / Dormant | Confirmed | Re-enter via Discover | Raw shield/stress gated off for most active clients | Feature flags | Medium |
| Planning views | Client | `/my-plan`, `/budget-optimiser` | `/api/client/my-plan`, `/api/client/published-summaries`, budget APIs | `published_outputs`, `client_budgets` | Complete | Confirmed | — | Empty state when adviser has not published | Publication workflow | Low |
| Goals | Client | `/goals-reviews` | `/api/client/goals-reviews` | `client_goals`, `client_review_submissions` | Complete | Assumed | Submit review forms | Creates adviser tasks; no client task inbox | Active client gate | Low |
| Roadmap | Client | `/roadmap` | `GET /api/client/roadmap`; legacy `/api/roadmap/current` | `roadmap_items` | Complete / Partial | Assumed | Status updates on visible items only | Legacy fallback path still present | Adviser visibility flags | Medium |
| Documents | Client | `/document-vault` | `/api/documents/**` | `documents` | Complete | Confirmed | Upload requested docs | Prospect limited mode | Category validation | Low |
| Meeting packs | Client | Via document vault (`meeting-pack.pdf`) | Indirect via documents; adviser binder APIs | `binder_exports`, `documents` | Partial | Unknown | Adviser publishes pack manually | No client nav item; flag `binder_client_publication` default false | Binder generation | Medium |
| Adviser access | Client | `/my-adviser`, `/profile` panel | `/api/my-adviser`, `/api/my-adviser/book` | `adviser_profiles`, `adviser_appointments` | Complete | Confirmed | Book/cancel appointments | Depends on adviser calendar setup | Google Calendar | Low |
| Appointments | Client | Embedded in `/my-adviser`, `/meeting-preparation` | `POST|DELETE /api/my-adviser/book` | `adviser_appointments` | Complete | Confirmed | — | 409/503 when unavailable | Calendar integration | Low |
| Notifications | Client | Panel on `/insights` (not standalone nav) | `/api/client/notifications/**` | `client_notifications` | Complete | Assumed | Mark read in UI | Gated by `client_in_app_notifications`; no email prefs UI | Lifecycle notifications 9F.2 | Low |
| Insights | Client | `/insights` | `/api/client/insights/**` | `governed_content`, `communication_deliveries` | Complete | Confirmed | — | Legacy `/promotions` redirects here | Preference filtering | Low |
| Communication preferences | Client | **None** | `/api/client/communication-preferences` | `communication_preferences` | Partial | Unknown | Operator must use API/SQL | **No client UI** | Feature flag | Medium |
| Meeting preparation (prospect) | Client | `/meeting-preparation` | `/api/prospect/meeting-preparation` | Appointments, discover | Complete | Assumed | — | Prospect-only route | Entitlements | Low |
| Profile | Client | `/profile` | Profile APIs | `users`, `clients` | Complete | Assumed | Complete account record | Labeled Phase 3F in UI | Auth | Low |

---

## Admin capabilities

| Capability | Persona | Entry point | APIs | Persistence | Status | Production use | Manual work | Known gaps | Dependencies | Risk |
|------------|---------|-------------|------|-------------|--------|----------------|-------------|------------|--------------|------|
| User and access management | Admin | `/admin` | `/api/admin/users/**`, `/api/admin/clients/**`, `/api/admin/client-invitations` | `users`, `clients` | Complete | Confirmed | Assign advisers, invite clients | Relationship-stage API has **no admin UI** | RLS, assignment | Low |
| Feature controls | Admin | **None** | `/api/admin/feature-controls` | `platform_feature_controls` | Partial | Assumed | Patch via API or SQL | **No admin UI** for 20+ kill switches | Audit on change | High |
| Governed-content approval | Admin | `/admin/communications` | `/api/admin/communications/**` | `governed_content` | Complete | Confirmed | Admin acts as approver (no compliance role) | Backlog monitoring manual | `admin_content_approval` flag | Medium |
| Scheduling (content automation) | Admin | `/admin/communications/automation` | `/api/admin/jobs/**` | `automation_job_runs`, `governed_content` | Complete | Assumed | Manual job run if cron absent | `scheduled_content_automation` default false; not in `vercel.json` crons | CRON_SECRET | Medium |
| Deliveries | Admin | **None** | `/api/admin/communication-deliveries` | `communication_deliveries` | Partial | Unknown | SQL/API inspection | **No admin UI** | Email provider | Medium |
| Migration review (Promotions) | Admin | `/admin/promotions-migration` | `/api/admin/promotions-migration/**` | `promotions`, `promotion_migration_reviews` | Complete | Confirmed | One-time legacy migration | Runtime gate may block migrate | Phase 9F.4 observation | Low |
| Audits | Admin | **None** | Write-only via `writeAuditLog()` | `audit_logs` | Partial | Assumed | Manual SQL per `AUDIT_LOG_REVIEW.md` | **No read surface or viewer UI** | Service role writes | Medium |
| Operational diagnostics | Admin | `/supabase-health`, automation page | `/api/health/**`, `/api/admin/jobs/runs` | Health probe tables | Partial | Assumed | Weekly manual checks | No unified ops dashboard; health shallow | Env config | Medium |

---

## Cross-cutting observations

1. **Publication governance** is the primary client-safe content path (`published_outputs`); most client financial/planning views depend on adviser publish actions.
2. **Adviser operational UX** is feature-rich but **federated** — dashboard, tasks, suggestions, review pipeline, roadmap, and meetings are separate stores without a canonical queue.
3. **Admin ops surfaces** lag APIs: feature controls, delivery monitoring, and audit viewing require direct API/SQL access.
4. **Phase 9F.4 observation** (30 days) is active; legacy Promotions schema retained; no Stage 6 schema retirement in this checkpoint.
5. **Feature flags** default conservatively (`binder_client_publication`, `raw_client_financial_views`, `scheduled_content_automation` off).

---

## Capability coverage summary

| Persona | Complete | Partial | Dormant/Legacy |
|---------|----------|---------|----------------|
| Adviser | 14 | 5 | 1 (Promotions redirect) |
| Client | 11 | 4 | 2 (raw diagnostics, promotions) |
| Admin | 4 | 4 | 0 |

**Highest-risk gaps for Phase 10 planning:** admin feature-control UI absence, disconnected adviser work items (**work queue domain implemented in 10.2 — UI pending 10.3**), client communication preferences UI absence, dual client lifecycle enums (`status` vs `relationship_stage`).
