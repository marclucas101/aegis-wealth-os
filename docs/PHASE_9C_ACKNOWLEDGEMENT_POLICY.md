# Phase 9C — Acknowledgement Policy

## Purpose

Record that specific meeting topics were discussed and understood — **not** legal consent to products or transactions.

## Supported acknowledgement items

- Information reviewed during the meeting
- Assumptions confirmed or corrected
- Scenarios understood as illustrations
- Priorities discussed
- Documents to provide
- Follow-up meeting agreed

## Methods

| Method | Description |
|--------|-------------|
| `verbal_recorded` | Adviser records verbal client acknowledgement |
| `on_screen` | Optional on-screen capture (feature-gated) |

## Explicitly not represented

- Acceptance of a financial product
- Confirmation of suitability
- Consent to a transaction
- Waiver of adviser obligations

## Feature control

`meeting_client_acknowledgements` — fail-closed when disabled.

## Storage

`meeting_sessions.acknowledgements` JSON array + `meeting_session_events` + `audit_logs` (item key and method only — no full client responses in metadata).

## E-signatures

Not implemented in Phase 9C. No legally binding e-signature infrastructure is used.
