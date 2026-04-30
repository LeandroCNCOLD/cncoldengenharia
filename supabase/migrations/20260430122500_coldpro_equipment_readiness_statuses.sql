-- ColdPro equipment technical readiness statuses.
-- Safe additive enum migration for AutoFill/readiness flow.

ALTER TYPE public.equipment_project_status ADD VALUE IF NOT EXISTS 'autofilled';
ALTER TYPE public.equipment_project_status ADD VALUE IF NOT EXISTS 'evap_ready';
ALTER TYPE public.equipment_project_status ADD VALUE IF NOT EXISTS 'cond_ready';
ALTER TYPE public.equipment_project_status ADD VALUE IF NOT EXISTS 'components_ready';
ALTER TYPE public.equipment_project_status ADD VALUE IF NOT EXISTS 'simulation_ready';
ALTER TYPE public.equipment_project_status ADD VALUE IF NOT EXISTS 'simulated';
ALTER TYPE public.equipment_project_status ADD VALUE IF NOT EXISTS 'needs_review';

ALTER TYPE public.component_status ADD VALUE IF NOT EXISTS 'needs_mapping';

ALTER TYPE public.equipment_component_role ADD VALUE IF NOT EXISTS 'refrigerant';
