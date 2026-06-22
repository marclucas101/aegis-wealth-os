# Phase 9 Migration Reconciliation Plan

Scope: `202606200001`–`202606200007` only.

Use:

- `supabase/diagnostics/verify_202606200001_phase9a_compliance.sql`
- `supabase/diagnostics/verify_202606200002_publication_hardening.sql`
- `supabase/diagnostics/verify_202606200003_meeting_studio.sql`
- `supabase/diagnostics/verify_202606200004_meeting_studio_rls.sql`
- `supabase/diagnostics/verify_202606200005_client_portal.sql`
- `supabase/diagnostics/verify_202606200006_communications.sql`
- `supabase/diagnostics/verify_202606200007_communications_hardening.sql`
- `supabase/diagnostics/verify_phase9_migrations.sql`
- `supabase/diagnostics/preflight_phase9_application.sql`

All diagnostics are read-only and intentionally safe for missing optional relations.

## Decision rules

### EXACT_MATCH

- Historical migration may later be marked applied, but only after human review.
- Validate dependency chain first.

### ABSENT

- Leave migration pending for normal migration application.

### PARTIAL_MATCH

- Prepare a new additive remediation migration after evidence review.
- Do not edit historical migration files.

### CONFLICTING

- Stop. Do not push or repair.
- Gather exact expected-vs-actual definitions and design explicit transform path.

### BLOCKED_BY_DEPENDENCY

- Resolve earlier migration first.
- Re-run dedicated checks for both parent and child migrations.

### UNKNOWN

- Gather more evidence (additional read-only probes, row-level exports/screenshots).

## Non-actions

- Do not run `supabase db push` from this plan.
- Do not run `supabase migration repair` from this plan.
- Do not run `supabase db reset`.
- Do not perform production deployment actions.

## Dependency order

1. `202606200001`
2. `202606200002` (depends on 001)
3. `202606200003` (depends on 001)
4. `202606200004` (depends on 003)
5. `202606200005` (depends on 001)
6. `202606200006` (depends on 001)
7. `202606200007` (depends on 006)
