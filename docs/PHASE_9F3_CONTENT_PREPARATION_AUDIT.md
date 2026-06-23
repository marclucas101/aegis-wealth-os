# Phase 9F.3 — Content Preparation Audit

Audit date: 2026-06-24. Scope: adviser-facing creation, review, and publication paths for binder planning sections.

## Summary

| Binder section | Accepted output types | Existing workflow | Meeting Packs deep-link |
| --- | --- | --- | --- |
| Financial overview | `financial_overview`, `financial_readiness_snapshot` | **Yes** — dashboard analysis → `POST /api/advisor/clients/[clientId]/publications` | Yes → planning outputs |
| Current planning position | `client_plan_summary`, `goal_plan_summary`, `wealth_blueprint_summary` | **Partial** — wealth blueprint reports exist; client plan summary now prepared via shared planning outputs | Yes → planning outputs |
| Agreed priorities | `goal_plan_summary`, `client_plan_summary` | **Partial** — goals data exists; publication prepared via shared planning outputs | Yes → planning outputs |
| Wealth roadmap | `roadmap_summary` | **Partial** — roadmap items exist in workspace; publication prepared via shared planning outputs | Yes → planning outputs |
| Meeting summary | `meeting_summary`, `annual_review_summary` | **Partial** — Meeting Studio prepares session summary; publication to `published_outputs` remains post-meeting | Yes → Meeting Studio (overview tab) |
| Document index | n/a (document vault) | **Yes** — client-visible documents in vault | Yes → document vault tab |
| Meeting metadata | n/a | **Yes** — meeting date chosen in Meeting Packs panel | In-panel |

## Section detail

### Financial overview

| Field | Value |
| --- | --- |
| Source screen | Client workspace → Dashboard; Planning outputs |
| Draft generation | `preparePlanningOutputFromSources` from `loadDashboardSnapshot` |
| Publishing route | `POST …/publications` → `POST …/publications/[outputId]/review` → `POST …/publications/[outputId]/publish` |
| Required role | Assigned adviser or admin |
| Navigation path | Client file → Meeting Packs → **Create financial overview** → Planning outputs |
| Workflow usable? | **Yes** (requires completed Discover / dashboard snapshot) |
| Deep-link from Meeting Packs? | **Yes** |

### Current planning position

| Field | Value |
| --- | --- |
| Source screen | Planning outputs; Protection Reports (wealth blueprint source data) |
| Draft generation | `preparePlanningOutputFromSources` (`client_plan_summary`) from dashboard + roadmap |
| Publishing route | Shared publication workflow (review → publish) |
| Required role | Assigned adviser or admin |
| Navigation path | Client file → Meeting Packs → **Create planning position** |
| Workflow usable? | **Yes** after Phase 9F.3 shared preparation page |
| Deep-link from Meeting Packs? | **Yes** |

### Agreed priorities

| Field | Value |
| --- | --- |
| Source screen | Planning outputs; goals persistence |
| Draft generation | `preparePlanningOutputFromSources` (`goal_plan_summary`) from goals + roadmap |
| Publishing route | Shared publication workflow |
| Required role | Assigned adviser or admin |
| Navigation path | Client file → Meeting Packs → **Create agreed priorities** |
| Workflow usable? | **Yes** after Phase 9F.3 |
| Deep-link from Meeting Packs? | **Yes** |

### Wealth roadmap

| Field | Value |
| --- | --- |
| Source screen | Planning outputs; overview roadmap panel |
| Draft generation | `preparePlanningOutputFromSources` (`roadmap_summary`) from `loadClientSafeRoadmap` |
| Publishing route | Shared publication workflow |
| Required role | Assigned adviser or admin |
| Navigation path | Client file → Meeting Packs → **Create wealth roadmap** |
| Workflow usable? | **Yes** when client has active roadmap items |
| Deep-link from Meeting Packs? | **Yes** |

### Meeting summary

| Field | Value |
| --- | --- |
| Source screen | Meeting Studio (overview tab) |
| Draft generation | `prepareMeetingSummary` on meeting session (session payload, not `published_outputs` until extended) |
| Publishing route | Meeting Studio post-meeting flow (feature-flagged `meeting_summary_publication`) |
| Required role | Assigned adviser |
| Navigation path | Client file → Overview → Meeting Studio |
| Workflow usable? | **Post-meeting only** — not required for preparation packs |
| Deep-link from Meeting Packs? | **Yes** — labelled “Create after meeting” |

## Gaps closed in Phase 9F.3

1. Shared route `/advisor/clients/[clientId]/planning-outputs` for create → review → publish.
2. Readiness actions with fixed allowlisted hrefs (no database URLs).
3. Pack purpose `meeting_preparation` excludes meeting summary from mandatory pre-meeting requirements.
4. Section selection in Meeting Packs — generation blocked only for selected unavailable sections.

## Gaps intentionally deferred

- `wealth_blueprint_summary` direct publication from blueprint print view (blueprint remains a source report; plan summary covers binder `my_plan`).
- `meeting_summary` automatic publication from Meeting Studio (session workflow unchanged; post-meeting).
- `annual_review` and `meeting_record` pack purposes (modelled, not exposed in UI until workflows are complete).
