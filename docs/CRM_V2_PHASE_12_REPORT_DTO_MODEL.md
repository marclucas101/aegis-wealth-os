# CRM V2 Phase 12 — Report DTO Model

**Type:** `ReportCardDto` in `lib/crm-v2/reports/types.ts`

---

## Fields

| Field | Purpose |
|-------|---------|
| `reportKey` | Stable section card identifier |
| `title` | Safe display title |
| `summary` | Bounded description |
| `dateRangeLabel` | Human-readable range |
| `safeCount` | Aggregate count when appropriate |
| `safePercentage` | Optional bounded percentage |
| `trendDirection` | `up` / `down` / `flat` / `unknown` — only when source supports |
| `sourceModule` | Originating module label |
| `routeHref` | Allowlisted workflow link |
| `freshnessAt` | Projection timestamp |
| `partialDataWarning` | Partial source failure flag |

## Excluded

Raw source rows, NRIC, policy numbers, storage paths, signed URLs, financial values, private notes, raw provider errors, advocacy score, ethnicity, message bodies.

## Section DTO

`ReportSectionDto` — key, label, workspaceHref, cards, partialFailure, emptyMessage, dateRangeLabel.

## Projection DTO

`AdviserReportsProjectionDto` — generatedAt, requestId, dateRange, sections, sourceFailures, adminScopeDeferred.
