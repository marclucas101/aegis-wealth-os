# Phase 9B — Local Data Privacy Review

## Decision summary

Authenticated server-side Discover persistence (`discover_profiles` via `/api/discover/save`) is the **canonical** source of truth for prospect financial information.

Browser `localStorage` must **not** retain sensitive fact-find answers in production.

## Storage inventory

| Location | Content | Production policy |
|----------|---------|-------------------|
| `localStorage` discover profile (`lib/aegis/localProfile.ts`) | Full form answers | **Disabled** in production via `isSensitiveLocalDraftEnabled()` |
| `localStorage` discover meta (`lib/aegis/discoverLocalDraft.ts`) | `userId`, `savedAt`, `currentStep` only | Allowed — non-sensitive resume metadata |
| `localStorage` roadmap statuses | Module progress | Disabled in production |
| URL query params | `next`, `invite` only — never financial fields | Allowed with allowlist validation |
| Analytics / audit metadata | Operational identifiers only | No raw financial values |

## Controls implemented

1. **Production disable** — `isSensitiveLocalDraftEnabled()` returns `false` when `NODE_ENV === "production"`.
2. **Development-only full draft** — non-production may store full drafts with 24-hour TTL.
3. **Account scoping** — storage keys suffix `:userId`; `assertDiscoverDraftBelongsToUser()` clears mismatched drafts.
4. **Cleanup triggers**
   - Successful profile submission (`clearDiscoverProfile` in DiscoverWizard)
   - Logout (`AuthStatus` form `onSubmit`)
   - TTL expiry on metadata read
5. **No encryption pretence** — no client-side encryption of financial data (keys would remain in browser code).

## Residual risk (accepted for Phase 9B)

- Non-production environments may still store full drafts locally for developer convenience.
- Legacy module clients (Shield, Roadmap, etc.) may still read `loadDiscoverProfile()` in dev — they do not receive data in production.
- Shared-device risk mitigated by logout cleanup and account-scoped keys, not eliminated without full session binding on every read.

## Deferred to later phases

- Encrypted offline draft with hardware-bound keys (mobile native apps)
- Server-side draft versioning with explicit prospect consent records (Phase 9E)
