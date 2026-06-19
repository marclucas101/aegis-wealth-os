# Phase 9C — Presentation Output Matrix

Audience: `meeting_presentation` (Phase 9A `output_audience`).

## Allowlisted top-level DTO keys

| Key | Purpose |
|-----|---------|
| `sessionId` | Session reference |
| `clientName` | Display name |
| `adviserName` | Presenter name |
| `meetingDate` | Optional scheduled/started date |
| `dataAsAt` | Snapshot version |
| `meetingPurpose` | Adviser-entered purpose |
| `adviserLedLabel` | "Adviser-led discussion" |
| `sections` | Selected section payloads only |
| `algorithmVersion` | Traceability |

## Section payloads

| Section | May include | Must not include |
|---------|-------------|------------------|
| `welcome` | Purpose, headings | Internal flags |
| `priorities` | Goal labels, time horizons | Raw form data |
| `facts_and_assumptions` | Label, value, confirmation status | Full discover payload |
| `financial_foundation` | Broad position, educational ratios | Product recommendations |
| `broad_strengths` | Broad strength labels | Pillar scores, coefficients |
| `areas_for_review` | Discussion areas | Hidden scoring |
| `protection_resilience` | Categories, relative strength | Model rules, commission |
| `scenario_education` | Labels, assumptions, illustrations | Full stress engine output |
| `goal_alignment` | Aligned goals, discussion points | Roadmap internals |
| `adviser_observations` | Meeting-visible observations | Internal adviser notes |
| `agreed_priorities` | Agreed priorities, deferred topics | Task suggestions |
| `next_steps` | Administrative steps | Internal task IDs |

## Prohibited keys (all levels)

`rawShieldScore`, `adjustedShieldScore`, `internalNotes`, `adviserNotes`, `modelCoefficients`, `weightings`, `commission`, `taskSuggestions`, `complianceFlags`, `productName`, `recommendedCoverage`, etc.

## Exact amounts

Controlled by `meeting_exact_amount_presentations` feature flag — **default off**. When enabled, amounts must be labelled adviser-led illustrations.
