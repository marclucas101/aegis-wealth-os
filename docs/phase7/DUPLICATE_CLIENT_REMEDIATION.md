# Duplicate `clients` Remediation Plan (Phase 7)

> Status: **prepared, not executed.** Requires production database access.
> **Nothing in this document is run automatically.** Every destructive statement
> is a reviewable, copy-paste-by-a-human operation that must be executed inside an
> explicit transaction on **staging first**, then production.
>
> Source audit: `duplicate-client-audit.txt`
> (`npx tsx scripts/phase7/audit-duplicate-clients.ts`, exit code 2 = duplicates present).

---

## 0. Audit summary (from `duplicate-client-audit.txt`)

- Total user-linked client rows: **111**
- Distinct auth users with a client row: **10**
- Auth users with **duplicate** client rows: **4**
- Duplicate rows to remediate: **101** (105 rows across the 4 users − 4 canonical rows)

All 101 duplicate rows are `status = onboarding` and report **zero** linked records
across every counted table. Each affected user's data lives entirely in **one**
`status = active` row (the earliest-created row), which becomes the canonical row.

---

## 1. Duplicate inventory & chosen canonical rows

### User A — `a944bdc0-9060-4023-9a73-87181dd0bb1e` (marclucas101@gmail.com) — 99 rows
- **CANONICAL (keep):** `70a7c835-5e9e-4520-95e1-1884a8042da1`
  - status `active`, created `2026-06-09T19:41:55Z`, advisor `none`
  - linked: documents 5, blueprints 2, annual_reviews 1, discover 8, notes 1, tasks 1
- **DUPLICATES (delete after verification):** the other **98** rows, all
  `status = onboarding`, all with zero linked records
  (audit `duplicate-client-audit.txt` lines 11–206).
  > Because hand-transcribing 98 UUIDs into a `DELETE` is error-prone and
  > dangerous, **do not paste a UUID list**. Use the *guarded, query-derived*
  > delete in §6 which selects "every row for this user_id except the canonical,
  > and only when provably empty across all 16 child tables". To see the exact
  > list first, run the read-only query in §4.2.

### User B — `096759c6-cbdd-4d82-9ac4-d9b23d6f9316` (marctangjw@pruadviser.com.sg) — 2 rows
- **CANONICAL (keep):** `6d748398-ebdb-47f9-93ac-22688c4df2d9`
  - status `active`, created `2026-06-10T07:45:04.409Z`, advisor `a944bdc0-9060-4023-9a73-87181dd0bb1e`
  - linked: feedback 1, appointments 3, discover 1
- **DUPLICATE (delete):** `37d5490a-3b5d-448c-b0c5-f799f47d3afe`
  - status `onboarding`, advisor `a944bdc0-9060-4023-9a73-87181dd0bb1e`, empty

### User C — `eb185d19-f870-4a3b-a1b0-c426ababa5e1` (mdanial0905@gmail.com) — 2 rows
- **CANONICAL (keep):** `3c7212d1-041f-4d99-a31e-937534a5ec50`
  - status `active`, created `2026-06-11T04:45:04.112Z`, advisor `none`, discover 1
- **DUPLICATE (delete):** `511d9d85-9090-4111-b413-b2c469f183a2`
  - status `onboarding`, advisor `none`, empty

### User D — `e85f4fb7-40d6-4608-adb7-996918779321` (ja.ling.jl@gmail.com) — 2 rows
- **CANONICAL (keep):** `fca8870b-4138-4cdb-a699-c4a64892d695`
  - status `active`, created `2026-06-13T08:50:56.494Z`, advisor `none`, discover 1
- **DUPLICATE (delete):** `d006182f-525c-4af2-b285-c9cd6984cc36`
  - status `onboarding`, advisor `none`, empty

**Canonical IDs (the only four rows to retain among the duplicated users):**
```
70a7c835-5e9e-4520-95e1-1884a8042da1
6d748398-ebdb-47f9-93ac-22688c4df2d9
3c7212d1-041f-4d99-a31e-937534a5ec50
fca8870b-4138-4cdb-a699-c4a64892d695
```

---

## 2. Every table that references `public.clients(id)`

Confirmed from `supabase/migrations/` (16 foreign keys). Delete behaviour matters:
a duplicate `DELETE` will **cascade-delete** child rows in CASCADE tables, so any
non-empty duplicate MUST be merged first.

