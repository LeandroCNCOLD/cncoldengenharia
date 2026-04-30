-- ColdPro safe reset script.
--
-- IMPORTANT:
-- - Review and run backup_before_reset.sql successfully before this script.
-- - This script intentionally does NOT touch auth users, profiles, user_roles,
--   migrations, functions, RLS policies, or schema definitions.
-- - It truncates only existing imported-data tables from the allowlist below.

BEGIN;

DO $$
DECLARE
  table_name text;
  existing_tables text[] := ARRAY[]::text[];
  requested_tables constant text[] := ARRAY[
    'cn_catalog_component_suggestions',
    'cn_product_development',
    'cn_catalog_performance_curves',
    'technical_mapped_records',
    'technical_raw_records',
    'technical_import_batches',
    'technical_components',
    'equipment_component_links',
    'component_items',
    'equipment_simulations',
    'equipment_projects',
    'evaporator_coil_models',
    'condenser_coil_models',
    'coil_simulations',
    'coil_calibrations',
    'coil_performance_maps',
    'compressor_polynomials',
    'compressor_models',
    'fan_curves',
    'fan_models',
    'refrigerant_polynomials',
    'refrigerants',
    'coil_fluids',
    'coil_materials',
    'coil_correlations',
    'coil_geometry_factors',
    'unilab_geometries_factors',
    'unilab_geometries',
    'unilab_raw_tables',
    'unilab_source_rows',
    'unilab_source_files',
    'unilab_import_batches',
    'unilab_import_batches_v2',
    'unilab_extractions',
    'coil_factor_application_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY requested_tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      existing_tables := array_append(existing_tables, format('public.%I', table_name));
    ELSE
      RAISE NOTICE 'Skip missing table public.%', table_name;
    END IF;
  END LOOP;

  IF array_length(existing_tables, 1) IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(existing_tables, ', ') || ' RESTART IDENTITY CASCADE';
    RAISE NOTICE 'Truncated tables: %', array_to_string(existing_tables, ', ');
  ELSE
    RAISE NOTICE 'No requested tables exist. Nothing truncated.';
  END IF;
END $$;

COMMIT;
