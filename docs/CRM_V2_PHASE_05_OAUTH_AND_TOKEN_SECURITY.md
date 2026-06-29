# CRM V2 Phase 05 — OAuth and Token Security

## Required environment variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_STATE_SECRET`

No production secrets are stored in repository files.

## OAuth flow

1. Authenticated adviser starts `/api/advisor-v2/integrations/google-calendar/connect`.
2. Server generates signed state and Google authorization URL.
3. Google redirects to `/api/google-calendar/callback`.
4. Callback requires authenticated adviser session and state adviser match.
5. Tokens exchanged server-side, encrypted, and stored in `adviser_calendar_connections`.
6. Writable calendars are fetched and default selection is persisted.

## Security controls

- No access/refresh tokens returned in API responses.
- No plaintext token storage.
- Safe error messages through `toPublicErrorMessage`.
- Callback identity is server-derived; client-supplied adviser IDs rejected.
- State mismatch fails closed.
