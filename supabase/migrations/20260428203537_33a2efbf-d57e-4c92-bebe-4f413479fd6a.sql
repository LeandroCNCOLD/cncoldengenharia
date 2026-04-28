ALTER TABLE public.components 
ADD COLUMN IF NOT EXISTS conflicts jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_components_status_type ON public.components(status, type);
CREATE INDEX IF NOT EXISTS idx_component_files_component ON public.component_files(component_id);
CREATE INDEX IF NOT EXISTS idx_component_data_component ON public.component_data(component_id);