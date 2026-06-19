# Phase 9C — Meeting Summary Policy

## Summary statuses

| Status | Visibility | Description |
|--------|------------|-------------|
| `draft` | Adviser only | Initial auto-generated on `prepare-summary` |
| `adviser_reviewed` | Adviser only | Adviser has reviewed content |
| `ready_for_publication` | Adviser only | Ready for publication workflow |
| `published` | Via publication workflow only | Client access through Phase 9A |
| `archived` | Adviser only | Historical record |

## Summary structure (`summary_payload`)

- Client and adviser names
- Meeting date and purpose
- Information confirmed
- Broad areas discussed (section types)
- Scenarios reviewed
- Agreed priorities
- Outstanding information
- Client and adviser tasks
- Next appointment reference
- Data-as-at date
- Optional `clientSafeSummaryText` (separate from internal notes)

## Client access

- **No direct client API** for meeting summaries in Phase 9C
- Client-safe content requires Phase 9A publication workflow (`meeting_summary_publication` feature)
- Full meeting summary is never automatically exposed

## Binder export

Structure prepared for Phase 9E document governance. No broad export redesign in 9C.

## Immutability

Completed session snapshots are preserved. Summary updates on completed sessions require explicit amendment workflow (future phase).
