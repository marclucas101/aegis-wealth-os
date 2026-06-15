# Idempotent client provisioning upsert

> Status: **APPLIED.** The unique index `clients_user_id_unique` was applied to
> production (and is captured additively in
> `supabase/migrations/202606150001_clients_user_id_unique.sql`), and the
> provisioning code now uses the authoritative upsert below
> (`provisionClientRow` in `lib/supabase/userProfile.ts`). Regression coverage:
> `npm run qa:provisioning` (`scripts/run-provisioning-validation.ts`).
> This document is retained as the design record.

---

## 1. Where client rows are created (full audit)

There are exactly **two** code paths that `INSERT` into `public.clients`. Every
other write is an `UPDATE`/`SELECT`.

| Path | File | Purpose | Change needed |
| --- | --- | --- | --- |
| Self-provisioning | `lib/supabase/userProfile.ts` → `_ensureUserClientProfile` (insert ~L208–230) | First-login auto-create of the signed-in user's own client row | **Yes** — switch to authoritative upsert (below) |
| Admin/adviser placeholder | `lib/supabase/clientOnboarding.ts` → `createPlaceholderClient` (insert ~L423) | Create an **unlinked** placeholder (`user_id IS NULL`) for an invited email | No insert change. Already dedupes by email via `findClientByEmail` first; `user_id` is NULL so the unique index does not constrain it |

**Adviser assignment never creates a row.** `assignClientAdvisor`
(`lib/supabase/adminManagement.ts` ~L381) and all status/feedback writes are
`UPDATE`s against an existing `id`. The duplicate explosion came solely from
concurrent first-login self-provisioning racing with no DB uniqueness guard
(99 rows for one user, created within seconds). The request-scoped `React.cache`
wrapper (already shipped) collapses per-request duplicates; the unique index +
upsert below makes it durable across concurrent serverless invocations.

---

## 2. Prepared replacement for the self-provisioning insert

Replace the current insert block in `_ensureUserClientProfile`
(`lib/supabase/userProfile.ts`, the `if (!clientRow) { … }` block, ~L208–230):

```ts
  if (!clientRow) {
    // Authoritative idempotent provisioning: INSERT ... ON CONFLICT (user_id)
    // DO NOTHING. Relies on the unique index `clients_user_id_unique`.
    // ignoreDuplicates:true => never clobber an existing row's data with
    // onboarding defaults; concurrent requests can't create a second row.
    const { error } = await admin
      .from("clients")
      .upsert(
        {
          user_id: authUser.id,
          advisor_user_id: null,
          display_name: displayNameFromAuthUser(authUser),
          email,
          status: "onboarding",
          currency_code: "SGD",
        } as never,
        { onConflict: "user_id", ignoreDuplicates: true },
      );

    if (error) {
      throw new Error(`Failed to provision client profile: ${error.message}`);
    }

    // Re-read the authoritative row (the insert returns nothing when the row
    // already existed and the conflict was ignored).
    clientRow = await fetchClientByUserId(admin, authUser.id);
    if (!clientRow) {
      throw new Error("Failed to provision client profile: row missing after upsert.");
    }
  }
```

### Why this satisfies the requirements
- **One authoritative idempotent upsert** — a single `upsert` with
  `onConflict: "user_id"` is the only create path for self-provisioning.
- **Adviser assignment updates the existing row** — unchanged; `assignClientAdvisor`
  already does `UPDATE … SET advisor_user_id`. No new row is ever created when an
  assignment changes.
- **No new row merely because assignment changed** — assignment never touches the
  insert path; and even a stray concurrent provisioning hits `ON CONFLICT DO NOTHING`.
- **Concurrent Vercel requests cannot create duplicates** — the DB unique index is
  the single source of truth; `DO NOTHING` makes the second writer a no-op instead
  of a duplicate insert. The subsequent `fetchClientByUserId` returns the one row.

### Notes
- Keep `fetchClientByUserId` ordering (`created_at ASC, limit 1`) as a belt-and-braces
  reader; once the unique index exists there is at most one non-NULL `user_id` row.
- The placeholder-link path (`linkPlaceholderClientToUser`) is unchanged and still
  runs before this block, so an invited client is linked rather than re-created.
- `createPlaceholderClient` inserts with `user_id = NULL`; multiple NULLs are allowed
  by the unique index (NULLs are distinct), so invitations are unaffected.

---

## 3. Rollback
Revert `_ensureUserClientProfile` to the prior insert-with-refetch block (current
`main`). No data migration is required to roll back the code; the unique index can
remain in place independently.
