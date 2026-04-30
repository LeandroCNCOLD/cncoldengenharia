-- ColdPro safe reset verification.
-- Read-only script: counts key tables after reset.

WITH tables(table_name) AS (
  VALUES
    ('cn_catalog_performance_curves'),
    ('technical_components'),
    ('technical_mapped_records'),
    ('equipment_projects'),
    ('component_items'),
    ('compressor_models'),
    ('fan_models'),
    ('refrigerants'),
    ('unilab_geometries'),
    ('coil_geometry_factors')
)
SELECT
  table_name,
  CASE
    WHEN to_regclass('public.' || table_name) IS NULL THEN NULL
    ELSE (
      xpath(
        '/row/c/text()',
        query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')
      )
    )[1]::text::bigint
  END AS row_count,
  to_regclass('public.' || table_name) IS NOT NULL AS table_exists
FROM tables
ORDER BY table_name;

