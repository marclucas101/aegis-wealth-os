-- Discrepancy checks for 202606200011 vs expected Phase 9F.4 write-freeze contract.
-- Returns check_id, expected, observed, classification (match|conflicting|unknown).

WITH refs AS (
  SELECT
    to_regclass('public.platform_feature_controls') IS NOT NULL AS fc_exists,
    to_regclass('public.promotions') IS NOT NULL AS promotions_exists
),
expected AS (
  SELECT *
  FROM (VALUES
    ('202606200011', 'seed', 'platform_feature_controls.legacy_promotions_write', 'present'),
    ('202606200011', 'seed_attr', 'platform_feature_controls.legacy_promotions_write', 'enabled|false'),
    ('202606200011', 'seed_attr', 'platform_feature_controls.legacy_promotions_write', 'client_visible|false'),
    ('202606200011', 'prereq_table', 'platform_feature_controls', NULL),
    ('202606200011', 'prereq_table', 'promotions', NULL),
    ('202606200011', 'absent_seed', 'platform_feature_controls.legacy_promotions_ui', NULL)
  ) AS t(migration, check_kind, object_name, expected_value)
),
seed_present AS (
  SELECT EXISTS (
    SELECT 1 FROM platform_feature_controls WHERE feature_key = 'legacy_promotions_write'
  ) AS legacy_write_present
  WHERE (SELECT fc_exists FROM refs)
),
seed_attrs AS (
  SELECT enabled, client_visible
  FROM platform_feature_controls
  WHERE feature_key = 'legacy_promotions_write'
  LIMIT 1
),
ui_seed AS (
  SELECT EXISTS (
    SELECT 1 FROM platform_feature_controls WHERE feature_key = 'legacy_promotions_ui'
  ) AS legacy_ui_present
  WHERE (SELECT fc_exists FROM refs)
)
SELECT
  e.check_id,
  e.expected_value AS expected,
  CASE
    WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.legacy_promotions_write'
      THEN CASE WHEN (SELECT legacy_write_present FROM seed_present) THEN 'present' ELSE 'absent' END
    WHEN e.check_kind = 'seed_attr' AND e.expected_value = 'enabled|false'
      THEN CASE WHEN (SELECT enabled FROM seed_attrs) IS FALSE THEN 'enabled|false' ELSE 'enabled|true' END
    WHEN e.check_kind = 'seed_attr' AND e.expected_value = 'client_visible|false'
      THEN CASE WHEN (SELECT client_visible FROM seed_attrs) IS FALSE THEN 'client_visible|false' ELSE 'client_visible|true' END
    WHEN e.check_kind = 'prereq_table' AND e.object_name = 'platform_feature_controls'
      THEN CASE WHEN (SELECT fc_exists FROM refs) THEN 'present' ELSE 'absent' END
    WHEN e.check_kind = 'prereq_table' AND e.object_name = 'promotions'
      THEN CASE WHEN (SELECT promotions_exists FROM refs) THEN 'present' ELSE 'absent' END
    WHEN e.check_kind = 'absent_seed' AND e.object_name = 'platform_feature_controls.legacy_promotions_ui'
      THEN CASE WHEN (SELECT legacy_ui_present FROM ui_seed) THEN 'present' ELSE 'absent' END
    ELSE 'unknown'
  END AS observed,
  CASE
    WHEN e.check_kind = 'seed' AND (SELECT fc_exists FROM refs) IS NOT TRUE THEN 'unknown'
    WHEN e.check_kind = 'seed' AND (SELECT legacy_write_present FROM seed_present) THEN 'match'
    WHEN e.check_kind = 'seed' THEN 'conflicting'
    WHEN e.check_kind = 'seed_attr' AND (SELECT fc_exists FROM refs) IS NOT TRUE THEN 'unknown'
    WHEN e.check_kind = 'seed_attr' AND e.expected_value = 'enabled|false' AND (SELECT enabled FROM seed_attrs) IS FALSE THEN 'match'
    WHEN e.check_kind = 'seed_attr' AND e.expected_value = 'client_visible|false' AND (SELECT client_visible FROM seed_attrs) IS FALSE THEN 'match'
    WHEN e.check_kind = 'seed_attr' THEN 'conflicting'
    WHEN e.check_kind = 'prereq_table' AND e.object_name = 'platform_feature_controls' AND (SELECT fc_exists FROM refs) THEN 'match'
    WHEN e.check_kind = 'prereq_table' AND e.object_name = 'promotions' AND (SELECT promotions_exists FROM refs) THEN 'match'
    WHEN e.check_kind = 'prereq_table' THEN 'conflicting'
    WHEN e.check_kind = 'absent_seed' AND (SELECT fc_exists FROM refs) IS NOT TRUE THEN 'unknown'
    WHEN e.check_kind = 'absent_seed' AND NOT (SELECT legacy_ui_present FROM ui_seed) THEN 'match'
    WHEN e.check_kind = 'absent_seed' THEN 'conflicting'
    ELSE 'unknown'
  END AS classification
FROM (
  SELECT migration || '.' || check_kind || '.' || object_name AS check_id, migration, check_kind, object_name, expected_value
  FROM expected
) e
ORDER BY check_id;
