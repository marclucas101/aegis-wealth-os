# Phase 9E Content Classification Policy

## Classifications

| Type | Examples | Audience | Approval | Default |
|------|----------|----------|----------|---------|
| `general_education` | Budgeting, emergency funds, insurance terms, retirement literacy | Broad (where enabled) | Admin approval required | Enabled |
| `general_market_update` | Market events, rate updates, economic commentary + external links | Broad with expiry | Admin + source attribution | `market_updates` control |
| `adviser_message` | Document reminders, review scheduling, follow-ups | Assigned/selected clients | Admin approval | Enabled |
| `promotional_product` | Product offers, comparisons | Restricted | Explicit firm policy | **Disabled** (`product_related_content`) |
| `operational_notification` | Document/appointment events | Entitled clients | System-generated | Enabled |
| `internal_adviser` | Internal-only content | Advisers | N/A | Not client-visible |

## Rules

1. Product-related content must not be published as `general_education`.
2. Personalised financial advice remains in `published_outputs` (Phase 9A), not `governed_content`.
3. Automated text scanning in `contentValidation.ts` is a guardrail only — not a substitute for human approval.
4. Firm compliance policy determines whether `promotional_product` may ever be enabled.

## Categories (client-facing labels)

`financial_education`, `market_update`, `planning_reminder`, `company_update`, `event`, `regulatory_update`, `adviser_message`, `document_notification`, `appointment_update`, `review_reminder`.
