-- Phase 4X.1: prevent authenticated users from self-updating protected users columns
-- Fixes C-1: users_update_own allowed role/email/id/created_at mutation via browser client
-- Source: docs/SECURITY_AUDIT_REPORT.md (C-1)

-- ---------------------------------------------------------------------------
-- Helper: verify protected fields are unchanged (used by RLS WITH CHECK)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION users_protected_fields_unchanged(
  p_user_id UUID,
  p_new_role user_role,
  p_new_email TEXT,
  p_new_created_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users AS u
    WHERE u.id = p_user_id
      AND u.role IS NOT DISTINCT FROM p_new_role
      AND u.email IS NOT DISTINCT FROM p_new_email
      AND u.created_at IS NOT DISTINCT FROM p_new_created_at
  );
$$;

COMMENT ON FUNCTION users_protected_fields_unchanged(UUID, user_role, TEXT, TIMESTAMPTZ) IS
  'True when proposed users row protected fields match the stored row (RLS self-update guard).';

GRANT EXECUTE ON FUNCTION users_protected_fields_unchanged(UUID, user_role, TEXT, TIMESTAMPTZ)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Trigger: belt-and-suspenders block on protected column mutation
-- service_role exempt (trusted admin API / provisioning paths)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_users_self_update_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'users.role cannot be changed by authenticated users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'users.id cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'users.email cannot be changed directly; use Supabase Auth'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'users.created_at cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_users_self_update_safety() IS
  'Blocks authenticated users from mutating protected users columns; service_role exempt.';

DROP TRIGGER IF EXISTS users_enforce_self_update_safety ON users;
CREATE TRIGGER users_enforce_self_update_safety
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_users_self_update_safety();

-- ---------------------------------------------------------------------------
-- Column-level UPDATE: authenticated may only touch safe profile fields
-- updated_at is managed by users_set_updated_at trigger — not client-writable
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON TABLE users FROM authenticated;
GRANT UPDATE (full_name, avatar_url, organisation) ON TABLE users TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: replace permissive self-update policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_update_own ON users;

CREATE POLICY users_update_own_profile
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND users_protected_fields_unchanged(auth.uid(), role, email, created_at)
  );

COMMENT ON POLICY users_update_own_profile ON users IS
  'Authenticated users may update safe profile columns on their own row only.';
