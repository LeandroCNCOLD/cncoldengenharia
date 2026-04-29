/**
 * Gerador de mapa de desempenho multiponto para evaporadores e condensadores.
 *
 * A partir de:
 *  - um CoilSimulatorInput base (tipicamente o ponto nominal do componente),
 *  - uma calibração ativa (opcional — se ausente, o mapa é marcado como estimado),
 *  - faixas operacionais (temperatura de mudança de fase, temperatura do ar, fator de vazão),
 *
 * varre uma malha 3D, simula cada ponto e retorna métricas + status (valid/warning/invalid)
 * + confiança decaída por distância ao ponto nominal calibrado.
 *
 * Não toca em banco. Funções de persistência ficam em src/lib/coldpro/coil-performance-maps.ts.
 */

import type {
  CoilSimulatorInput,
  CoilSimulatorResult,
} from "./coilSimulatorTypes";
import {
  NEUTRAL_CALIBRATION,
  type CalibrationFactors,
} from "./coilEngineTypes";
import { simulatePhysicalSimple } from "./physicalSimpleEngine";
import { simulateDxEvaporator } from "./dxEvaporatorSimulator";
import { simulateDxCondenser } from "./dxCondenserSimulator";
import type { UnilabGeometryFactor } from "../unilabData/types";

export type PerformanceEngine = "physical_simple" | "empirical";
export type PointStatus = "valid" | "warning" | "invalid";

export interface RangeSpec {
  min: number;
  max: number;
  step: number;
}

export interface PerformanceRanges {
  /** Tevap (evaporador) ou Tcond (condensador) em °C */
  refTempC: RangeSpec;
  /** Temperatura do ar de entrada em °C */
  airInletTempC: RangeSpec;
  /** Multiplicador da vazão de ar nominal (0.7..1.3 default) */
  airflowFactor: RangeSpec;
}

export const DEFAULT_RANGES_EVAP: PerformanceRanges = {
  refTempC: { min: -45, max: 0, step: 5 },
  airInletTempC: { min: -30, max: 20, step: 5 },
  airflowFactor: { min: 0.7, max: 1.3, step: 0.1 },
};

export const DEFAULT_RANGES_COND: PerformanceRanges = {
  refTempC: { min: 30, max: 70, step: 5 },
  airInletTempC: { min: 20, max: 45, step: 5 },
  airflowFactor: { min: 0.7, max: 1.3, step: 0.1 },
};

export interface PerformancePoint {
  // entrada
  refTempC: number;
  airInletTempC: number;
  airflowFactor: number;
  airflowM3h: number;
  // saída
  capacityW: number;
  capacityKcalh: number;
  airOutletTempC: number | null;
  airPressureDropPa: number | null;
  refrigerantPressureDropKpa: number | null;
  uWm2k: number | null;
  faceVelocityMs: number | null;
  dtRealK: number;
  // qualidade
  status: PointStatus;
  confidenceScore: number;
  distanceFromNominal: number;
  warnings: string[];
}

export interface PerformanceMapSummary {
  totalPoints: number;
  validCount: number;
  warningCount: number;
  invalidCount: number;
  avgConfidence: number;
  capacityMinW: number;
  capacityMaxW: number;
}

export interface NominalValidation {
  /** Capacidade do datasheet Unilab (W). */
  capacityDatasheetW: number | null;
  /** Capacidade simulada no ponto nominal (W) — após calibração. */
  capacitySimulatedW: number;
  /** Erro relativo (decimal: 0.05 = 5%). null se datasheet ausente. */
  relativeError: number | null;
  /** true se |erro| ≤ 5% (ou se datasheet ausente). */
  reproducesNominal: boolean;
  message: string;
}

export interface PerformanceMapResult {
  coilType: "evaporator" | "condenser";
  engine: PerformanceEngine;
  ranges: PerformanceRanges;
  isEstimated: boolean;
  baselineCalibrationConfidence: number;
  points: PerformancePoint[];
  summary: PerformanceMapSummary;
  nominalValidation: NominalValidation;
}

