# Phase 10 — Adviser Journey Audit

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  
**Evidence base:** Route map, command-center services, prospect/active client workflows, phase 9B–9F audits.

---

## Journey overview

```text
prospect → onboarding → data collection → diagnostic → planning →
recommendation preparation → client meeting → agreed actions →
implementation → follow-up → review → ongoing servicing
```

This audit traces each stage against actual AEGIS screens and persistence. External tools (spreadsheets, WhatsApp, external CRM) are noted only where repository evidence shows a gap AEGIS does not cover.

---

## Stage 1 — Prospect

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Create placeholder client (`/advisor/clients` or admin), monitor prospect pipeline on Advisor OS, review Discover submission tasks |
| **Client actions** | Access `/prospect`, complete `/discover`, view `/dashboard` snapshot |
| **AEGIS screen** | Adviser: `/advisor` pipeline + client overview; Client: prospect nav |
| **Source of truth** | `clients.relationship_stage = prospect`, `discover_profiles.form_data`, `clients.status` |
| **Manual duplication** | Adviser may track prospects outside AEGIS if placeholder not created early — no CRM import |
| **Missing handoff** | No automated alert when prospect completes Discover beyond `advisor_tasks` from submit |
| **Status visibility** | Pipeline panel shows onboarding/prospect counts; per-client discover completeness on overview |
| **Reminders** | Task suggestions for incomplete discover; no persisted adviser notification log |
| **Bottleneck** | Placeholder client creation is manual |
| **Compliance** | Prospect sees governed snapshot only; raw diagnostics gated |
| **Automation opportunity** | Auto-create task + pipeline badge on discover submit (partially exists) |

---

## Stage 2 — Onboarding

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Assign adviser (admin), convert relationship stage, review file quality checklist |
| **Client actions** | Continue Discover, upload documents, book adviser via `/my-adviser` |
| **AEGIS screen** | Client `/discover`, `/document-vault`; Adviser client overview File Quality |
| **Source of truth** | `discover_profiles.completeness`, `documents`, `clients.relationship_stage` |
| **Manual duplication** | Adviser may re-key data from email/PDF if client uploads offline |
| **Missing handoff** | Relationship stage promotion requires adviser/admin action — not client self-service |
| **Status visibility** | File quality score on overview; onboarding count on dashboard |
| **Reminders** | Computed task suggestions for missing sections |
| **Bottleneck** | Stage promotion and adviser assignment are operator-driven |
| **Compliance** | Minimum submit bar lower than full 11-section completeness (`prospectSubmission.ts`) |
| **Automation opportunity** | Onboarding checklist queue with due dates |

---

## Stage 3 — Data collection

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Review Discover data read-only, request documents, upload on behalf via document vault |
| **Client actions** | Edit Discover (`POST /api/discover/save`), upload to vault |
| **AEGIS screen** | Adviser: client tabs (overview, document-vault); Client: `/discover`, `/document-vault` |
| **Source of truth** | **`discover_profiles.form_data` JSONB** (authoritative for financial domains) |
| **Manual duplication** | **Budget Optimiser** (`client_budgets`) parallel to Discover expenses — not synced |
| **Missing handoff** | No per-domain adviser edit API; monolithic Discover save only |
| **Status visibility** | Completeness scores per section; file quality checklist |
| **Reminders** | Suggestions for missing policies, income, etc. |
| **Bottleneck** | Large Discover wizard; adviser cannot patch single domain |
| **Compliance** | Client-entered data; adviser validates in meetings |
| **Automation opportunity** | Targeted data-refresh requests (not implemented) |

**External tool evidence:** Repository provides no import for bank statements or policy feeds — advisers likely use email/spreadsheet for offline collection when clients do not use Discover.

---

## Stage 4 — Diagnostic

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | View shield diagnostic tab, interpret pillar scores, update review status |
| **Client actions** | Prospect may see snapshot; active clients blocked from raw shield by default |
| **AEGIS screen** | Adviser: `?tab=shield-diagnostic`; Client: published readiness snapshot only |
| **Source of truth** | `shield_scores`, `pillar_scores` (derived from Discover on save/submit) |
| **Manual duplication** | Adviser may maintain separate risk notes in `advisor_notes` |
| **Missing handoff** | Diagnostic refresh requires client Discover update or adviser-triggered re-score |
| **Status visibility** | Shield score on client list and overview |
| **Reminders** | Stale score not explicitly queued |
| **Bottleneck** | `score_version = 'v1'` static; no scheduled re-diagnostic |
| **Compliance** | Diagnostic is analytical not recommendation; governed outputs separate |
| **Automation opportunity** | Stale diagnostic flag in work queue |

