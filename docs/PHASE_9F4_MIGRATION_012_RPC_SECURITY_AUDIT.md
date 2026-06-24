# Phase 9F.4 Migration 012 — RPC Security Audit

## RPC caller database role

| Layer | Role |
|-------|------|
| Next.js admin migration route | Authenticated human admin + `admin_content_approval` (application gate) |
| `promotionMigrationPersistence.ts` | `createAdminSupabaseClient()` → **Supabase `service_role`** JWT |
| PostgreSQL RPC execution | **`service_role`** (only role granted `EXECUTE`) |

Browser users authenticate as `authenticated` or `anon`. Those roles have **no `EXECUTE`** on either function after migration 012.

## Previous and final function grants

| Function | Before 012 | After 012 |
|----------|------------|-----------|
| `legacy_promotion_migration_destination_id(uuid)` | Does not exist | `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`; `GRANT EXECUTE` to `service_role` only |
| `execute_legacy_promotion_migration(...)` | Does not exist | Same restricted grant pattern |

`REVOKE ALL FROM PUBLIC` alone is insufficient for Supabase; explicit `anon` / `authenticated` revokes are included.

## Fixed search-path evidence

```sql
CREATE OR REPLACE FUNCTION execute_legacy_promotion_migration(...)
...
SECURITY DEFINER
SET search_path = public
```

Runtime verification: `proconfig` contains `search_path=public` (see `verify_202606200012_phase9f4_promotion_migration_idempotency.sql`).

Table references inside the RPC use schema-qualified names (`public.promotion_migration_reviews`, `public.governed_content`, `public.legacy_promotion_migration_destination_id`).

No dynamic SQL (`EXECUTE format(...)`) is used.

## Direct-browser RPC exposure result

**Blocked at database layer.**

A browser Supabase client (anon/authenticated JWT) cannot invoke `execute_legacy_promotion_migration` because:

1. No `EXECUTE` grant on `anon` or `authenticated`
2. Service role key is server-only (`lib/supabase/admin.ts` — never imported in client components)
3. Migration persistence is `import "server-only"`

Even if a user forged an HTTP request to PostgREST with their session JWT, PostgREST would deny RPC execution without `EXECUTE` privilege.

## Application-layer controls (defense in depth)

| Control | Location |
|---------|----------|
| Admin route auth | `requirePromotionMigrationAdminAccess()` |
| Server-side transform | `transformLegacyPromotionToGovernedDraft()` — browser cannot supply body/destination |
| No client destination ID | RPC derives deterministic id from `p_promotion_id` only |
| Draft-only lifecycle | RPC hardcodes `approval_status = 'draft'` |
| Classification allowlist | RPC validates six fixed classification strings |
| Asset block | Application layer blocks before RPC when assets present |

## Residual operational notes

- RPC accepts content fields from the service role caller; compromise of service role key remains out of scope for this migration gate.
- RPC does not independently verify `admin_content_approval` — relies on service role being unavailable to browsers and admin routes enforcing approval before call.
- After apply, run `verify_202606200012_phase9f4_promotion_migration_idempotency.sql` and confirm `overall.exact_match_verdict = pass`.
