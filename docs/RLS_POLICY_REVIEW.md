# RLS Policy Review — Phase 4X

**Date:** 2026-06-10  
**Source migrations:** `supabase/migrations/202606100009_rls_policies.sql`, `202606100011_audit_logs.sql`, `202606100013_advisor_tasks.sql`, `202606100014_fix_users_role_self_escalation.sql`  
**Helpers:** `supabase/migrations/202606100003_users_and_clients.sql`

**Related:** [Security Audit Report](./SECURITY_AUDIT_REPORT.md) · [Storage Policy Review](./STORAGE_POLICY_REVIEW.md) · [Service Role Usage Review](./SERVICE_ROLE_USAGE_REVIEW.md)

---

## Service-role bypass caveat

All application write paths use `createAdminSupabaseClient()` which **bypasses RLS**. RLS protects:

- Direct Supabase client access from the browser (anon + session)
- Any future code that uses `createServerSupabaseClient()` without service role

**Implication:** RLS is the enforcement layer for **client-side Supabase queries**, not for API route handlers. API security depends on handler guards + server-derived identity.

---

## Helper functions

| Function | Purpose |
|----------|---------|
| `is_admin()` | `users.role = 'admin'` for `auth.uid()` |
| `is_advisor()` | `users.role IN ('advisor', 'admin')` |
| `owns_client(uuid)` | `clients.user_id = auth.uid()` **OR** `clients.advisor_user_id = auth.uid()` |
| `is_assigned_advisor(uuid)` | `clients.advisor_user_id = auth.uid()` only |
| `owns_shield_score(uuid)` | Shield score belongs to client owned by `auth.uid()` |

All helpers: `SECURITY DEFINER`, `SET search_path = public`, `STABLE`.

---

## Table-by-table review

### `users`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | own row or admin | Profile read |
| UPDATE | `users_update_own_profile` — own row, protected fields unchanged | Safe profile edit only |
| DELETE | admin only | Account removal |
| INSERT | trigger `handle_new_user()` | Signup provisioning |

**Phase 4X.1 protections (C-1 fixed):**

| Layer | Mechanism |
|-------|-----------|
| Column grants | `authenticated` may `UPDATE` only `full_name`, `avatar_url`, `organisation` |
| RLS | `users_update_own_profile` — `WITH CHECK` via `users_protected_fields_unchanged()` |
| Trigger | `enforce_users_self_update_safety()` — blocks `role`, `id`, `email`, `created_at` changes unless `auth.role() = 'service_role'` |

**Safe self-service fields:** `full_name`, `avatar_url`, `organisation`. `updated_at` is set by `users_set_updated_at` trigger.

**Remaining caveat:** Service-role server routes (`PATCH /api/admin/users/[userId]/role`, provisioning) intentionally bypass RLS and may update `role`. This is required admin behavior.

---

### `clients`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | `owns_client(id)` or admin | Owner, assigned advisor, or admin |
| INSERT | admin, self (`user_id = auth.uid()`), or advisor assigning self | Onboarding |
| UPDATE | owner or admin | Profile/status changes |
| DELETE | admin | Hard delete |

**Gap (MEDIUM):** UPDATE does not restrict which columns change. Client owner could theoretically change `advisor_user_id` via direct client. API uses service role with validation.

**Note:** `owns_client` treats assigned advisor as "owner" for SELECT — correct for advisor visibility.

---

### `client_profiles`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Derived profile read |
| INSERT/UPDATE | owner, assigned advisor, or admin | Advisor-assisted onboarding |
| DELETE | admin | Cleanup |

**Gap:** None significant for MVP. Advisors cannot access unassigned clients.

---

### `discover_profiles`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Discover data read |
| INSERT/UPDATE | owner or assigned advisor | Collaborative discovery |
| DELETE | admin | Cleanup |

**Gap:** Admin not in INSERT/UPDATE `WITH CHECK` — admin must use service role (API does).

---

### `financial_profiles`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Read snapshots |
| INSERT/UPDATE | *none for authenticated* | Server-side scoring writes (service role) |
| DELETE | admin | Cleanup |

**Intent:** Clients cannot write financial snapshots directly — correct.

---

### `shield_scores`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Score read |
| INSERT/UPDATE | *none for authenticated* | Server-side writes |
| DELETE | admin | Cleanup |

Same model as `financial_profiles` — correct.

---

### `pillar_scores`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | `owns_shield_score(shield_score_id)` or admin | Pillar breakdown read |
| INSERT/UPDATE | *none* | Server-side |
| DELETE | admin | Cleanup |

---

