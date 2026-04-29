// ColdPro — VAPCYC compressor engine.
//
// Reads polynomial coefficients from compressor_models + compressor_polynomials
// (loaded from VAPCYC dump). Coefficients are stored in their NATIVE units —
// AHRI 540 imperial: Te,Tc in °F; capacity/power in Btu/hr or W; mass-flow in
// lbm/hr; current in A. We convert at runtime.
//
// Polynomial form (AHRI 540 / EN 12900 — 10 coeffs):
//   X = c0 + c1·S + c2·D + c3·S² + c4·S·D + c5·D²
//          + c6·S³ + c7·D·S² + c8·S·D² + c9·D³
// where S = saturated suction temperature, D = saturated discharge temperature.

import type { SupabaseClient } from '@supabase/supabase-js';

export type VapcycCurveType = 'capacity' | 'power' | 'current' | 'mass_flow';

export interface VapcycCompressorRecord {
  id: string;
  manufacturer: string | null;
  model: string;
  refrigerant: string;
  application_type: string | null;
  units_system: string | null;
  motor_efficiency: number | null;
  massflow_correction: number | null;
  power_correction: number | null;
  voltage_v: number | null;
  frequency_hz: number | null;
  rpm: number | null;
  temp_evap_min_c: number | null;
  temp_evap_max_c: number | null;
  temp_cond_min_c: number | null;
  temp_cond_max_c: number | null;
  source_db: string | null;
  source_table_key: string | null;
}

export interface VapcycPolynomialRecord {
  curve_type: VapcycCurveType;
  unit_system: string;
  coefficients_json: number[];
}

export interface SimulateCompressorInput {
  compressorId?: string;
  sourceTableKey?: string;
  evaporatingTempC: number;
  condensingTempC: number;
}

export interface SimulateCompressorResult {
  compressorId: string;
  model: string;
  manufacturer: string | null;
  refrigerant: string;
  evaporatingTempC: number;
  condensingTempC: number;
  capacityW: number;
  powerW: number;
  currentA: number;
  massFlowKgh: number;
  copCooling: number;
  copHeating: number;
  inEnvelope: boolean;
  envelopeWarnings: string[];
  unitSystem: string;
  warnings: string[];
}

const C_TO_F = (c: number) => (c * 9) / 5 + 32;
const BTU_HR_TO_W = 0.29307107;
const LBM_HR_TO_KG_HR = 0.45359237;

function evalAhri540(coeffs: number[], sF: number, dF: number): number {
  const [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9] = coeffs;
  return (
    c0 +
    c1 * sF +
    c2 * dF +
    c3 * sF * sF +
    c4 * sF * dF +
    c5 * dF * dF +
    c6 * sF * sF * sF +
    c7 * dF * sF * sF +
    c8 * sF * dF * dF +
    c9 * dF * dF * dF
  );
}

/**
 * Detects the unit token convention.
 * Examples:
 *   "[degF,Btu_hr,A,lbm_hr,W]"            — capacity in Btu/hr
 *   "[ft, degF, Btu_hr, A, lbm_hr, W]"    — same
 * If "Btu_hr" appears we convert capacity & power; if "kW" we don't, etc.
 */
function unitsHaveBtu(units: string | null): boolean {
  if (!units) return true; // safe default for VAPCYC
  return /btu/i.test(units);
}

function unitsHaveLbm(units: string | null): boolean {
  if (!units) return true;
  return /lbm/i.test(units);
}

/**
 * Pure compressor evaluator — given fully-loaded model + polys, compute
 * capacity / power / current / mass-flow at (Te,Tc) in °C.
 */
