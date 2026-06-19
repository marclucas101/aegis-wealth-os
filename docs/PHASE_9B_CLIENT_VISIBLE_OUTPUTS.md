# Phase 9B — Client-Visible Outputs

Prospects may only see outputs that pass Phase 9A publication and sanitization.

## Before adviser publication

`/dashboard` (My Snapshot) returns a **fallback envelope**:

| Field | Visible |
|-------|---------|
| `fallbackReason` | Yes |
| `fallbackMessage` | Yes |
| Information completeness (broad %) | Yes (in fallback context) |
| Missing-information categories | Yes |
| Appointment CTA | Yes |
| Raw Shield score | **No** |
| Pillar scores | **No** |
| Product recommendations | **No** |

## After adviser publication

`ClientSafeFinancialReadinessSnapshot` allowlist only:

| Field | Visible |
|-------|---------|
| `readinessBand` | Yes (mapped category, not AAA/AA) |
| `broadStrengths` | Yes |
| `areasForAdviserReview` | Yes |
| `informationCompletenessPercent` | Yes |
| `educationalExplanation` | Yes |
| `dataAsAt` | Yes |
| `adviserReviewStatus` | Yes |
| `lastReviewedDate` | Yes |
| `nextRecommendedAdministrativeStep` | Yes |
| `appointmentCta` | Yes |
| `missingInformationCategories` | Yes |

## Never visible to prospects

- Exact raw Shield score
- AAA/AA ratings
- Exact protection shortfall
- Recommended coverage amounts
- Recommended asset allocation
- Product names
- Investment return forecasts
- Model assumptions
- Internal adviser notes
- Compliance flags
- Draft or withdrawn publications

## Documents

Prospects see:

- Documents they uploaded
- Documents tagged `client_visible`

Prospects do **not** see internal adviser files, drafts, or compliance records.

Signed download URLs re-check `canClientViewDocument()` at request time — list visibility alone is insufficient.

## Publication states (Financial Readiness Snapshot)

| State | Prospect sees |
|-------|---------------|
| No publication | Safe fallback envelope |
| Draft | Fallback (not current) |
| Reviewed, unpublished | Fallback |
| Current published | `ClientSafeFinancialReadinessSnapshot` |
| Expired / withdrawn / superseded | Fallback |
| Feature disabled | Fallback |
| Invalid nested key in payload | Rejected server-side (`clientSafeDtos` throws) |

## Terminology

All client-facing labels should import from `lib/compliance/terminology.ts`.
