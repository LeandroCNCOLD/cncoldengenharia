-- Drop trigger functions (CASCADE removes any triggers depending on them)
DROP FUNCTION IF EXISTS public.trg_cn_curve_to_product_dev() CASCADE;
DROP FUNCTION IF EXISTS public.trg_invalidate_cn_compressor() CASCADE;
DROP FUNCTION IF EXISTS public.trg_invalidate_cn_fan() CASCADE;
DROP FUNCTION IF EXISTS public.trg_invalidate_cn_coil() CASCADE;
DROP FUNCTION IF EXISTS public.trg_invalidate_cn_valve() CASCADE;
DROP FUNCTION IF EXISTS public.trg_invalidate_cn_tech_components() CASCADE;
DROP FUNCTION IF EXISTS public.invalidate_cn_suggestions_for_type(text) CASCADE;

-- Drop tables (CASCADE handles FK dependencies)
DROP TABLE IF EXISTS public.cn_product_development CASCADE;
DROP TABLE IF EXISTS public.cn_catalog_component_suggestions CASCADE;
DROP TABLE IF EXISTS public.cn_catalog_performance_curves CASCADE;
DROP TABLE IF EXISTS public.cn_catalog_raw_rows CASCADE;
DROP TABLE IF EXISTS public.cn_catalog_columns_audit CASCADE;
DROP TABLE IF EXISTS public.cn_catalog_import_batches CASCADE;
DROP TABLE IF EXISTS public.cn_equipment_reheat_master CASCADE;
DROP TABLE IF EXISTS public.cn_equipment_performance_master CASCADE;
DROP TABLE IF EXISTS public.cn_equipment_compressor_master CASCADE;
DROP TABLE IF EXISTS public.cn_equipment_condenser_master CASCADE;
DROP TABLE IF EXISTS public.cn_equipment_evaporator_master CASCADE;
DROP TABLE IF EXISTS public.cn_equipment_master CASCADE;