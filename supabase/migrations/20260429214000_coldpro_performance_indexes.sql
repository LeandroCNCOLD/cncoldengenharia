-- Safe additive indexes for ColdPro bulk technical data browsing.
-- These do not change table data or behavior.

CREATE INDEX IF NOT EXISTS idx_coil_geometry_factors_mode_sigla
  ON public.coil_geometry_factors (mode, sigla);

CREATE INDEX IF NOT EXISTS idx_coil_geometry_factors_mode_geometry_code
  ON public.coil_geometry_factors (mode, geometry_code);

CREATE INDEX IF NOT EXISTS idx_coil_geometry_factors_mode_source_table
  ON public.coil_geometry_factors (mode, source_table);

CREATE INDEX IF NOT EXISTS idx_coil_simulations_project_created
  ON public.coil_simulations (equipment_project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coil_calibrations_component_created
  ON public.coil_calibrations (component_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coil_calibrations_component_active
  ON public.coil_calibrations (component_item_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coil_performance_maps_component_created
  ON public.coil_performance_maps (component_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_projects_status_updated
  ON public.equipment_projects (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_compressor_models_manufacturer_model
  ON public.compressor_models (manufacturer, model);

CREATE INDEX IF NOT EXISTS idx_fan_models_manufacturer_model
  ON public.fan_models (manufacturer, model);

CREATE INDEX IF NOT EXISTS idx_fan_curves_fan_id
  ON public.fan_curves (fan_id);

CREATE INDEX IF NOT EXISTS idx_unilab_geometries_code_mode
  ON public.unilab_geometries (geometry_code, mode);
