# Phase 9F.3 PDF Content Policy

## Principle

Binder PDFs are assembled from an **explicit allowlist render model**. Database rows and publication payloads are never passed directly to the renderer.

---

## Section registry

Only `BINDER_SECTIONS` in `lib/communications/binderExport.ts` are accepted:

- `cover_page`
- `client_adviser_info`
- `meeting_date`
- `financial_overview`
- `my_plan`
- `agreed_priorities`
- `roadmap`
- `meeting_summary`
- `document_index`
- `next_review_date`

Browser requests section IDs only — never rendered HTML or section bodies.

---

## Source eligibility

| Rule | Enforcement |
|------|-------------|
| Current published only | `isCurrentPublishedOutput()` |
| Client-safe audience | Reject `adviser_internal` |
| No drafts / withdrawn / superseded / expired | Publication workflow helpers |
| Adviser assignment | `resolveAccessibleClient()` per resolver |
| Document index | `canClientViewDocument()` — metadata only |

---

## Redaction envelope (`lib/binder/binderPdfRedaction.ts`)

### Excluded from render model

- NRIC / identity numbers
- Account and policy numbers (unless already in approved client-safe payload — then still pattern-scrubbed)
- Raw diagnostic inputs, Shield scores, AWRI coefficients
- Adviser-only and compliance notes
- Internal classifications and provider credentials
- Storage paths and database implementation IDs
- Raw audit metadata
- Email addresses (adviser contact is display name / organisation only)
- Arbitrary HTML (`<…>` stripped)

### Financial overview

Uses `sanitizeFinancialReadinessPayload()` + `FINANCIAL_READINESS_SNAPSHOT_ALLOWLIST` only.

### Limits

| Limit | Value |
|-------|-------|
| Text field cap | 4,000 characters |
| Table rows | 40 per table |
| Document index rows | 30 |
| Sections per request | 10 |

---

## PDF hardening

- No embedded JavaScript or file attachments
- No active external URLs in body text
- No hidden PDF layers with redacted values
- Generic confidentiality footer on every page
- Filename in storage: `meeting-pack.pdf` only (no client name in path)

---

## Automated sensitive-marker tests

`lib/binder/binderRedactionFixtures.ts` defines marker strings (NRIC-like, account, policy, email, storage path, UUID, adviser note, Shield raw, AWRI). QA asserts none appear in:

1. Redacted render model text
2. Generated PDF searchable text extraction

---

## API response policy

Responses omit: `storage_bucket`, `storage_path`, `content_hash`, signed URLs (except dedicated download route), PDF bytes, raw `generation_error_code` internals beyond stable code enum.
