# Phase 9C — Meeting Studio Workflow

## Three stages

### 1. Prepare (`/advisor/clients/[clientId]/meeting-studio`)

Adviser reviews client readiness and selects presentation sections.

- Client identity, relationship stage, profile completion
- Missing information and data-quality warnings
- Section selection (controlled reveal)
- Save draft preparation (`POST .../prepare`)
- **Start Meeting** → transitions to Present

Statuses: `draft` → `prepared`

### 2. Present (full-screen in Meeting Studio)

Adviser-led presentation using allowlisted `meeting_presentation` DTO.

Flow order (configurable via `section_order`):

1. Welcome and meeting purpose
2. Your priorities
3. Facts and assumptions
4. Financial foundation
5. Broad strengths
6. Areas requiring discussion
7. Protection and resilience
8. Scenario education
9. Goal alignment
10. Adviser observations
11. Agreed priorities
12. Next steps

- `GET .../presentation` returns **only selected sections**
- `POST .../section-shown` records reveal (idempotent)
- Presenter-only exit control
- No public/share links

Statuses: `prepared` → `in_progress`

### 3. Close

Adviser records outcomes and completes session.

- Separate fields: internal notes, meeting-visible observations, client-safe summary text
- Fact confirmations (`POST .../confirm-fact`)
- Scenario selections (adviser-chosen)
- Acknowledgements (`POST .../record-acknowledgement`)
- Complete meeting (`POST .../complete`) — idempotent
- Prepare summary (`POST .../prepare-summary`) — adviser-only draft

Statuses: `in_progress` → `completed`

## Relationship stage on completion

Server-side via `maybeAdvanceStageOnMeetingCompletion`:

- May advance `meeting_scheduled` or earlier → `adviser_review`
- Never regresses later stages
- Never advances to `active_client` or `recommendation_prepared`

## Analysis refresh policy

When material facts are corrected during a meeting:

- Session sets `requires_analysis_refresh = true`
- Original `data_snapshot_version` is preserved on the session
- Presentation continues with a visible `staleAnalysisWarning` in the DTO
- Internal analysis is **not** auto-recalculated or auto-published from Meeting Studio

See `ANALYSIS_REFRESH_POLICY` in `lib/compliance/meetingStudioWorkflow.ts`.

## Publication path

Client-safe meeting content uses Phase 9A publication workflow (`meeting_presentation` audience). Nothing auto-publishes.
