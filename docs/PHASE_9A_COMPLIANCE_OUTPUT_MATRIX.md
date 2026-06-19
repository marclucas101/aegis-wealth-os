# Phase 9A — Compliance Output Matrix

Classification key:

- **Green** — Self-service suitable for unsupervised client access
- **Amber** — Client-facing only with server controls and/or adviser publication
- **Red** — Adviser-only or formal advice process

| Feature / output | Classification | Client access (9A default) | Adviser access | Publication required |
|------------------|----------------|----------------------------|----------------|----------------------|
| Discover / Complete Information | Green | Yes (own submitted data) | Yes (assigned) | No |
| Budget Optimiser | Green | Yes (user-controlled) | Yes (assigned) | No |
| Document Vault (metadata) | Amber | Limited (prospect) / full (active) | Yes | No |
| Appointments / My Adviser | Green | Yes | Yes | No |
| Promotions / Insights | Green | Yes (when flag on) | Manage | No |
| Financial Readiness Snapshot | Amber | Safe DTO or published snapshot | Full internal | Yes for personalised conclusions |
| Financial Overview (active client) | Amber | Published snapshot only | Full internal | Yes |
| Shield Diagnostic (scores, pillars) | Red | Blocked (fallback) | Read-only Phase 8C | Yes |
| Stress Testing (results) | Red | Blocked (fallback) | Read-only Phase 8C | Yes |
| Roadmap (recommendations) | Red | Blocked (fallback) | Workspace / dashboard | Yes |
| Annual Review (projections) | Red | Blocked (fallback) | Saved reports API | Yes |
| Wealth Blueprint | Red | Blocked (fallback) | Saved reports API | Yes |
| Protection core / coverage gaps | Red | Never on client API | Adviser views | Yes |
| Product recommendations | Red | Never | Adviser workflow | Formal advice process |
| Adviser notes | Red | Never | Notes API | N/A |
| File quality / task suggestions | Red | Never | Adviser APIs | N/A |
| Meeting presentation outputs | Red | Never | `meeting_presentation` audience | Adviser session only |
| Public education content | Green | Generic (non-personalised) | Curate | No |

## Output audience mapping

| Audience | Purpose | Client API exposure |
|----------|---------|---------------------|
| `adviser_internal` | Raw analysis, scoring, diagnostics | Never |
| `meeting_presentation` | Adviser meeting studio (Phase 9C) | Never (adviser session only) |
| `client_published` | Adviser-approved safe payloads | Published rows only |
| `public_education` | Generic educational content | Non-personalised routes |

## Client-safe Financial Readiness Snapshot — allowlisted fields

- readinessBand
- broadStrengths
- areasForAdviserReview
- informationCompletenessPercent
- educationalExplanation
- dataAsAt
- adviserReviewStatus
- lastReviewedDate
- nextRecommendedAdministrativeStep
- appointmentCta
- missingInformationCategories

## Explicitly excluded from client payloads

Raw scores, weightings, coverage shortfalls, product names, allocations, internal notes, model coefficients, stress scenarios, roadmap recommendations.
