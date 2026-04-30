// ColdPro — System simulator wrapper that uses VAPCYC compressors.
//
// The legacy synchronous simulateSystem() in ./systemSimulator uses a hardcoded
// compressor library. This async wrapper:
//   1) Pre-fetches the VAPCYC compressor model + polynomials once,
//   2) Runs the same fixed-point loop using evaluateCompressor() for each
//      iteration,
//   3) Adds an explicit energy-balance validation Qcond ≈ Qevap + Wcomp.

import type { SupabaseClient } from "@supabase/supabase-js";
import { simulateCoilRun } from "./coilWrapper";
import { runExpansionDevice } from "./expansionDeviceEngine";
import {
  evaluateCompressor,
  type VapcycCompressorRecord,
  type VapcycPolynomialRecord,
} from "./vapcycCompressorEngine";
import type { SectionResult, SystemResult, Bottleneck } from "./systemTypes";

export interface VapcycSystemInput {
  evaporatorGeometryCode: string;
  condenserGeometryCode: string;
  refrigerant: string;
  evaporatingTempC: number;
  condensingTempC: number;
  airInletEvapC: number;
  airInletCondC: number;
  airflowEvapM3h: number;
  airflowCondM3h: number;
  /** Reference to compressor_models row. Either id OR source_table_key. */
  compressorId?: string;
  compressorSourceTableKey?: string;
  superheatK: number;
  subcoolingK: number;
  tolerance?: number;
  maxIterations?: number;
}