---

## Stage 5 — Planning

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Prepare planning outputs, edit roadmap, run stress tests (view), budget review |
| **Client actions** | View published plan summaries when active (`/my-plan`) |
| **AEGIS screen** | `/advisor/clients/[id]/planning-outputs`, `/roadmap`, stress tab |
| **Source of truth** | `published_outputs` (client-safe), `roadmap_items`, `wealth_blueprints`/`annual_reviews` (internal snapshots) |
| **Manual duplication** | **Three parallel review artifacts:** client `client_review_submissions`, adviser `annual_reviews`, published `annual_review_summary` |
| **Missing handoff** | Unpublished outputs invisible to client — by design but no client "waiting" state beyond empty copy |
| **Status visibility** | Planning output cards show draft/review/published |
| **Reminders** | No queue for "draft outputs older than N days" |
| **Bottleneck** | Manual prepare → review → publish per output type |
| **Compliance** | Publication workflow with withdraw; prerequisite hints |
| **Automation opportunity** | Unpublished output aging in adviser queue |

---

## Stage 6 — Recommendation preparation

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Meeting Studio prepare, binder section selection, meeting pack generation |
| **Client actions** | Prospect: `/meeting-preparation`; active: await published materials |
| **AEGIS screen** | Meeting Studio prepare stage, meeting-packs tab, planning outputs |
| **Source of truth** | `meeting_sessions`, `binder_exports`, `published_outputs` |
| **Manual duplication** | Adviser may prepare slides/documents outside binder |
| **Missing handoff** | Binder client publication off by default — client may not see pack in vault |
| **Status visibility** | Binder readiness panel; meeting session stage |
| **Reminders** | None for "meeting in 48h, pack not generated" |
| **Bottleneck** | Readiness gating requires multiple published sections |
| **Compliance** | Binder lineage and audit; PDF generation async |
| **Automation opportunity** | Pre-meeting checklist tied to appointment date |

---

## Stage 7 — Client meeting

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Meeting Studio present/close, record acknowledgements, complete session |
| **Client actions** | Attend (in person/video — external); view materials if published |
| **AEGIS screen** | `/advisor/clients/[id]/meeting-studio` |
| **Source of truth** | `meeting_sessions`, `meeting_session_events` |
| **Manual duplication** | Meeting notes may live in `advisor_notes` separately from session events |
| **Missing handoff** | `appointment_id` optional — session may not link to calendar booking |
| **Status visibility** | Meeting history on overview |
| **Reminders** | Appointment notifications with retry; no unified pre-meeting adviser queue |
| **Bottleneck** | Manual stage progression prepare → present → close |
| **Compliance** | Section shown / acknowledgement events audited |
| **Automation opportunity** | Post-meeting auto-task for summary publication |

---

## Stage 8 — Agreed actions

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Create roadmap actions, assign task owner/visibility, create adviser tasks |
| **Client actions** | Update status on client-visible roadmap items; submit goals/review |
| **AEGIS screen** | Roadmap editor, tasks panels, client `/roadmap` |
| **Source of truth** | `roadmap_items`, `advisor_tasks` |
| **Manual duplication** | **Roadmap items and adviser tasks are separate** — same action may exist in both without link |
| **Missing handoff** | No client confirmation capture for agreed actions beyond roadmap status |
| **Status visibility** | Roadmap on both sides; tasks adviser-only |
| **Reminders** | Task due dates; roadmap stall in suggestions |
| **Bottleneck** | Adviser must set `client_visible` on roadmap items |
| **Compliance** | Client-visible actions only when explicitly flagged |
| **Automation opportunity** | Promote meeting close outcomes to roadmap + tasks atomically |

---

## Stage 9 — Implementation

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Track tasks, follow-up notes, document uploads, protection reports |
| **Client actions** | Complete client-owned roadmap items, upload documents |
| **AEGIS screen** | Tasks, document vault, roadmap (both personas) |
| **Source of truth** | `advisor_tasks`, `roadmap_items`, `documents` |
| **Manual duplication** | Implementation progress often tracked externally — AEGIS has no product/policy ledger |
| **Missing handoff** | No implementation milestone entity linking policy placement to roadmap |
| **Status visibility** | Per-client tasks; no book-level "implementation pipeline" |
| **Reminders** | Overdue tasks in command center |
| **Bottleneck** | Disconnected records — adviser checks multiple tabs |
| **Compliance** | Document retention in vault |
| **Automation opportunity** | Implementation status on unified queue |