| # | Table | FK column | ON DELETE | Notes / unique constraints |
| --- | --- | --- | --- | --- |
| 1 | `client_profiles` | client_id | CASCADE | unique current per client (`is_current`) |
| 2 | `discover_profiles` | client_id | CASCADE | unique current per client (`is_current`) |
| 3 | `financial_profiles` | client_id | CASCADE | unique current per client (`is_current`) |
| 4 | `shield_scores` | client_id | CASCADE | unique current per client (`is_current`) |
| 5 | `pillar_scores` | client_id | CASCADE | keyed by shield_score_id |
| 6 | `stress_tests` | client_id | CASCADE | keyed by shield_score_id |
| 7 | `roadmap_items` | client_id | CASCADE | unique (client_id, item_key) where active |
| 8 | `annual_reviews` | client_id | CASCADE | unique (client_id, review_year) |
| 9 | `wealth_blueprints` | client_id | CASCADE | — |
| 10 | `documents` | client_id | CASCADE | unique storage_path (global) |
| 11 | `advisor_notes` | client_id | CASCADE | — |
| 12 | `client_budgets` | client_id | CASCADE | — |
| 13 | `adviser_appointments` | client_id | CASCADE | overlap exclusion constraint |
| 14 | `audit_logs` | client_id | **SET NULL** | history preserved; re-point to keep linkage |
| 15 | `advisor_tasks` | client_id | **SET NULL** | re-point to keep linkage |
| 16 | `adviser_feedback` | client_id | **SET NULL** | also has `client_user_id`; re-point to keep linkage |

> The audit script counted 9 of these (documents, budgets, feedback, appointments,
> blueprints, annual_reviews, discover, notes, tasks). The remaining 7 (client_profiles,
> financial_profiles, shield_scores, pillar_scores, stress_tests, roadmap_items,
> audit_logs) are **derived/secondary** and are included in the verification query
> below so emptiness is proven across *all* references, not just the counted nine.

---

## 3. Pre-flight (read-only) — re-confirm the duplicate set in the live DB

```sql
-- Global duplicate check (must match the audit: 4 users).
SELECT user_id, count(*) AS rows
FROM public.clients
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING count(*) > 1
ORDER BY rows DESC;
```

---

## 4. Read-only record counts for each duplicate row

### 4.1 Full 16-table emptiness report for one user
Replace `:user_id`. Returns every client row for that user with counts from all 16
child tables, so you can confirm which row holds data (canonical) and that the rest
are empty. **Read-only.**
```sql
SELECT
  c.id, c.status, c.advisor_user_id, c.created_at,
  (SELECT count(*) FROM public.client_profiles     t WHERE t.client_id = c.id) AS client_profiles,
  (SELECT count(*) FROM public.discover_profiles    t WHERE t.client_id = c.id) AS discover_profiles,
  (SELECT count(*) FROM public.financial_profiles   t WHERE t.client_id = c.id) AS financial_profiles,
  (SELECT count(*) FROM public.shield_scores        t WHERE t.client_id = c.id) AS shield_scores,
  (SELECT count(*) FROM public.pillar_scores        t WHERE t.client_id = c.id) AS pillar_scores,
  (SELECT count(*) FROM public.stress_tests         t WHERE t.client_id = c.id) AS stress_tests,
  (SELECT count(*) FROM public.roadmap_items        t WHERE t.client_id = c.id) AS roadmap_items,
  (SELECT count(*) FROM public.annual_reviews       t WHERE t.client_id = c.id) AS annual_reviews,
  (SELECT count(*) FROM public.wealth_blueprints    t WHERE t.client_id = c.id) AS wealth_blueprints,
  (SELECT count(*) FROM public.documents            t WHERE t.client_id = c.id) AS documents,
  (SELECT count(*) FROM public.advisor_notes        t WHERE t.client_id = c.id) AS advisor_notes,
  (SELECT count(*) FROM public.client_budgets       t WHERE t.client_id = c.id) AS client_budgets,
  (SELECT count(*) FROM public.adviser_appointments t WHERE t.client_id = c.id) AS adviser_appointments,
  (SELECT count(*) FROM public.audit_logs           t WHERE t.client_id = c.id) AS audit_logs,
  (SELECT count(*) FROM public.advisor_tasks        t WHERE t.client_id = c.id) AS advisor_tasks,
  (SELECT count(*) FROM public.adviser_feedback     t WHERE t.client_id = c.id) AS adviser_feedback
FROM public.clients c
WHERE c.user_id = :user_id           -- e.g. 'a944bdc0-9060-4023-9a73-87181dd0bb1e'
ORDER BY c.created_at;
```

