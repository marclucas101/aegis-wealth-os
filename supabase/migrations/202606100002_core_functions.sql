-- Phase 3A: shared trigger utility
-- Source: docs/database-schema.md §4
-- Note: RLS helpers live in 003 (need users/clients); owns_shield_score in 006.

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