---

## Stage 10 — Follow-up

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Tasks, notes (follow_up type), task suggestions, communications |
| **Client actions** | Notifications on insights page, roadmap updates |
| **AEGIS screen** | `/advisor` Tasks + Suggested Follow-Ups; client notifications panel |
| **Source of truth** | `advisor_tasks`, computed suggestions/notifications |
| **Manual duplication** | **Adviser notifications not persisted** — recomputed each load; external reminders likely for critical follow-ups |
| **Missing handoff** | Suggestions must be manually promoted to tasks |
| **Status visibility** | Today panel, priority clients |
| **Reminders** | Birthday tasks idempotent; no generic SLA overdue engine |
| **Bottleneck** | No single "follow-up queue" sorted by urgency |
| **Compliance** | Audit on task/note writes |
| **Automation opportunity** | Persisted adviser alert log with SLA |

---

## Stage 11 — Review

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Review pipeline panel, update review status, annual review outputs, binder |
| **Client actions** | `/goals-reviews` submission |
| **AEGIS screen** | Dashboard pipeline, shield review panel, goals-reviews |
| **Source of truth** | `clients.next_review_due`, `clients.status`, `annual_reviews`, `client_review_submissions` |
| **Manual duplication** | Review dates may be tracked in calendar outside AEGIS |
| **Missing handoff** | Client review submission creates task but not full review workflow |
| **Status visibility** | Review due/overdue badges on client list |
| **Reminders** | Review pipeline computed; birthday tasks |
| **Bottleneck** | No annual review preparation checklist automation |
| **Compliance** | Review status manual PATCH |
| **Automation opportunity** | Track C scope (annual review cycle) — partially covered by pipeline |

---

## Stage 12 — Ongoing servicing

| Dimension | Finding |
|-----------|---------|
| **Adviser actions** | Command center monitoring, insights publishing, appointments, file quality |
| **Client actions** | Portal engagement, insights, documents |
| **AEGIS screen** | `/advisor`, client workspace, `/insights` |
| **Source of truth** | Aggregate across clients table, scores, publications, appointments |
| **Manual duplication** | Book-level KPIs may be exported manually — no management reporting UI |
| **Missing handoff** | Servicing state split between `relationship_stage` and legacy `status` |
| **Status visibility** | Overview metrics (`totalClients`, `highRiskClients`, etc.) |
| **Reminders** | Lifecycle notifications (9F.2) for documents/publications |
| **Bottleneck** | No adviser "today's priorities" ranked queue |
| **Compliance** | Governed communications replace legacy promotions |
| **Automation opportunity** | Unified operating dashboard (Track A) |

---

## Confirmed journey gaps (repository evidence)

| Gap | Evidence | Likely external workaround |
|-----|----------|---------------------------|
| No unified adviser work queue | `advisor_tasks`, suggestions, roadmap, meetings, review pipeline are separate (`advisorCommandCenter.ts` aggregates UI only) | Spreadsheet or personal task list |
| Adviser notifications ephemeral | `advisorNotifications.ts` computed, not persisted | Manual reminders, calendar |
| Roadmap ↔ tasks not linked | Separate tables; loose `related_entity_type` on tasks | Duplicate entry |
| Budget vs Discover split | `client_budgets` independent of Discover JSONB | Adviser reconciles manually |
| Binder client publication off | `binder_client_publication` default false | Email PDF manually |
| No implementation/product ledger | No investments/policies normalized tables | External policy admin |
| Pre-meeting checklist absent | Appointments exist; no prep task auto-creation from appointment | Manual prep notes |
| Unpublished output aging not queued | Publication workflow without SLA queue | Adviser memory |

---

## Compliance considerations across journey

- Client-facing financial content flows through **published_outputs** with withdraw capability.
- Meeting Studio records presentation/acknowledgement events for audit.
- Legacy Promotions retired; governed communications require admin approval.
- No AI-generated financial recommendations in production paths.
- Scoring engine version fixed at v1 — formula changes require explicit phase approval.

---

## Journey conclusion

AEGIS supports the **full adviser journey structurally** — each stage has at least one screen and persistence layer. The primary gap is **operational cohesion**: advisers must orchestrate across dashboard panels, per-client tabs, tasks, roadmap, meetings, and publications without a single prioritized work queue. This is the highest-value end-to-end closure opportunity for Phase 10.
