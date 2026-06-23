# Phase 9F.3 Deployment and Enablement

## Prerequisites

1. Migrations through `202606200009` applied
2. `npm run qa:migration-readiness` and `qa:diagnostic-sql-syntax` pass
3. Run `preflight_202606200010_phase9f3.sql` — expect zero BLOCKER and UNKNOWN on clean pending state

## Apply migration (staging first)

```bash
npx supabase db push
```

Dry-run should list **only** `202606200010_phase9f3_binder_pdf_client_vault.sql`.

Post-apply:

```bash
# Run verify diagnostic in SQL editor
# verify_202606200010_phase9f3_binder_pdf_client_vault.sql → EXACT_MATCH
```

## Feature enablement order

| Order | Feature | Effect |
|-------|---------|--------|
| 1 | `binder_export` | Adviser generation, list, download |
| 2 | `binder_client_publication` | Publish, withdraw, new client access |
| 3 | `document_event_notifications` | Optional — lifecycle in-app notifications |

**Default:** all remain disabled until operator enables per environment.

## Policy: `binder_client_publication` disabled after publish

Already-published binders **remain client-readable** until explicitly withdrawn. Disabling the flag blocks new publications and withdrawals UI/API but does not revoke existing client access. This is intentional for continuity; use withdrawal to revoke.

## Application deploy

Deploy application build **after** migration apply so schema matches code expectations.

## Rollback

See `PHASE_9F3_MIGRATION_AND_ROLLBACK.md`. Rollback is staging-only; production rollback requires operator plan for in-flight binders.
