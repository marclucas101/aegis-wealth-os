-- Phase 7: one client row per auth user.
--
-- Additive migration that records the final schema state. The same index was
-- applied manually to production after the duplicate-client cleanup
-- (docs/phase7/DUPLICATE_CLIENT_REMEDIATION.md), so this migration is written to
-- be a safe no-op when the index already exists.
--
-- Design:
--   * Non-partial UNIQUE index on public.clients(user_id). In PostgreSQL, NULLs
--     are considered DISTINCT in a unique index, so placeholder clients created
--     by createPlaceholderClient() with user_id IS NULL remain allowed (any
--     number of them). Uniqueness is enforced only among non-NULL user_id values
--     — the real, auth-linked clients.
--   * Serves as the ON CONFLICT (user_id) arbiter for the idempotent
--     provisioning upsert in lib/supabase/userProfile.ts (provisionClientRow).
--   * IF NOT EXISTS so it is safe when the index was already created manually.
--   * Does NOT modify any historical migration.

CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_unique
  ON public.clients (user_id);

COMMENT ON INDEX public.clients_user_id_unique IS
  'Phase 7: one client row per auth user. NULL user_id (placeholders) remain allowed (NULLs are distinct). Arbiter for provisioning ON CONFLICT (user_id).';
