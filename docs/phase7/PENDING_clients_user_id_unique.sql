-- =============================================================================
-- PENDING — public.clients(user_id) uniqueness protection
-- =============================================================================
-- STATUS: NOT APPLIED. Reviewable artifact only.
--
-- This file is intentionally kept OUTSIDE supabase/migrations/ so it is never
-- auto-applied by the migration runner / CI / Vercel. Apply it BY HAND, against
-- staging first, and ONLY AFTER the duplicate cleanup in
-- docs/phase7/DUPLICATE_CLIENT_REMEDIATION.md is complete and verified.
--
-- It is self-guarding: the transaction ABORTS with a clear error if any
-- duplicate user_id values still exist, so it cannot create a half-built index
-- or fail confusingly mid-way.
--
-- Design notes:
--   * A plain (non-partial) UNIQUE index is used. In PostgreSQL, NULLs are
--     considered DISTINCT in a unique index, so the many placeholder client
--     rows that have user_id IS NULL remain allowed. Uniqueness is enforced
--     only among non-NULL user_id values (the real, auth-linked clients).
--   * A non-partial unique index also serves cleanly as an ON CONFLICT (user_id)
--     arbiter for the idempotent provisioning upsert
--     (see docs/phase7/PENDING_provisioning_upsert.md). A partial index would
--     require a matching WHERE predicate at INSERT time, which the Supabase
--     client cannot express — hence the non-partial form here.
--   * Additive only. Does NOT modify any historical migration.
-- =============================================================================

BEGIN;

-- 1) Abort if duplicates remain. ----------------------------------------------
DO $$
DECLARE
  dup_users  INT;
  dup_rows   BIGINT;
BEGIN
  SELECT count(*), COALESCE(sum(n), 0)
    INTO dup_users, dup_rows
  FROM (
    SELECT user_id, count(*) AS n
    FROM public.clients
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) > 1
  ) d;

  IF dup_users > 0 THEN
    RAISE EXCEPTION
      'ABORT: % auth user(s) still have duplicate client rows (% total rows in duplicate groups). Resolve via docs/phase7/DUPLICATE_CLIENT_REMEDIATION.md before applying this index.',
      dup_users, dup_rows
      USING HINT = 'Run: SELECT user_id, count(*) FROM public.clients WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1;';
  END IF;
END $$;

-- 2) Create the uniqueness protection (idempotent / re-runnable). --------------
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_unique
  ON public.clients (user_id);

COMMENT ON INDEX public.clients_user_id_unique IS
  'Phase 7: one client row per auth user. NULL user_id (placeholders) remain allowed (NULLs are distinct). Arbiter for provisioning ON CONFLICT (user_id).';

COMMIT;

-- =============================================================================
-- VERIFICATION (run after COMMIT; all read-only)
-- =============================================================================
-- a) Confirm the index exists and is unique:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'clients'
--      AND indexname = 'clients_user_id_unique';
--
-- b) Confirm it is enforced as UNIQUE:
--    SELECT i.relname AS index_name, ix.indisunique, ix.indpred IS NOT NULL AS is_partial
--    FROM pg_class t
--    JOIN pg_index ix ON ix.indrelid = t.oid
--    JOIN pg_class i  ON i.oid = ix.indexrelid
--    WHERE t.relname = 'clients' AND i.relname = 'clients_user_id_unique';
--    -- expect indisunique = true, is_partial = false
--
-- c) Prove the guarantee holds (must return zero rows):
--    SELECT user_id, count(*) FROM public.clients
--    WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1;
--
-- d) Optional negative test on STAGING ONLY (expect a unique_violation error):
--    -- INSERT INTO public.clients (user_id, status)
--    -- SELECT user_id, 'onboarding' FROM public.clients
--    -- WHERE user_id IS NOT NULL LIMIT 1;
--
-- ROLLBACK NOTE: to remove this protection,
--    DROP INDEX IF EXISTS public.clients_user_id_unique;
-- =============================================================================