### 4.2 List the duplicate IDs for a user (query-derived, never hand-typed)
```sql
-- Every duplicate row for a user = all rows except the chosen canonical id.
SELECT c.id, c.status, c.created_at
FROM public.clients c
WHERE c.user_id = :user_id
  AND c.id <> :canonical_id          -- e.g. '70a7c835-5e9e-4520-95e1-1884a8042da1'
ORDER BY c.created_at;
```

---

## 5. Canonical selection rule (how the IDs in §1 were chosen)
For each duplicated `user_id`, the canonical row is the one that:
1. holds the most linked data (per §4.1), then
2. has an assigned `advisor_user_id` if tied, then
3. is the **earliest** `created_at` (matches the app's defensive `fetchClientByUserId`).

In this dataset all three criteria agree: the single `status = active` row is the
earliest and holds all data; every duplicate is a later empty `onboarding` row.

### 5b. Preserve the intended `advisor_user_id`
Never lose an assignment. If a canonical row's advisor is NULL but a duplicate of the
same user carries a non-NULL advisor, copy it to the canonical **before** deleting.
This update only fills a NULL canonical advisor and never overwrites an existing one:
```sql
-- Run per user. Read the SELECT first; only run the UPDATE if it returns a value.
SELECT DISTINCT advisor_user_id
FROM public.clients
WHERE user_id = :user_id AND advisor_user_id IS NOT NULL;

UPDATE public.clients can
SET advisor_user_id = sub.advisor_user_id
FROM (
  SELECT advisor_user_id
  FROM public.clients
  WHERE user_id = :user_id AND advisor_user_id IS NOT NULL
  ORDER BY created_at
  LIMIT 1
) sub
WHERE can.id = :canonical_id
  AND can.advisor_user_id IS NULL;
```
For this dataset: User B's canonical already has advisor `a944…`; Users A/C/D have no
advisor on any row — so this step is a no-op but should still be run for safety.

---

## 6. Merge (only if §4.1 shows a duplicate is NOT empty)

All identified duplicates are empty, so **no merge is expected**. The procedure
below is the safety path if verification ever finds data on a duplicate. Run inside
a transaction, one (canonical, duplicate) pair at a time. Re-point children from the
duplicate to the canonical for all 16 tables, then re-verify, then delete.

> ⚠️ Unique-constraint collisions: tables 1–4 enforce one `is_current` row per
> client, `annual_reviews` is unique per (client_id, review_year), `roadmap_items`
> is unique per (client_id, item_key) where active. If **both** canonical and
> duplicate have such a row, re-pointing will violate the constraint — resolve by
> demoting the duplicate's row (`is_current = false`) or deleting the redundant
> derived row first. Derived scoring tables (1–6, 7) can also simply be deleted on
> the duplicate since they are regenerated from Discover.

```sql
BEGIN;
-- :dup = duplicate client id, :canonical = canonical client id
UPDATE public.documents            SET client_id = :canonical WHERE client_id = :dup;
UPDATE public.client_budgets       SET client_id = :canonical WHERE client_id = :dup;
UPDATE public.adviser_appointments SET client_id = :canonical WHERE client_id = :dup;
UPDATE public.wealth_blueprints    SET client_id = :canonical WHERE client_id = :dup;
UPDATE public.annual_reviews       SET client_id = :canonical WHERE client_id = :dup;  -- watch (client_id, review_year)
UPDATE public.advisor_notes        SET client_id = :canonical WHERE client_id = :dup;
UPDATE public.audit_logs           SET client_id = :canonical WHERE client_id = :dup;
UPDATE public.advisor_tasks        SET client_id = :canonical WHERE client_id = :dup;
UPDATE public.adviser_feedback     SET client_id = :canonical WHERE client_id = :dup;
-- Derived scoring rows: prefer DELETE on the duplicate (regenerated from Discover):
DELETE FROM public.pillar_scores      WHERE client_id = :dup;
DELETE FROM public.stress_tests       WHERE client_id = :dup;
DELETE FROM public.roadmap_items      WHERE client_id = :dup;
DELETE FROM public.shield_scores      WHERE client_id = :dup;
DELETE FROM public.financial_profiles WHERE client_id = :dup;
DELETE FROM public.client_profiles    WHERE client_id = :dup;
DELETE FROM public.discover_profiles  WHERE client_id = :dup;
-- Re-run §4.1 for :dup here; every count MUST be 0 before COMMIT.
COMMIT;   -- or ROLLBACK if anything looks wrong
```

---

## 7. Delete only fully-emptied duplicate rows (guarded, transactional)

This deletes, per user, **all rows except the canonical**, and only when the row is
empty across all 16 child tables. The `NOT EXISTS` guard makes it impossible to
delete a row that still owns data, even if you mis-set an ID.

```sql
BEGIN;

-- Optional: snapshot what will be deleted (read-only) before deleting.
SELECT c.id, c.status, c.created_at
FROM public.clients c
WHERE c.user_id = :user_id
  AND c.id <> :canonical_id
ORDER BY c.created_at;

DELETE FROM public.clients c
WHERE c.user_id = :user_id
  AND c.id <> :canonical_id
  AND NOT EXISTS (SELECT 1 FROM public.client_profiles     x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.discover_profiles    x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.financial_profiles   x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.shield_scores        x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.pillar_scores        x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.stress_tests         x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.roadmap_items        x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.annual_reviews       x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.wealth_blueprints    x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.documents            x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.advisor_notes        x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.client_budgets       x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.adviser_appointments x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.audit_logs           x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.advisor_tasks        x WHERE x.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.adviser_feedback     x WHERE x.client_id = c.id);

-- Verify exactly one row remains for this user, and it is the canonical:
SELECT id, status, advisor_user_id FROM public.clients WHERE user_id = :user_id;

COMMIT;   -- only after the verification above is correct; otherwise ROLLBACK
```

Run once per user with these pairs:

| :user_id | :canonical_id | expected deletions |
| --- | --- | --- |
| `a944bdc0-9060-4023-9a73-87181dd0bb1e` | `70a7c835-5e9e-4520-95e1-1884a8042da1` | 98 |
| `096759c6-cbdd-4d82-9ac4-d9b23d6f9316` | `6d748398-ebdb-47f9-93ac-22688c4df2d9` | 1 |
| `eb185d19-f870-4a3b-a1b0-c426ababa5e1` | `3c7212d1-041f-4d99-a31e-937534a5ec50` | 1 |
| `e85f4fb7-40d6-4608-adb7-996918779321` | `fca8870b-4138-4cdb-a699-c4a64892d695` | 1 |

If `DELETE` affects fewer rows than expected, a "duplicate" still owns data — stop,
`ROLLBACK`, and merge it via §6 before retrying.

---

## 8. Post-cleanup verification (read-only)
```sql
-- Must return zero rows.
SELECT user_id, count(*) FROM public.clients
WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1;
```
Then re-run the audit for full assurance:
```bash
npx tsx scripts/phase7/audit-duplicate-clients.ts   # expect exit code 0
```

---

## 9. Transaction & rollback guidance
- Do every mutation inside `BEGIN; … COMMIT;`. If any verification inside the block
  looks wrong, run `ROLLBACK;` — nothing is persisted.
- Take a database backup / PITR checkpoint before starting (see
  `docs/BACKUP_AND_RECOVERY.md`).
- Work per user (small blast radius). Validate User C or D first (single empty
  duplicate) before doing User A's 98-row cleanup.
- Run on **staging** end-to-end before production.
- These statements are **not** added to `supabase/migrations/` — they are one-time
  operational fixes, executed by a human.

---

## 10. After cleanup is reviewed and complete
1. Apply the uniqueness protection: `docs/phase7/PENDING_clients_user_id_unique.sql`
   (it **aborts** if any duplicate `user_id` remains).
2. Switch provisioning to the idempotent upsert: `docs/phase7/PENDING_provisioning_upsert.md`.
3. Do **not** perform steps 1–2 until §7–§8 are green.

## 11. Safety rules
- Never auto-execute destructive SQL. Every `DELETE`/`UPDATE` here is human-run.
- Never delete a row that still owns data — the §7 guard enforces this.
- Never drop or rewrite historical migrations.
- Never widen RLS or expose service-role credentials during cleanup.
