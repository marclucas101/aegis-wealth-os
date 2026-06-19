# Phase 9E Audience Targeting Policy

## Scopes

| Scope | Description |
|-------|-------------|
| `all_active_clients` | All `active_client` relationship stages |
| `assigned_active_clients` | Clients where `advisor_user_id` matches content adviser |
| `all_prospects` | All prospect stages |
| `assigned_prospects` | Prospects assigned to adviser |
| `selected_clients` | Explicit UUID list — server-validated |
| `internal_advisers` | Never shown in client feed |
| `public_education` | Broad education where separately enabled |

## Enforcement

- `contentMatchesAudience()` re-evaluated on every feed load
- `validateTargetClientIds()` ensures advisers target only assigned clients
- Prospects and active clients receive only entitled content per relationship stage
- Inactive clients: `insights_and_updates` disabled in entitlements (Phase 9D policy)
- No broad RLS granting all authenticated users access to all content
- Client cannot modify audience targeting

## Adviser permissions

Advisers may use: `assigned_active_clients`, `assigned_prospects`, `selected_clients`.
Admins may additionally use broad scopes.
