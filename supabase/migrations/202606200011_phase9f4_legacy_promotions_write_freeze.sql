-- Phase 9F.4 Checkpoint 2 — legacy Promotions write freeze
-- Additive only. Reversible by disabling legacy_promotions_write (no destructive rollback).
-- Does not modify promotions rows, storage buckets, RLS policies, or historical schema.

-- ---------------------------------------------------------------------------
-- Feature control: legacy_promotions_write
-- Operator/admin-only management under existing platform_feature_controls RLS.
-- Default disabled — no automatic enablement. Existing promotion rows untouched.
-- ---------------------------------------------------------------------------
INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  (
    'legacy_promotions_write',
    false,
    false,
    true,
    'Permit legacy Promotions adviser mutations (create, edit, publish, archive, upload). Default disabled during governed-content migration (Phase 9F.4). Re-enable only for emergency operator rollback; do not auto-enable.'
  )
ON CONFLICT (feature_key) DO NOTHING;