export interface VapcycSystemResult extends SystemResult {
  energyBalance: {
    qEvapW: number;
    qCondW: number;
    wCompW: number;
    residualW: number;
    relativeError: number;
    valid: boolean;
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function pickBottleneck(qEvap: number, qComp: number, qCond: number, tol: number): Bottleneck {
  const xs = [
    { name: "evaporator" as const, q: qEvap },
    { name: "compressor" as const, q: qComp },
    { name: "condenser" as const, q: qCond },
  ].sort((a, b) => a.q - b.q);
  const min = xs[0];
  const max = xs[xs.length - 1];
  if (max.q > 0 && (max.q - min.q) / max.q < tol * 2) return "balanced";
  return min.name;
}

export async function simulateSystemVapcyc(
  supabase: SupabaseClient,
  input: VapcycSystemInput,
): Promise<VapcycSystemResult> {
  // ---- 1) Pre-fetch compressor model + polynomials ----
  let q = supabase.from("compressor_models").select("*").limit(1);
  if (input.compressorId) q = q.eq("id", input.compressorId);
  else if (input.compressorSourceTableKey)
    q = q.eq("source_table_key", input.compressorSourceTableKey);
  else throw new Error("compressorId ou compressorSourceTableKey é obrigatório");
  const { data: models, error: mErr } = await q;
  if (mErr) throw new Error(`compressor_models: ${mErr.message}`);
  if (!models?.length) throw new Error("Compressor não encontrado");
  const model = models[0] as VapcycCompressorRecord;

  const { data: polysRaw, error: pErr } = await supabase
    .from("compressor_polynomials")
    .select("curve_type, unit_system, coefficients_json")
    .eq("compressor_id", model.id);
  if (pErr) throw new Error(`compressor_polynomials: ${pErr.message}`);
  const polys: VapcycPolynomialRecord[] = (polysRaw ?? []).map((p) => ({
    curve_type: p.curve_type as VapcycPolynomialRecord["curve_type"],
    unit_system: p.unit_system ?? "",
    coefficients_json: Array.isArray(p.coefficients_json) ? (p.coefficients_json as number[]) : [],
  }));

  // ---- 2) Solver loop ----
  const tol = input.tolerance ?? 0.03;
  const maxIter = input.maxIterations ?? 25;
  const warnings: string[] = [];
  let te = input.evaporatingTempC;
  let tc = input.condensingTempC;

  const teMin = input.airInletEvapC - 30;
  const teMax = input.airInletEvapC - 1;
  const tcMin = input.airInletCondC + 1;
  const tcMax = input.airInletCondC + 35;

  let comp = evaluateCompressor(model, polys, te, tc);
  let evap: SectionResult = {
    capacityW: 0,
    uWm2K: 0,
    hAirWm2K: 0,
    hRefWm2K: 0,
    effectiveAreaM2: 0,
    warnings: [],
  };
  let cond: SectionResult = { ...evap };

  let iter = 0;
  let converged = false;
  let lastError = Infinity;

  for (iter = 1; iter <= maxIter; iter++) {
    comp = evaluateCompressor(model, polys, te, tc);

    runExpansionDevice({
      refrigerant: input.refrigerant,
      evaporatingTempC: te,
      condensingTempC: tc,
      targetSuperheatK: input.superheatK,
      compressorMassFlowKgh: comp.massFlowKgh,
    });

    evap = simulateCoilRun({
      mode: "evaporator",
      geometryCode: input.evaporatorGeometryCode,
      refrigerant: input.refrigerant,
      airInletTempC: input.airInletEvapC,
      refTempC: te,
      airflowM3h: input.airflowEvapM3h,
      refrigerantMassFlowKgh: comp.massFlowKgh,
      relativeHumidityPct: 85,
    });

    cond = simulateCoilRun({
      mode: "condenser",
      geometryCode: input.condenserGeometryCode,
      refrigerant: input.refrigerant,
      airInletTempC: input.airInletCondC,
      refTempC: tc,
      airflowM3h: input.airflowCondM3h,
      refrigerantMassFlowKgh: comp.massFlowKgh,
    });

    const qEvap = evap.capacityW;
    const qComp = comp.capacityW;
    const qCondTarget = qComp + comp.powerW;
    const qCond = cond.capacityW;

    const errEvap = qComp > 0 ? Math.abs(qEvap - qComp) / qComp : 1;
    const errCond = qCondTarget > 0 ? Math.abs(qCond - qCondTarget) / qCondTarget : 1;
    lastError = Math.max(errEvap, errCond);
    if (lastError < tol) {
      converged = true;
      break;
    }

    const damping = 0.4;
    const cpAir = 1005;
    const rhoAir = 1.2;
    const mAirEvap = (input.airflowEvapM3h / 3600) * rhoAir;
    const mAirCond = (input.airflowCondM3h / 3600) * rhoAir;
    if (mAirEvap > 0)
      te = clamp(te + ((qComp - qEvap) / (mAirEvap * cpAir)) * damping, teMin, teMax);
    if (mAirCond > 0)
      tc = clamp(tc + ((qCondTarget - qCond) / (mAirCond * cpAir)) * damping, tcMin, tcMax);
  }

  if (!converged)
    warnings.push(
      `Solver não convergiu em ${maxIter} iter (erro ${(lastError * 100).toFixed(1)}%).`,
    );

  // ---- 3) Energy-balance validation ----
  const qEvapW = evap.capacityW;
  const qCondW = cond.capacityW;
  const wCompW = comp.powerW;
  const residualW = qCondW - (qEvapW + wCompW);
  const relErr = qEvapW > 0 ? Math.abs(residualW) / qEvapW : 1;
  const balanceValid = relErr <= 0.1;
  if (!balanceValid)
    warnings.push(
      `Balanço energético: |Qcond - (Qevap + W)| / Qevap = ${(relErr * 100).toFixed(1)}% (>10%).`,
    );

  const capacityRealW = Math.min(evap.capacityW, comp.capacityW);
  const cop = comp.powerW > 0 ? capacityRealW / comp.powerW : 0;

  const compNominal = evaluateCompressor(model, polys, -10, 45);
  const utilizationComp =
    compNominal.capacityW > 0 ? clamp(comp.capacityW / compNominal.capacityW, 0, 2) : 0;
  const utilizationEvap = evap.capacityW > 0 ? clamp(capacityRealW / evap.capacityW, 0, 1) : 0;
  const utilizationCond =
    cond.capacityW > 0 ? clamp((comp.capacityW + comp.powerW) / cond.capacityW, 0, 2) : 0;

  if (!comp.inEnvelope)
    warnings.push(...comp.envelopeWarnings.map((w) => `Compressor envelope: ${w}`));
  warnings.push(...comp.warnings, ...evap.warnings, ...cond.warnings);

  return {
    capacityRealW,
    compressorCapacityW: comp.capacityW,
    condenserCapacityW: cond.capacityW,
    evaporatorCapacityW: evap.capacityW,
    compressorPowerW: comp.powerW,
    cop,
    energyBalanceError: qEvapW > 0 ? residualW / qEvapW : 0,
    evaporatingTempC: te,
    condensingTempC: tc,
    utilizationEvap,
    utilizationCond,
    utilizationComp,
    bottleneck: pickBottleneck(evap.capacityW, comp.capacityW, cond.capacityW, tol),
    iterations: iter,
    converged,
    evaporator: evap,
    condenser: cond,
    compressor: {
      model: comp.model,
      refrigerant: comp.refrigerant,
      qCompW: comp.capacityW,
      powerW: comp.powerW,
      massFlowKgh: comp.massFlowKgh,
      inEnvelope: comp.inEnvelope,
      warnings: comp.warnings,
    },
    warnings,
    debug: {
      tolerance: tol,
      maxIterations: maxIter,
      finalError: lastError,
      compressorNominalW: compNominal.capacityW,
      currentA: comp.currentA,
      copHeating: comp.copHeating,
      unitSystem: String(comp.unitSystem ?? ""),
      sourceDb: String(model.source_db ?? ""),
      sourceTableKey: String(model.source_table_key ?? ""),
    },
    energyBalance: {
      qEvapW,
      qCondW,
      wCompW,
      residualW,
      relativeError: relErr,
      valid: balanceValid,
    },
  };
}
