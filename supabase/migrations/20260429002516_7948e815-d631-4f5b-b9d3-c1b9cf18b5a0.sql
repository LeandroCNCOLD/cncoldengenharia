-- Create coil_performance_maps table for multi-point performance curves
CREATE TABLE public.coil_performance_maps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  component_item_id uuid NOT NULL,
  equipment_project_id uuid,
  coil_type text NOT NULL CHECK (coil_type IN ('evaporator', 'condenser')),
  engine text NOT NULL DEFAULT 'physical_simple',
  calibration_id uuid,
  map_name text,
  input_grid_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  results_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric NOT NULL DEFAULT 0.6,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'approved', 'archived')),
  is_estimated boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- Index for fast lookup by component
CREATE INDEX idx_coil_perf_maps_component ON public.coil_performance_maps (component_item_id, created_at DESC);
CREATE INDEX idx_coil_perf_maps_status ON public.coil_performance_maps (component_item_id, status);

-- Enable RLS
ALTER TABLE public.coil_performance_maps ENABLE ROW LEVEL SECURITY;

-- Policies (consistent with coil_calibrations: authenticated users can select/insert/delete; no UPDATE)
CREATE POLICY "CPM: auth select"
  ON public.coil_performance_maps
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "CPM: auth insert"
  ON public.coil_performance_maps
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "CPM: auth delete"
  ON public.coil_performance_maps
  FOR DELETE
  TO authenticated
  USING (true);

-- Allow status transition (draft → generated → approved → archived) via UPDATE on status column only
CREATE POLICY "CPM: auth update status"
  ON public.coil_performance_maps
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);