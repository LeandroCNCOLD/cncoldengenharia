-- ColdPro logical backup before imported-data reset.
--
-- IMPORTANT:
-- - Run this BEFORE scripts/coldpro-reset/reset_imported_data.sql.
-- - This script preserves schema, RLS, functions, users, profiles and roles.
-- - It recreates the backup_* tables listed below with the current data snapshot.
-- - For an external/offline backup, also run `pg_dump` before this script.

BEGIN;

DO $$
DECLARE
  pair text[];
  backup_table text;
  source_table text;
  table_pairs constant text[][] := ARRAY[
    ARRAY['backup_technical_components', 'technical_components'],
    ARRAY['backup_technical_mapped_records', 'technical_mapped_records'],
    ARRAY['backup_cn_catalog_performance_curves', 'cn_catalog_performance_curves'],
    ARRAY['backup_equipment_projects', 'equipment_projects'],
    ARRAY['backup_component_items', 'component_items'],
    ARRAY['backup_equipment_component_links', 'equipment_component_links'],
    ARRAY['backup_evaporator_coil_models', 'evaporator_coil_models'],
    ARRAY['backup_condenser_coil_models', 'condenser_coil_models'],
    ARRAY['backup_coil_simulations', 'coil_simulations'],
    ARRAY['backup_coil_calibrations', 'coil_calibrations']
  ];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY table_pairs LOOP
    backup_table := pair[1];
    source_table := pair[2];
    EXECUTE format('DROP TABLE IF EXISTS public.%I', backup_table);
    IF to_regclass('public.' || source_table) IS NOT NULL THEN
      EXECUTE format(
        'CREATE TABLE public.%I AS SELECT now() AS backup_created_at, * FROM public.%I',
        backup_table,
        source_table
      );
      RAISE NOTICE 'Created backup table public.% from public.%', backup_table, source_table;
    ELSE
      RAISE NOTICE 'Skip backup for missing source table public.%', source_table;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Optional quick check:
-- SELECT 'backup_technical_components' AS table_name, count(*) FROM public.backup_technical_components
-- UNION ALL SELECT 'backup_technical_mapped_records', count(*) FROM public.backup_technical_mapped_records
-- UNION ALL SELECT 'backup_cn_catalog_performance_curves', count(*) FROM public.backup_cn_catalog_performance_curves
-- UNION ALL SELECT 'backup_equipment_projects', count(*) FROM public.backup_equipment_projects
-- UNION ALL SELECT 'backup_component_items', count(*) FROM public.backup_component_items
-- UNION ALL SELECT 'backup_equipment_component_links', count(*) FROM public.backup_equipment_component_links
-- UNION ALL SELECT 'backup_evaporator_coil_models', count(*) FROM public.backup_evaporator_coil_models
-- UNION ALL SELECT 'backup_condenser_coil_models', count(*) FROM public.backup_condenser_coil_models
-- UNION ALL SELECT 'backup_coil_simulations', count(*) FROM public.backup_coil_simulations
-- UNION ALL SELECT 'backup_coil_calibrations', count(*) FROM public.backup_coil_calibrations;
