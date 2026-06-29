# CRM V2 Phase 04 — Visibility and Privacy

## Client-visible

- Appointment identity, safe purpose/type, lifecycle display label
- Proposed/confirmed schedule and timezone
- Delivery mode and safe location summary
- Client topics and client/shared checklist items
- Required document categories
- Published meeting summary (when explicitly published)
- Client-visible follow-up items

## Never exposed to client DTOs

- Adviser agenda and private notes
- Adviser-only checklist items
- Unpublished outcomes
- Raw Meeting Studio data
- Internal event history and internal reason details
- Financial data, NRIC, policy identifiers
- Storage paths and persisted signed URLs
- OAuth/Google credentials

## Access boundaries

- No browser-supplied adviser/client identifiers
- No household claim as proof of access
- No admin impersonation fallback in client routes
- Forged IDs reveal nothing (`not_found`)
