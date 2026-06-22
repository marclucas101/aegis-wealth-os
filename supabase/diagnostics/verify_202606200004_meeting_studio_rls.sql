-- Read-only verification for 202606200004_phase9c_meeting_studio_rls_documentation.sql

WITH checks AS (
  SELECT * FROM (VALUES
    ('202606200004','policy_comment','meeting_sessions_select_adviser','Assigned adviser or admin SELECT only'),
    ('202606200004','policy_comment','meeting_session_events_select_adviser','Assigned adviser or admin SELECT only'),
    ('202606200004','no_client_policy','meeting_sessions',''),
    ('202606200004','no_client_policy','meeting_session_events','')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
policy_comments AS (
  SELECT
    pol.policyname,
    d.description
  FROM pg_policy pp
  JOIN pg_class c ON c.oid = pp.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_policies pol ON pol.schemaname = n.nspname AND pol.tablename = c.relname AND pol.policyname = pp.polname
  LEFT JOIN pg_description d ON d.objoid = pp.oid
  WHERE n.nspname = 'public'
),
client_policy_counts AS (
  SELECT
    tablename,
    COUNT(*) FILTER (WHERE policyname ILIKE '%client%') AS client_named_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('meeting_sessions','meeting_session_events')
  GROUP BY tablename
)
SELECT
  c.migration,
  c.check_kind || ':' || c.object_name AS check_id,
  c.object_name AS expected_object,
  CASE
    WHEN c.check_kind = 'policy_comment' THEN pc.policyname IS NOT NULL
    WHEN c.check_kind = 'no_client_policy' THEN TRUE
    ELSE NULL::boolean
  END AS present,
  CASE
    WHEN c.check_kind = 'policy_comment' AND pc.policyname IS NULL THEN 'absent'
    WHEN c.check_kind = 'policy_comment' AND (pc.description IS NULL OR pc.description NOT ILIKE '%' || c.expected_detail || '%') THEN 'conflicting'
    WHEN c.check_kind = 'no_client_policy' AND COALESCE(cp.client_named_policies,0) > 0 THEN 'conflicting'
    ELSE 'present'
  END AS state,
  CASE
    WHEN c.check_kind = 'policy_comment' THEN pc.description
    ELSE 'client_named_policies=' || COALESCE(cp.client_named_policies,0)::text
  END AS detail
FROM checks c
LEFT JOIN policy_comments pc ON c.check_kind = 'policy_comment' AND pc.policyname = c.object_name
LEFT JOIN client_policy_counts cp ON c.check_kind = 'no_client_policy' AND cp.tablename = c.object_name
ORDER BY check_id;

-- Rollup
WITH summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (
      WHERE (c.check_kind = 'policy_comment' AND pc.policyname IS NOT NULL AND pc.description ILIKE '%' || c.expected_detail || '%')
         OR (c.check_kind = 'no_client_policy' AND COALESCE(cp.client_named_policies,0) = 0)
    ) AS present_checks,
    COUNT(*) FILTER (WHERE c.check_kind = 'policy_comment' AND pc.policyname IS NULL) AS absent_checks,
    COUNT(*) FILTER (
      WHERE (c.check_kind = 'policy_comment' AND pc.policyname IS NOT NULL AND (pc.description IS NULL OR pc.description NOT ILIKE '%' || c.expected_detail || '%'))
         OR (c.check_kind = 'no_client_policy' AND COALESCE(cp.client_named_policies,0) > 0)
    ) AS conflicting_checks
  FROM (
    SELECT * FROM (VALUES
      ('policy_comment','meeting_sessions_select_adviser','Assigned adviser or admin SELECT only'),
      ('policy_comment','meeting_session_events_select_adviser','Assigned adviser or admin SELECT only'),
      ('no_client_policy','meeting_sessions',''),
      ('no_client_policy','meeting_session_events','')
    ) AS t(check_kind, object_name, expected_detail)
  ) c
  LEFT JOIN (
    SELECT pol.policyname, d.description
    FROM pg_policy pp
    JOIN pg_class cl ON cl.oid = pp.polrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_policies pol ON pol.schemaname = n.nspname AND pol.tablename = cl.relname AND pol.policyname = pp.polname
    LEFT JOIN pg_description d ON d.objoid = pp.oid
    WHERE n.nspname = 'public'
  ) pc ON c.check_kind = 'policy_comment' AND pc.policyname = c.object_name
  LEFT JOIN (
    SELECT tablename, COUNT(*) FILTER (WHERE policyname ILIKE '%client%') AS client_named_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('meeting_sessions','meeting_session_events')
    GROUP BY tablename
  ) cp ON c.check_kind = 'no_client_policy' AND cp.tablename = c.object_name
)
SELECT
  '202606200004' AS migration,
  total_required_checks,
  present_checks,
  absent_checks,
  conflicting_checks,
  0::bigint AS unknown_checks,
  CASE
    WHEN present_checks = total_required_checks AND absent_checks = 0 AND conflicting_checks = 0 THEN 'EXACT_MATCH'
    WHEN present_checks = 0 AND absent_checks > 0 AND conflicting_checks = 0 THEN 'ABSENT'
    WHEN conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN present_checks > 0 AND absent_checks > 0 THEN 'PARTIAL_MATCH'
    ELSE 'UNKNOWN'
  END AS classification
FROM summary;
