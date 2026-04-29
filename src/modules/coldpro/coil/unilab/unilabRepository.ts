// Camada de acesso aos dados Unilab (geometria, fatores, fluidos).
// Implementada como server functions (createServerFn) — nunca importe direto
// em código de browser. O motor híbrido recebe o bundle já resolvido.

import { createServerFn } from '@tanstack/react-start';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import {
  mapFactorsRow,
  mapFluidRow,
  mapGeometryRow,
  type FluidRow,
  type GeometryRow,
} from './unilabMapper';
import type {
  UnilabBundle,
  UnilabFluidProperties,
  UnilabGeometry,
  UnilabGeometryFactors,
} from './unilabTypes';

const GEOMETRY_COLUMNS = `
  geometry_code, sigla, mode, fin_type, tube_type,
  tube_outer_diameter_mm, tube_spacing_mm, row_spacing_mm, fin_thickness_mm,
  fat_cor_al, fat_coef_lato_tubo, fat_rid_aum_sup,
  fattore_attr_aria, fattore_attr_aria_latente, fat_corr_fat_attr,
  slope_fat_cor_al, slope_fat_coef_lato_tubo, slope_fattore_attr_aria,
  security_factor, raw_json
`;

async function fetchGeometryRow(code: string): Promise<GeometryRow | null> {
  const { data, error } = await supabaseAdmin
    .from('coil_geometry_factors')
    .select(GEOMETRY_COLUMNS)
    .eq('geometry_code', code)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Unilab geometry lookup failed: ${error.message}`);
  return (data as GeometryRow) ?? null;
}

export const getGeometryByCode = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => {
    const code = (data as { code?: unknown })?.code;
    if (typeof code !== 'string' || !code) throw new Error('code is required');
    return { code };
  })
  .handler(async ({ data }): Promise<UnilabGeometry | null> => {
    const row = await fetchGeometryRow(data.code);
    return row ? mapGeometryRow(row) : null;
  });

export const getFactorsByGeometry = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => {
    const code = (data as { code?: unknown })?.code;
    if (typeof code !== 'string' || !code) throw new Error('code is required');
    return { code };
  })
  .handler(async ({ data }): Promise<UnilabGeometryFactors | null> => {
    const row = await fetchGeometryRow(data.code);
    return row ? mapFactorsRow(row) : null;
  });

export const getUnilabBundle = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => {
    const code = (data as { code?: unknown })?.code;
    if (typeof code !== 'string' || !code) throw new Error('code is required');
    return { code };
  })
  .handler(async ({ data }): Promise<UnilabBundle> => {
    const warnings: string[] = [];
    const row = await fetchGeometryRow(data.code);
    if (!row) {
      warnings.push(`Geometria "${data.code}" não encontrada no catálogo Unilab — usando fallback.`);
      return { geometry: null, factors: null, source: 'fallback', warnings };
    }
    const geometry = mapGeometryRow(row);
    const factors = mapFactorsRow(row);
    const allFactorsNeutral =
      factors.fatCorAl === 1 &&
      factors.fatCoeflattub === 1 &&
      factors.fatRidAumSup === 1 &&
      factors.fattoreAttrAria === 1 &&
      factors.securityFactor === 1;
    if (allFactorsNeutral) {
      warnings.push(
        `Fatores Unilab da geometria ${data.code} estão todos neutros (=1). Resultado é parcialmente estimado.`,
      );
      return { geometry, factors, source: 'partial', warnings };
    }
    return { geometry, factors, source: 'unilab', warnings };
  });

export const getFluidProperties = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => {
    const fluid = (data as { fluid?: unknown })?.fluid;
    const temperatureC = Number((data as { temperatureC?: unknown })?.temperatureC ?? 0);
    if (typeof fluid !== 'string' || !fluid) throw new Error('fluid is required');
    if (!Number.isFinite(temperatureC)) throw new Error('temperatureC must be a number');
    return { fluid, temperatureC };
  })
  .handler(async ({ data }): Promise<UnilabFluidProperties | null> => {
    const { data: row, error } = await supabaseAdmin
      .from('coil_fluids')
      .select(
        'name, liquid_density_kg_m3, vapour_density_kg_m3, liquid_cp_kj_kgk, vapour_cp_kj_kgk, liquid_viscosity_upa_s, vapour_viscosity_upa_s, liquid_conductivity_w_mk, latent_heat_kj_kg',
      )
      .ilike('name', data.fluid)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Unilab fluid lookup failed: ${error.message}`);
    if (!row) return null;
    return mapFluidRow(row as FluidRow, data.temperatureC);
  });
