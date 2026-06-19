# Phase 9E Communication Preferences Policy

## Client-controlled preferences

| Preference | Default | Can disable? |
|------------|---------|--------------|
| In-app operational notifications | `true` | Yes (non-essential) |
| Email operational notifications | `true` | Yes |
| Educational Insights | `true` | Yes |
| Market updates | `true` | Yes |
| Event announcements | `true` | Yes |
| Adviser messages | `true` | Yes |
| Promotional content | `false` | Opt-in only |

## Rules

1. Essential security and required service notices cannot be disabled where policy requires delivery (implementation: operational system events bypass preference suppression when marked essential — future firm policy).
2. Preferences are server-stored in `communication_preferences`.
3. Client identity derived from session — no cross-client updates.
4. Advisers cannot alter client preferences.
5. Preference changes are audit-logged (`communication_preference_changed`).
6. Absent preferences default safely via `dbLoadCommunicationPreferences()`.

## Legal consent

Firm-approved consent wording is required before enabling promotional categories in production. Phase 9E does not invent legal consent language.

## API

`GET/PATCH /api/client/communication-preferences`
