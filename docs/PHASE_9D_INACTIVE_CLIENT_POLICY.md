# Phase 9D — Inactive Client Policy

## Stage

`relationship_stage = inactive_client`

## Entitlements (explicit)

| Feature | Enabled |
|---------|---------|
| My Adviser | Yes |
| Documents (limited/full per retention) | Yes |
| Financial Overview | **No** |
| My Plan | **No** |
| Roadmap | **No** |
| Budget Optimiser | **No** |
| Goals & Reviews submission | **No** |
| Insights & Updates | **No** |
| Promotions | **No** |
| Shield / Stress / raw modules | **No** |

Implementation: `buildFeatureMap` in `lib/compliance/entitlements.ts`.

## API behaviour

- `/api/client/*` routes return **403** — `Limited access for inactive accounts` via `assertActiveClientPortalAccess`.
- Document APIs continue via `assertClientDocumentAccess` (limited/full document entitlements).
- My Adviser APIs remain available.

## Permitted access

1. Contact assigned adviser (or firm support if unassigned)
2. View and download documents per retention policy (`listClientDocuments` visibility rules)
3. Upload documents where retention policy permits (same document APIs; no analytical tools)
4. View **historical** published summaries only where explicitly retained (Phase 9E governance)

## Document actions (inactive)

| Action | Permitted |
|--------|-----------|
| List visible documents | Yes |
| Download (signed URL, re-checked) | Yes |
| Upload | Yes (subject to retention policy) |
| Delete own uploads | Per existing document policy |

Inactive clients do **not** receive converted-portal navigation or `/api/client/*` access.

## Reactivation

Relationship stage changes are **server-side only** (adviser/admin). Inactive clients cannot self-reactivate through portal submissions.

## Rationale

Inactive clients should maintain relationship continuity and record access without ongoing analytical self-service that could be mistaken for current advice.