export interface GeneratePerformanceMapParams {
  input: CoilSimulatorInput;
  coilType: "evaporator" | "condenser";
  engine?: PerformanceEngine;
  /** Calibração ativa (ou null se sem calibração — gera mapa estimado). */
  calibration?: CalibrationFactors | null;
  /** Confiança da calibração (0..1). Default 0.6 quando estimado. */
  calibrationConfidence?: number;
  ranges?: Partial<PerformanceRanges>;
  /** Fatores reais Unilab da geometria do componente (opcional, mas recomendado). */
  unilabGeometryFactor?: UnilabGeometryFactor | null;
  /** Identificadores opcionais (debug log). */
  componentItemId?: string;
  calibrationId?: string | null;
}

// --- helpers ---------------------------------------------------------------

function buildAxis(spec: RangeSpec): number[] {
  const out: number[] = [];
  if (!Number.isFinite(spec.min) || !Number.isFinite(spec.max) || spec.step <= 0) {
    return [spec.min];
  }
  const lo = Math.min(spec.min, spec.max);
  const hi = Math.max(spec.min, spec.max);
  const eps = spec.step * 1e-6;
  for (let v = lo; v <= hi + eps; v += spec.step) {
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

function pickRanges(
  coilType: "evaporator" | "condenser",
  partial?: Partial<PerformanceRanges>,
): PerformanceRanges {
  const def = coilType === "evaporator" ? DEFAULT_RANGES_EVAP : DEFAULT_RANGES_COND;
  return {
    refTempC: { ...def.refTempC, ...(partial?.refTempC ?? {}) },
    airInletTempC: { ...def.airInletTempC, ...(partial?.airInletTempC ?? {}) },
    airflowFactor: { ...def.airflowFactor, ...(partial?.airflowFactor ?? {}) },
  };
}

function distanceFromNominal(
  point: { refTempC: number; airInletTempC: number; airflowFactor: number; dtRealK: number },
  nominal: { refTempC: number; airInletTempC: number; airflowFactor: number; dtNominalK: number },
): number {
  // Normaliza cada eixo pela escala típica e soma euclidianamente.
  const dT = (point.refTempC - nominal.refTempC) / 10; // 10 K = 1 unidade
  const dA = (point.airInletTempC - nominal.airInletTempC) / 10;
  const dF = (point.airflowFactor - nominal.airflowFactor) / 0.3; // 30% = 1
  const dDT = nominal.dtNominalK > 0
    ? (point.dtRealK - nominal.dtNominalK) / Math.max(nominal.dtNominalK, 1)
    : 0;
  return Math.sqrt(dT * dT + dA * dA + dF * dF + dDT * dDT);
}

/** Confiança do ponto = confiança da calibração × decaimento por distância. */
function pointConfidence(calConf: number, distance: number): number {
  // 1.0 no nominal, ~0.5 a distance=2, mínimo 0.3
  const decay = 1 / (1 + 0.4 * distance * distance);
  return Math.max(0.3, calConf * decay);
}

function classifyPoint(opts: {
  capacityW: number;
  dtRealK: number;
  airPressureDropPa: number | null;
  refrigerantPressureDropKpa: number | null;
  airflowFactor: number;
  refTempC: number;
  ranges: PerformanceRanges;
  distance: number;
}): { status: PointStatus; warnings: string[] } {
  const w: string[] = [];
  let status: PointStatus = "valid";

  if (opts.dtRealK <= 0) {
    w.push("ΔT ≤ 0 — operação inviável.");
    status = "invalid";
  }
  if (opts.capacityW <= 0) {
    w.push("Capacidade calculada ≤ 0.");
    status = "invalid";
  }
  if (
    opts.refTempC < opts.ranges.refTempC.min - 1e-3 ||
    opts.refTempC > opts.ranges.refTempC.max + 1e-3
  ) {
    w.push("Temperatura fora da faixa definida.");
    status = "invalid";
  }

  if (status !== "invalid") {
    if (opts.airPressureDropPa != null && opts.airPressureDropPa > 250) {
      w.push(`ΔP ar alta (${opts.airPressureDropPa.toFixed(0)} Pa).`);
      status = "warning";
    }
    if (opts.refrigerantPressureDropKpa != null && opts.refrigerantPressureDropKpa > 60) {
      w.push(`ΔP refrigerante alta (${opts.refrigerantPressureDropKpa.toFixed(1)} kPa).`);
      status = "warning";
    }
    if (opts.airflowFactor < 0.7 || opts.airflowFactor > 1.3) {
      w.push("Fator de vazão fora de 0.7..1.3.");
      status = "warning";
    }
    if (opts.distance > 2.5) {
      w.push("Extrapolação distante do ponto calibrado.");
      status = "warning";
    }
  }

  return { status, warnings: w };
}

function runSim(
  input: CoilSimulatorInput,
  engine: PerformanceEngine,
  cal: CalibrationFactors,
  unilabGeometryFactor?: UnilabGeometryFactor | null,
  nominalFaceVelocityMs?: number,
): CoilSimulatorResult {
  if (engine === "physical_simple") {
    return simulatePhysicalSimple(input, {
      calibration: cal,
      unilabGeometryFactor,
      nominalFaceVelocityMs,
    });
  }
  // empirical: aplica calibração via post (passa direto no options)
  if (input.coilType === "evaporator") {
    return simulateDxEvaporator(input, { calibration: cal });
  }
  return simulateDxCondenser(input, { calibration: cal });
}

// --- main ------------------------------------------------------------------

export function generateCoilPerformanceMap(
  params: GeneratePerformanceMapParams,
): PerformanceMapResult {
  const engine: PerformanceEngine = params.engine ?? "physical_simple";
  const ranges = pickRanges(params.coilType, params.ranges);
  const cal = params.calibration ?? NEUTRAL_CALIBRATION;
  const isEstimated = !params.calibration;
  const calConf = isEstimated ? 0.6 : (params.calibrationConfidence ?? 0.85);

  // baseline para calcular distance
  const baseInput = params.input;
  // Vazão nominal: SEMPRE do datasheet (nominal.airflowM3h). Nunca usar fallback fixo.
  const nominalAirflow = baseInput.nominal?.airflowM3h ?? baseInput.air.airflowM3h ?? null;
  const baseAirflow =
    nominalAirflow != null && Number.isFinite(nominalAirflow) && nominalAirflow > 0
      ? nominalAirflow
      : null;
  const nominal = {
    refTempC: baseInput.nominal?.refTempC ?? baseInput.refrigerant.refTempC ?? 0,
    airInletTempC: baseInput.nominal?.airTempInC ?? baseInput.air.airTempInC ?? 0,
    airflowFactor: 1,
    dtNominalK: Math.abs(
      (baseInput.nominal?.airTempInC ?? baseInput.air.airTempInC ?? 0) -
        (baseInput.nominal?.refTempC ?? baseInput.refrigerant.refTempC ?? 0),
    ),
  };

  // Velocidade frontal nominal (para slope dos fatores Unilab)
  const unilabFactor = params.unilabGeometryFactor ?? null;
  const nominalFaceVelocityMs = (() => {
    const g = baseInput.geometry;
    if (!g.coilLengthMm || !g.tubesPerRow || !g.tubeSpacingMm || baseAirflow == null) return undefined;
    const heightM = (g.tubesPerRow * g.tubeSpacingMm) / 1000;
    const lengthM = g.coilLengthMm / 1000;
    const faceArea = heightM * lengthM;
    if (faceArea <= 0) return undefined;
    return baseAirflow / 3600 / faceArea;
  })();
  const datasheetCapW = (() => {
    const n = baseInput.nominal as { capacityW?: number | null } | undefined;
    const v = n?.capacityW;
    return v != null && Number.isFinite(v) && v > 0 ? v : null;
  })();

  let nominalSimCapW = 0;
  let nominalRawCapW = 0;
  try {
    const nominalInput: CoilSimulatorInput = {
      ...baseInput,
      air: {
        ...baseInput.air,
        airTempInC: nominal.airInletTempC,
        airflowM3h: baseAirflow ?? baseInput.air.airflowM3h ?? 0,
      },
      refrigerant: { ...baseInput.refrigerant, refTempC: nominal.refTempC },
    };
    nominalRawCapW = runSim(nominalInput, engine, NEUTRAL_CALIBRATION, unilabFactor, nominalFaceVelocityMs).capacityW;
    nominalSimCapW = runSim(nominalInput, engine, cal, unilabFactor, nominalFaceVelocityMs).capacityW;
  } catch {
    /* validation reports 0 */
  }

  const relErr =
    datasheetCapW != null && datasheetCapW > 0
      ? (nominalSimCapW - datasheetCapW) / datasheetCapW
      : null;
  const reproducesNominal = relErr == null ? true : Math.abs(relErr) <= 0.05;

  const nominalValidation: NominalValidation = {
    capacityDatasheetW: datasheetCapW,
    capacitySimulatedW: nominalSimCapW,
    relativeError: relErr,
    reproducesNominal,
    message:
      datasheetCapW == null
        ? "Capacidade nominal do datasheet ausente — não foi possível validar."
        : reproducesNominal
          ? `Ponto nominal reproduzido (erro ${(Math.abs(relErr ?? 0) * 100).toFixed(2)}%).`
          : `Mapa não reproduz o ponto nominal Unilab. Verifique aplicação da calibração. Erro: ${((relErr ?? 0) * 100).toFixed(2)}% (sim ${nominalSimCapW.toFixed(0)} W vs datasheet ${datasheetCapW.toFixed(0)} W).`,
  };

  // eslint-disable-next-line no-console
  console.debug("[performanceMap] nominal validation", {
    componentItemId: params.componentItemId ?? null,
    calibrationId: params.calibrationId ?? null,
    engine,
    capacityCorrectionFactor: cal.capacityCorrectionFactor,
    airDpCorrectionFactor: cal.airDpCorrectionFactor,
    refDpCorrectionFactor: cal.refDpCorrectionFactor,
    uaCorrectionFactor: cal.uaCorrectionFactor,
    nominalCapacityWDatasheet: datasheetCapW,
    nominalPointCapacityW_beforeCalibration: nominalRawCapW,
    nominalPointCapacityW_afterCalibration: nominalSimCapW,
    relativeError: relErr,
    reproducesNominal,
  });

  const refAxis = buildAxis(ranges.refTempC);
  const airAxis = buildAxis(ranges.airInletTempC);
  const flowAxis = buildAxis(ranges.airflowFactor);

  const points: PerformancePoint[] = [];

  for (const refT of refAxis) {
    for (const airT of airAxis) {
      for (const ff of flowAxis) {
        const airflowM3h = baseAirflow != null ? baseAirflow * ff : 0;

        // Validação: vazão nominal ausente ou airflow_m3h < 1000 → ponto invalid
        if (baseAirflow == null || airflowM3h < 1000) {
          const reason =
            baseAirflow == null
              ? "Vazão nominal ausente no datasheet (nominal_airflow_m3h)."
              : `Vazão calculada muito baixa (${airflowM3h.toFixed(0)} m³/h < 1000).`;
          points.push({
            refTempC: refT,
            airInletTempC: airT,
            airflowFactor: ff,
            airflowM3h,
            capacityW: 0,
            capacityKcalh: 0,
            airOutletTempC: null,
            airPressureDropPa: null,
            refrigerantPressureDropKpa: null,
            uWm2k: null,
            faceVelocityMs: null,
            dtRealK: 0,
            status: "invalid",
            confidenceScore: 0.3,
            distanceFromNominal: 999,
            warnings: [reason],
          });
          continue;
        }

        const stepInput: CoilSimulatorInput = {
          ...baseInput,
          air: { ...baseInput.air, airTempInC: airT, airflowM3h },
          refrigerant: { ...baseInput.refrigerant, refTempC: refT },
        };

        let result: CoilSimulatorResult;
        let simWarnings: string[] = [];
        try {
          result = runSim(stepInput, engine, cal);
          simWarnings = result.warnings ?? [];
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha na simulação";
          points.push({
            refTempC: refT,
            airInletTempC: airT,
            airflowFactor: ff,
            airflowM3h,
            capacityW: 0,
            capacityKcalh: 0,
            airOutletTempC: null,
            airPressureDropPa: null,
            refrigerantPressureDropKpa: null,
            uWm2k: null,
            faceVelocityMs: null,
            dtRealK: 0,
            status: "invalid",
            confidenceScore: 0.3,
            distanceFromNominal: 999,
            warnings: [msg],
          });
          continue;
        }

        const dtReal = Math.abs(airT - refT);
        const dist = distanceFromNominal(
          { refTempC: refT, airInletTempC: airT, airflowFactor: ff, dtRealK: dtReal },
          nominal,
        );
        const conf = pointConfidence(calConf, dist);

        const uWm2k =
          (result as unknown as { breakdown?: { uWm2k?: number } }).breakdown?.uWm2k ?? null;

        // saída do ar: derivada quando engine física, senão null
        const airOut =
          (result as unknown as { airOutletTempC?: number | null }).airOutletTempC ?? null;

        const cls = classifyPoint({
          capacityW: result.capacityW,
          dtRealK: dtReal,
          airPressureDropPa: result.airPressureDropPa,
          refrigerantPressureDropKpa: result.refPressureDropKpa,
          airflowFactor: ff,
          refTempC: refT,
          ranges,
          distance: dist,
        });

        points.push({
          refTempC: refT,
          airInletTempC: airT,
          airflowFactor: ff,
          airflowM3h,
          capacityW: Math.max(0, result.capacityW),
          capacityKcalh: Math.max(0, result.capacityKcalh),
          airOutletTempC: airOut,
          airPressureDropPa: result.airPressureDropPa,
          refrigerantPressureDropKpa: result.refPressureDropKpa,
          uWm2k,
          faceVelocityMs: result.faceVelocityMs,
          dtRealK: dtReal,
          status: cls.status,
          confidenceScore: Number(conf.toFixed(3)),
          distanceFromNominal: Number(dist.toFixed(3)),
          warnings: [...cls.warnings, ...simWarnings].slice(0, 6),
        });
      }
    }
  }

  const valid = points.filter((p) => p.status === "valid");
  const warn = points.filter((p) => p.status === "warning");
  const invalid = points.filter((p) => p.status === "invalid");
  const caps = points.filter((p) => p.status !== "invalid").map((p) => p.capacityW);
  const avgConf =
    points.length > 0
      ? points.reduce((s, p) => s + p.confidenceScore, 0) / points.length
      : 0;

  const summary: PerformanceMapSummary = {
    totalPoints: points.length,
    validCount: valid.length,
    warningCount: warn.length,
    invalidCount: invalid.length,
    avgConfidence: Number(avgConf.toFixed(3)),
    capacityMinW: caps.length ? Math.min(...caps) : 0,
    capacityMaxW: caps.length ? Math.max(...caps) : 0,
  };

  return {
    coilType: params.coilType,
    engine,
    nominalValidation,
    ranges,
    isEstimated,
    baselineCalibrationConfidence: calConf,
    points,
    summary,
  };
}

/** Regra de aprovação: ≤30% de pontos invalid E reproduz ponto nominal (±5%). */
export function canApproveMap(
  summary: PerformanceMapSummary,
  nominalValidation?: NominalValidation,
): boolean {
  if (summary.totalPoints === 0) return false;
  if (summary.invalidCount / summary.totalPoints > 0.3) return false;
  if (nominalValidation && !nominalValidation.reproducesNominal) return false;
  return true;
}

/** Exporta o mapa para CSV. */
export function performanceMapToCsv(map: PerformanceMapResult): string {
  const header = [
    "ref_temp_c",
    "air_inlet_temp_c",
    "airflow_factor",
    "airflow_m3h",
    "capacity_w",
    "capacity_kcalh",
    "air_dp_pa",
    "ref_dp_kpa",
    "u_wm2k",
    "dt_real_k",
    "status",
    "confidence",
    "distance",
    "warnings",
  ];
  const rows = map.points.map((p) =>
    [
      p.refTempC,
      p.airInletTempC,
      p.airflowFactor,
      p.airflowM3h.toFixed(1),
      p.capacityW.toFixed(1),
      p.capacityKcalh.toFixed(1),
      p.airPressureDropPa != null ? p.airPressureDropPa.toFixed(1) : "",
      p.refrigerantPressureDropKpa != null ? p.refrigerantPressureDropKpa.toFixed(2) : "",
      p.uWm2k != null ? p.uWm2k.toFixed(2) : "",
      p.dtRealK.toFixed(2),
      p.status,
      p.confidenceScore.toFixed(3),
      p.distanceFromNominal.toFixed(3),
      `"${p.warnings.join(" | ").replace(/"/g, "'")}"`,
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}