### `stress_tests`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | via shield ownership or admin | History read |
| INSERT/UPDATE | *none* | Server-side (`stress-testing/run` API) |
| DELETE | admin | Cleanup |

---

### `roadmap_items`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Roadmap read |
| INSERT | assigned advisor or admin | Advisor-generated items |
| UPDATE | owner, assigned advisor, or admin | Status updates |
| DELETE | admin | Cleanup |

**Note:** Bulk generation uses service role. Client status updates go through API with session client.

---

### `wealth_blueprints`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Blueprint read |
| INSERT | assigned advisor or admin | Snapshot creation |
| UPDATE | **admin only** | Immutable snapshots for clients/advisors at RLS layer |
| DELETE | admin | Cleanup |

Advisors create via service role in API; clients cannot mutate blueprint rows directly.

---

### `annual_reviews`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Review read |
| INSERT/UPDATE | assigned advisor or admin | Review workflow |
| DELETE | admin | Cleanup |

---

### `documents`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | owner or admin | Metadata read |
| INSERT | owner or assigned advisor; `uploaded_by_user_id` must be self or null | Upload attribution |
| UPDATE | uploader, assigned advisor, or admin | Archive/metadata |
| DELETE | **admin only** | Hard delete at DB layer |

**Note:** Client delete/archive goes through API (service role + ownership check). RLS DELETE is admin-only by design.

---

### `advisor_notes`

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | assigned advisor or admin | **Clients cannot read notes** |
| INSERT | assigned advisor; `advisor_user_id = auth.uid()` | Author attribution |
| UPDATE/DELETE | author or admin | Note lifecycle |

Strong advisor-only boundary at RLS layer.

---

### `advisor_tasks` (migration `202606100013`)

| Operation | Policy | Intent |
|-----------|--------|--------|
| SELECT | admin, assignee, creator, or assigned advisor for client | Task visibility |
| INSERT/UPDATE/DELETE | *none for authenticated* | API uses service role |

Correct split: reads possible via RLS; mutations only through guarded API.

---

### `audit_logs` (migration `202606100011`)

| Operation | Policy | Intent |
|-----------|--------|--------|
| ALL | *no policies for authenticated* | Append-only via service role |

Clients and advisors cannot read or tamper with audit trail via browser client.

---

## Cross-cutting gaps

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| ~~Role column self-update on `users`~~ | ~~Critical~~ **Fixed (4X.1)** | `202606100014_fix_users_role_self_escalation.sql` |
| Column-unrestricted `clients` UPDATE | Medium | Restrict sensitive columns or deny authenticated UPDATE |
| Admin absent from some INSERT policies | Low | Acceptable — API uses service role |
| No advisor SELECT on unassigned clients | — | Correct isolation |

---

## Manual verification SQL (staging)

### Inspect `public.users` policies

```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
WHERE relname = 'users' AND relnamespace = 'public'::regnamespace
ORDER BY polname;
```

Expect `users_update_own_profile` (not `users_update_own`) with `users_protected_fields_unchanged` in `WITH CHECK`.

### Inspect column UPDATE privileges

```sql
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'users' AND grantee = 'authenticated'
ORDER BY column_name;
```

Expect `UPDATE` on `full_name`, `avatar_url`, `organisation` only.

### Role self-escalation must fail (browser client or SDK)

As a normal `client` user session:

```sql
-- Via Supabase JS (expected: permission denied or RLS/trigger error):
-- await supabase.from('users').update({ role: 'admin' }).eq('id', userId)

UPDATE public.users SET role = 'admin' WHERE id = auth.uid();
-- Expected: ERROR permission denied for column role, or users.role cannot be changed...
```

Safe profile update must succeed:

```sql
UPDATE public.users SET full_name = 'Test User' WHERE id = auth.uid();
-- Expected: SUCCESS (1 row)
```

### Admin role update must still work (service role / admin API)

Service role (SQL editor as postgres / migration runner):

```sql
UPDATE public.users SET role = 'advisor' WHERE email = 'test-client@example.com';
-- Expected: SUCCESS when executed with service_role / superuser
```

Admin API path (staging):

```http
PATCH /api/admin/users/{userId}/role
{ "role": "advisor" }
```

Expected: **200** with audit log `user_role_updated` (uses service role server-side).

### Other RLS checks

1. Client cannot `SELECT` another client's `discover_profiles`.
2. Unassigned advisor cannot `SELECT` `advisor_notes` for unassigned `client_id`.
3. Client cannot `INSERT` into `audit_logs`.

---

**Conclusion:** RLS layout matches MVP intent for multi-role wealth app. **C-1 (users role self-escalation) is fixed** at column-grant, RLS, and trigger layers. Service-role admin routes retain intentional role-update capability.
