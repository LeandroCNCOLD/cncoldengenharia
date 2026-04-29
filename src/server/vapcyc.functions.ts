// Server functions for VAPCYC compressor + system simulation.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { simulateCompressor } from '@/modules/coldpro/system/vapcycCompressorEngine';
import { simulateSystemVapcyc } from '@/modules/coldpro/system/vapcycSystemSimulator';

const compressorInput = z.object({
  compressorId: z.string().uuid().optional(),
  sourceTableKey: z.string().optional(),
  evaporatingTempC: z.number(),
  condensingTempC: z.number(),
});

export const runVapcycCompressor = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => compressorInput.parse(d))
  .handler(async ({ data, context }) => {
    return simulateCompressor(context.supabase, data);
  });

const systemInput = z.object({
  evaporatorGeometryCode: z.string(),
  condenserGeometryCode: z.string(),
  refrigerant: z.string(),
  evaporatingTempC: z.number(),
  condensingTempC: z.number(),
  airInletEvapC: z.number(),
  airInletCondC: z.number(),
  airflowEvapM3h: z.number(),
  airflowCondM3h: z.number(),
  compressorId: z.string().uuid().optional(),
  compressorSourceTableKey: z.string().optional(),
  superheatK: z.number().default(8),
  subcoolingK: z.number().default(3),
  tolerance: z.number().optional(),
  maxIterations: z.number().int().optional(),
});

export const runVapcycSystemSimulation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => systemInput.parse(d))
  .handler(async ({ data, context }) => {
    const result = await simulateSystemVapcyc(context.supabase, data);
    return JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  });

const searchInput = z.object({
  refrigerant: z.string().optional(),
  manufacturer: z.string().optional(),
  applicationType: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().max(200).default(50),
});

export const searchVapcycCompressors = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => searchInput.parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from('compressor_models')
      .select('id, manufacturer, model, refrigerant, application_type, displacement, voltage_v, frequency_hz, temp_evap_min_c, temp_evap_max_c, temp_cond_min_c, temp_cond_max_c, source_db, source_table_key')
      .not('source_db', 'is', null)
      .order('manufacturer')
      .order('model')
      .limit(data.limit);
    if (data.refrigerant) q = q.eq('refrigerant', data.refrigerant);
    if (data.manufacturer) q = q.eq('manufacturer', data.manufacturer);
    if (data.applicationType) q = q.eq('application_type', data.applicationType);
    if (data.query) q = q.ilike('model', `%${data.query}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
