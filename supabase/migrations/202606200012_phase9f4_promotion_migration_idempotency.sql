-- Phase 9F.4 Checkpoint 3.1 — atomic legacy promotion migration idempotency
-- Additive only. No data mutation, no destructive rollback.
--
-- Guarantees at most one governed_content destination per promotion_id using:
--   1. pg_advisory_xact_lock (concurrency)
--   2. Deterministic governed_content.id via extensions.uuid_generate_v5
--   3. Single-transaction draft insert + promotion_migration_reviews linkage

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
WITH SCHEMA extensions;

-- Stable namespace UUID for legacy promotion migration destinations.
-- Do not rotate without a new migration plan.
-- Name: aegis-wealth-os.phase9f4.legacy_promotion_migration
CREATE OR REPLACE FUNCTION legacy_promotion_migration_destination_id(p_promotion_id UUID)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extensions.uuid_generate_v5(
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
    'legacy_promotion:' || p_promotion_id::text
  );
$$;

COMMENT ON FUNCTION legacy_promotion_migration_destination_id(UUID) IS
  'Deterministic governed_content.id for a legacy promotion migration destination. One promotion maps to one UUID.';

CREATE OR REPLACE FUNCTION execute_legacy_promotion_migration(
  p_promotion_id UUID,
  p_classification TEXT,
  p_reviewer_user_id UUID,
  p_notes TEXT,
  p_title TEXT,
  p_summary TEXT,
  p_body TEXT,
  p_category TEXT,
  p_content_type TEXT,
  p_audience_scope TEXT,
  p_external_url TEXT,
  p_expires_at TIMESTAMPTZ,
  p_adviser_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destination_id UUID;
  v_linked_content_id UUID;
  v_inserted_id UUID;
  v_outcome TEXT;
  v_orphan_recovered BOOLEAN := false;
  v_created BOOLEAN := false;
BEGIN
  IF p_promotion_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'failed', 'reason', 'invalid_promotion_id');
  END IF;

  IF p_classification IS NULL OR p_classification NOT IN (
    'safe_educational', 'market_update_review', 'event', 'product_promotional', 'expired', 'unsuitable'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'failed', 'reason', 'invalid_classification');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('legacy_promotion_migration:' || p_promotion_id::text));

  SELECT migrated_content_id
  INTO v_linked_content_id
  FROM public.promotion_migration_reviews
  WHERE promotion_id = p_promotion_id
  FOR UPDATE;

  IF v_linked_content_id IS NOT NULL THEN
  v_destination_id := public.legacy_promotion_migration_destination_id(p_promotion_id);
    IF v_linked_content_id <> v_destination_id THEN
      RETURN jsonb_build_object(
        'ok', false,
        'outcome', 'conflict',
        'reason', 'linkage_mismatch',
        'content_id', v_linked_content_id,
        'expected_content_id', v_destination_id
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'already_migrated',
      'content_id', v_linked_content_id,
      'skipped', false,
      'reused', true
    );
  END IF;

  IF p_classification IN ('expired', 'unsuitable') THEN
    INSERT INTO public.promotion_migration_reviews (
      promotion_id,
      classification,
      reviewed_by_user_id,
      reviewed_at,
      notes
    )
    VALUES (
      p_promotion_id,
      p_classification,
      p_reviewer_user_id,
      now(),
      COALESCE(NULLIF(btrim(p_notes), ''), 'Review recorded — no governed draft created')
    )
    ON CONFLICT (promotion_id) DO UPDATE SET
      classification = EXCLUDED.classification,
      reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
      reviewed_at = EXCLUDED.reviewed_at,
      notes = EXCLUDED.notes
    WHERE public.promotion_migration_reviews.migrated_content_id IS NULL;

    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'review_only',
      'content_id', NULL,
      'skipped', true
    );
  END IF;

  v_destination_id := public.legacy_promotion_migration_destination_id(p_promotion_id);

  IF EXISTS (SELECT 1 FROM public.governed_content WHERE id = v_destination_id) THEN
    v_orphan_recovered := true;
  ELSE
    INSERT INTO public.governed_content (
      id,
      title,
      summary,
      body,
      category,
      content_type,
      audience_scope,
      target_relationship_stages,
      target_client_ids,
      author_user_id,
      adviser_user_id,
      external_url,
      external_source_name,
      expires_at,
      approval_status,
      version
    )
    VALUES (
      v_destination_id,
      btrim(p_title),
      btrim(p_summary),
      btrim(p_body),
      p_category,
      p_content_type,
      p_audience_scope,
      '{}',
      '{}',
      p_reviewer_user_id,
      p_adviser_user_id,
      NULLIF(btrim(p_external_url), ''),
      'legacy_promotion',
      p_expires_at,
      'draft',
      1
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
      v_created := true;
    ELSE
      v_orphan_recovered := true;
    END IF;
  END IF;

  INSERT INTO public.promotion_migration_reviews (
    promotion_id,
    classification,
    migrated_content_id,
    reviewed_by_user_id,
    reviewed_at,
    notes
  )
  VALUES (
    p_promotion_id,
    p_classification,
    v_destination_id,
    p_reviewer_user_id,
    now(),
    NULLIF(btrim(p_notes), '')
  )
  ON CONFLICT (promotion_id) DO UPDATE SET
    classification = EXCLUDED.classification,
    migrated_content_id = EXCLUDED.migrated_content_id,
    reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
    reviewed_at = EXCLUDED.reviewed_at,
    notes = COALESCE(EXCLUDED.notes, public.promotion_migration_reviews.notes)
  WHERE public.promotion_migration_reviews.migrated_content_id IS NULL
     OR public.promotion_migration_reviews.migrated_content_id = EXCLUDED.migrated_content_id;

  SELECT migrated_content_id
  INTO v_linked_content_id
  FROM public.promotion_migration_reviews
  WHERE promotion_id = p_promotion_id;

  IF v_linked_content_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'outcome', 'failed',
      'reason', 'linkage_failed',
      'content_id', v_destination_id
    );
  END IF;

  IF v_linked_content_id <> v_destination_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'outcome', 'conflict',
      'reason', 'linkage_mismatch',
      'content_id', v_linked_content_id,
      'expected_content_id', v_destination_id
    );
  END IF;

  IF v_orphan_recovered THEN
    v_outcome := 'recovered_orphan';
  ELSIF v_created THEN
    v_outcome := 'created';
  ELSE
    v_outcome := 'reused';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', v_outcome,
    'content_id', v_destination_id,
    'skipped', false,
    'reused', v_outcome IN ('reused', 'recovered_orphan')
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'outcome', 'failed',
      'reason', 'migration_error'
    );
END;
$$;

COMMENT ON FUNCTION execute_legacy_promotion_migration(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID
) IS
  'Atomically creates or recovers a governed draft for a legacy promotion and links promotion_migration_reviews. Service-role only.';

REVOKE ALL ON FUNCTION public.legacy_promotion_migration_destination_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_legacy_promotion_migration(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legacy_promotion_migration_destination_id(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.execute_legacy_promotion_migration(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID
) FROM anon;
REVOKE ALL ON FUNCTION public.legacy_promotion_migration_destination_id(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.execute_legacy_promotion_migration(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.legacy_promotion_migration_destination_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_legacy_promotion_migration(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID
) TO service_role;
