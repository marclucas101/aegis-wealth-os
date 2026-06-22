-- Reusable Phase 9 column catalog + canonical comparison (copy into diagnostics).
-- Marker: phase9_column_compare_v1
column_defs AS (
  SELECT
    cols.table_name || '.' || cols.column_name AS object_name,
    cols.data_type,
    cols.udt_schema,
    cols.udt_name,
    cols.is_nullable,
    COALESCE(cols.column_default, '') AS column_default_raw,
    CASE
      WHEN NULLIF(btrim(COALESCE(cols.column_default, '')), '') IS NULL THEN ''
      WHEN lower(cols.data_type) IN ('json', 'jsonb')
        AND btrim(cols.column_default) ~ '^(\(*\s*)?''?\{\}''?(::jsonb)?\s*\)*$' THEN 'jsonb:{}'
      WHEN lower(cols.data_type) = 'boolean'
        AND lower(
          btrim(
            regexp_replace(
              regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
              '\)+$', '', 'g'
            )
          )
        ) IN ('false', '''false''::boolean', 'false::boolean') THEN 'boolean:false'
      WHEN lower(cols.data_type) = 'boolean'
        AND lower(
          btrim(
            regexp_replace(
              regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
              '\)+$', '', 'g'
            )
          )
        ) IN ('true', '''true''::boolean', 'true::boolean') THEN 'boolean:true'
      WHEN cols.data_type = 'USER-DEFINED' THEN
        'enum:' || cols.udt_name || ':' || COALESCE(
          (regexp_match(
            btrim(
              regexp_replace(
                regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
                '\)+$', '', 'g'
              )
            ),
            '^''([^'']+)''::'
          ))[1],
          (regexp_match(
            btrim(
              regexp_replace(
                regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
                '\)+$', '', 'g'
              )
            ),
            '^''([^'']+)''$'
          ))[1],
          btrim(
            regexp_replace(
              regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
              '\)+$', '', 'g'
            )
          )
        )
      WHEN lower(cols.data_type) = 'text'
        AND btrim(cols.column_default) ~ '^''([^'']+)''(::text)?$' THEN
        'text:' || (regexp_match(btrim(cols.column_default), '^''([^'']+)''(::text)?$'))[1]
      WHEN lower(cols.data_type) = 'text'
        AND btrim(cols.column_default) !~ '[''()]' THEN
        'text:' || btrim(cols.column_default)
      ELSE 'raw:' || btrim(cols.column_default)
    END AS canonical_default,
    (
      CASE
        WHEN cols.data_type = 'USER-DEFINED' THEN 'USER-DEFINED|' || cols.udt_name
        ELSE lower(cols.data_type)
      END
      || '|' || cols.is_nullable
      || '|' ||
      CASE
        WHEN NULLIF(btrim(COALESCE(cols.column_default, '')), '') IS NULL THEN ''
        WHEN lower(cols.data_type) IN ('json', 'jsonb')
          AND btrim(cols.column_default) ~ '^(\(*\s*)?''?\{\}''?(::jsonb)?\s*\)*$' THEN 'jsonb:{}'
        WHEN lower(cols.data_type) = 'boolean'
          AND lower(
            btrim(
              regexp_replace(
                regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
                '\)+$', '', 'g'
              )
            )
          ) IN ('false', '''false''::boolean', 'false::boolean') THEN 'boolean:false'
        WHEN lower(cols.data_type) = 'boolean'
          AND lower(
            btrim(
              regexp_replace(
                regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
                '\)+$', '', 'g'
              )
            )
          ) IN ('true', '''true''::boolean', 'true::boolean') THEN 'boolean:true'
        WHEN cols.data_type = 'USER-DEFINED' THEN
          'enum:' || cols.udt_name || ':' || COALESCE(
            (regexp_match(
              btrim(
                regexp_replace(
                  regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
                  '\)+$', '', 'g'
                )
              ),
              '^''([^'']+)''::'
            ))[1],
            (regexp_match(
              btrim(
                regexp_replace(
                  regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
                  '\)+$', '', 'g'
                )
              ),
              '^''([^'']+)''$'
            ))[1],
            btrim(
              regexp_replace(
                regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'),
                '\)+$', '', 'g'
              )
            )
          )
        WHEN lower(cols.data_type) = 'text'
          AND btrim(cols.column_default) ~ '^''([^'']+)''(::text)?$' THEN
          'text:' || (regexp_match(btrim(cols.column_default), '^''([^'']+)''(::text)?$'))[1]
        WHEN lower(cols.data_type) = 'text'
          AND btrim(cols.column_default) !~ '[''()]' THEN
          'text:' || btrim(cols.column_default)
        ELSE 'raw:' || btrim(cols.column_default)
      END
    ) AS canonical_detail
  FROM information_schema.columns cols
  WHERE cols.table_schema = 'public'
),
expected_column_specs AS (
  SELECT
    e.migration,
    e.check_kind,
    e.object_name,
    e.expected_detail,
    split_part(e.expected_detail, '|', 1) AS exp_data_type,
    split_part(e.expected_detail, '|', 2) AS exp_nullable,
    NULLIF(split_part(e.expected_detail, '|', 3), '') AS exp_default_raw,
    CASE
      WHEN split_part(e.expected_detail, '|', 1) = 'USER-DEFINED' THEN
        CASE e.object_name
          WHEN 'clients.relationship_stage' THEN 'relationship_stage'
          WHEN 'published_outputs.output_audience' THEN 'output_audience'
          WHEN 'published_outputs.publication_status' THEN 'publication_status'
          WHEN 'meeting_sessions.status' THEN 'meeting_session_status'
          WHEN 'meeting_sessions.relationship_stage_at_start' THEN 'relationship_stage'
          ELSE split_part(e.object_name, '.', 2)
        END
      ELSE NULL
    END AS exp_udt_name,
    (
      CASE
        WHEN split_part(e.expected_detail, '|', 1) = 'USER-DEFINED' THEN
          'USER-DEFINED|' ||
          CASE e.object_name
            WHEN 'clients.relationship_stage' THEN 'relationship_stage'
            WHEN 'published_outputs.output_audience' THEN 'output_audience'
            WHEN 'published_outputs.publication_status' THEN 'publication_status'
            WHEN 'meeting_sessions.status' THEN 'meeting_session_status'
            WHEN 'meeting_sessions.relationship_stage_at_start' THEN 'relationship_stage'
            ELSE split_part(e.object_name, '.', 2)
          END
        ELSE lower(split_part(e.expected_detail, '|', 1))
      END
      || '|' || split_part(e.expected_detail, '|', 2)
      || '|' ||
      CASE
        WHEN NULLIF(split_part(e.expected_detail, '|', 3), '') IS NULL THEN ''
        WHEN split_part(e.expected_detail, '|', 1) = 'USER-DEFINED' THEN
          'enum:' ||
          CASE e.object_name
            WHEN 'clients.relationship_stage' THEN 'relationship_stage'
            WHEN 'published_outputs.output_audience' THEN 'output_audience'
            WHEN 'published_outputs.publication_status' THEN 'publication_status'
            WHEN 'meeting_sessions.status' THEN 'meeting_session_status'
            WHEN 'meeting_sessions.relationship_stage_at_start' THEN 'relationship_stage'
            ELSE split_part(e.object_name, '.', 2)
          END
          || ':' || split_part(e.expected_detail, '|', 3)
        WHEN lower(split_part(e.expected_detail, '|', 1)) IN ('json', 'jsonb')
          AND split_part(e.expected_detail, '|', 3) = '{}' THEN 'jsonb:{}'
        WHEN lower(split_part(e.expected_detail, '|', 1)) = 'boolean' THEN
          'boolean:' || lower(split_part(e.expected_detail, '|', 3))
        WHEN lower(split_part(e.expected_detail, '|', 1)) = 'text' THEN
          'text:' || split_part(e.expected_detail, '|', 3)
        ELSE 'raw:' || split_part(e.expected_detail, '|', 3)
      END
    ) AS expected_canonical_detail
  FROM expected_checks e
  WHERE e.check_kind = 'column'
)