export function evaluateCompressor(
  model: VapcycCompressorRecord,
  polys: VapcycPolynomialRecord[],
  evaporatingTempC: number,
  condensingTempC: number,
): SimulateCompressorResult {
  const sF = C_TO_F(evaporatingTempC);
  const dF = C_TO_F(condensingTempC);

  const find = (t: VapcycCurveType) => polys.find((p) => p.curve_type === t);
  const cap = find('capacity');
  const pow = find('power');
  const cur = find('current');
  const mf = find('mass_flow');

  const warnings: string[] = [];

  // Capacity (Btu/hr → W if needed)
  let capacityW = 0;
  if (cap?.coefficients_json?.length === 10) {
    const raw = evalAhri540(cap.coefficients_json, sF, dF);
    capacityW = unitsHaveBtu(cap.unit_system) ? raw * BTU_HR_TO_W : raw;
    capacityW = Math.max(0, capacityW * (model.massflow_correction ?? 1));
  } else {
    warnings.push('Sem polinômio de capacidade.');
  }

  // Power: VAPCYC stores compressor power directly in W (per Units token "...,W]")
  let powerW = 0;
  if (pow?.coefficients_json?.length === 10) {
    const raw = evalAhri540(pow.coefficients_json, sF, dF);
    powerW = /\bW\b/.test(pow.unit_system) ? raw : raw * BTU_HR_TO_W;
    powerW = Math.max(1, powerW * (model.power_correction ?? 1));
  } else {
    warnings.push('Sem polinômio de potência.');
  }

  // Current (A) — already SI
  let currentA = 0;
  if (cur?.coefficients_json?.length === 10) {
    currentA = Math.max(0, evalAhri540(cur.coefficients_json, sF, dF));
  }

  // Mass flow (lbm/hr → kg/h)
  let massFlowKgh = 0;
  if (mf?.coefficients_json?.length === 10) {
    const raw = evalAhri540(mf.coefficients_json, sF, dF);
    massFlowKgh = unitsHaveLbm(mf.unit_system) ? raw * LBM_HR_TO_KG_HR : raw;
    massFlowKgh = Math.max(0, massFlowKgh * (model.massflow_correction ?? 1));
  }

  // Envelope check
  const envWarnings: string[] = [];
  let inEnvelope = true;
  if (
    model.temp_evap_min_c != null &&
    evaporatingTempC < model.temp_evap_min_c - 0.5
  ) {
    inEnvelope = false;
    envWarnings.push(
      `Te=${evaporatingTempC.toFixed(1)}°C < min ${model.temp_evap_min_c.toFixed(1)}°C`,
    );
  }
  if (
    model.temp_evap_max_c != null &&
    evaporatingTempC > model.temp_evap_max_c + 0.5
  ) {
    inEnvelope = false;
    envWarnings.push(
      `Te=${evaporatingTempC.toFixed(1)}°C > max ${model.temp_evap_max_c.toFixed(1)}°C`,
    );
  }
  if (
    model.temp_cond_min_c != null &&
    condensingTempC < model.temp_cond_min_c - 0.5
  ) {
    inEnvelope = false;
    envWarnings.push(
      `Tc=${condensingTempC.toFixed(1)}°C < min ${model.temp_cond_min_c.toFixed(1)}°C`,
    );
  }
  if (
    model.temp_cond_max_c != null &&
    condensingTempC > model.temp_cond_max_c + 0.5
  ) {
    inEnvelope = false;
    envWarnings.push(
      `Tc=${condensingTempC.toFixed(1)}°C > max ${model.temp_cond_max_c.toFixed(1)}°C`,
    );
  }

  const copCooling = powerW > 0 ? capacityW / powerW : 0;
  const copHeating = powerW > 0 ? (capacityW + powerW) / powerW : 0;

  return {
    compressorId: model.id,
    model: model.model,
    manufacturer: model.manufacturer,
    refrigerant: model.refrigerant,
    evaporatingTempC,
    condensingTempC,
    capacityW,
    powerW,
    currentA,
    massFlowKgh,
    copCooling,
    copHeating,
    inEnvelope,
    envelopeWarnings: envWarnings,
    unitSystem: cap?.unit_system ?? model.units_system ?? 'unknown',
    warnings,
  };
}

/** Async loader + simulator — used by server functions. */
export async function simulateCompressor(
  supabase: SupabaseClient,
  input: SimulateCompressorInput,
): Promise<SimulateCompressorResult> {
  let modelQuery = supabase.from('compressor_models').select('*').limit(1);
  if (input.compressorId) {
    modelQuery = modelQuery.eq('id', input.compressorId);
  } else if (input.sourceTableKey) {
    modelQuery = modelQuery.eq('source_table_key', input.sourceTableKey);
  } else {
    throw new Error('compressorId ou sourceTableKey é obrigatório');
  }
  const { data: models, error: mErr } = await modelQuery;
  if (mErr) throw new Error(`compressor_models: ${mErr.message}`);
  if (!models?.length) throw new Error('Compressor não encontrado');
  const model = models[0] as VapcycCompressorRecord;

  const { data: polys, error: pErr } = await supabase
    .from('compressor_polynomials')
    .select('curve_type, unit_system, coefficients_json')
    .eq('compressor_id', model.id);
  if (pErr) throw new Error(`compressor_polynomials: ${pErr.message}`);

  const normalized: VapcycPolynomialRecord[] = (polys ?? []).map((p) => ({
    curve_type: p.curve_type as VapcycCurveType,
    unit_system: p.unit_system ?? '',
    coefficients_json: Array.isArray(p.coefficients_json)
      ? (p.coefficients_json as number[])
      : [],
  }));

  return evaluateCompressor(
    model,
    normalized,
    input.evaporatingTempC,
    input.condensingTempC,
  );
}
