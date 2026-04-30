// ColdPro — wrapper único de coil para o System Simulator.
// A matemática segue em simulateHybridCoil; este arquivo só escolhe o modo.
import { simulateHybridCoil } from "../coil/internals/hybridCoilEngine";
import type { CoilCalculationInput } from "../coil/internals/types";
import type {
  Coil,
  CoilMode,
  CoilSimulatorResult,
} from "@/modules/thermalcalc/types/coilSimulatorTypes";
import type { Refrigerant, SectionResult, SystemResolvedCoilData } from "./systemTypes";
import { defaultGeometryFromCode } from "./systemGeometryDefaults";

export interface CoilRunInput {
  id?: string;
  mode: CoilMode;
  geometryCode: string;
  resolvedCoil?: SystemResolvedCoilData;
  refrigerant: Refrigerant;
  airInletTempC: number;
  refTempC: number;
  airflowM3h: number;
  refrigerantMassFlowKgh: number;
  relativeHumidityPct?: number;
}

function thermalModeFor(mode: CoilMode): CoilCalculationInput["mode"] {
  return mode === "condenser" ? "condensation" : "direct_expansion";
}

function defaultHumidityFor(mode: CoilMode, explicit?: number): number {
  return explicit ?? (mode === "evaporator" ? 85 : 50);
}

export function buildCoil(input: CoilRunInput): Coil {
  const thermalMode = thermalModeFor(input.mode);
  const resolved = input.resolvedCoil;
  const rh = defaultHumidityFor(input.mode, input.relativeHumidityPct);
  return {
    id: input.id,
    type: "coil",
    mode: input.mode,
    geometry: resolved?.geometry ?? defaultGeometryFromCode(input.geometryCode, thermalMode),
    air: {
      airflowM3h: input.airflowM3h,
      airTempInC: input.airInletTempC,
      rhInPct: rh,
    },
    refrigerantSide: {
      refrigerant: input.refrigerant,
      refTempC: input.refTempC,
      massFlowKgs: input.refrigerantMassFlowKgh / 3600,
    },
    datasheetReference: undefined,
    calibration: undefined,
    technical: {
      factors: resolved?.factors,
      unilabSource: resolved?.unilabSource,
      warnings: resolved?.warnings,
    },
  };
}

export function simulateCoil(coil: Coil): SectionResult {
  const thermalMode = thermalModeFor(coil.mode);
  const rh = coil.air.rhInPct ?? defaultHumidityFor(coil.mode);
  const calcInput: CoilCalculationInput = {
    mode: thermalMode,
    geometry: coil.geometry,
    factors: coil.technical?.factors,
    unilabSource: coil.technical?.unilabSource,
    airInletTempC: coil.air.airTempInC ?? 0,
    refTempC: coil.refrigerantSide.refTempC ?? 0,
    airflowM3h: coil.air.airflowM3h ?? 0,
    relativeHumidityPct: rh,
    wet: coil.mode === "evaporator" ? rh >= 70 : false,
    refrigerant: coil.refrigerantSide.refrigerant,
    refrigerantMassFlowKgH: (coil.refrigerantSide.massFlowKgs ?? 0) * 3600,
    calibration: coil.calibration,
  };
  const r = simulateHybridCoil(calcInput);

  const cpAir = 1005;
  const rhoAir = 1.2;
  const airflowM3h = coil.air.airflowM3h ?? 0;
  const airInletTempC = coil.air.airTempInC ?? 0;
  const massFlowAirKgs = (airflowM3h / 3600) * rhoAir;
  const dT = massFlowAirKgs > 0 ? r.capacityW / (massFlowAirKgs * cpAir) : 0;
  const airOutletTempC = coil.mode === "evaporator" ? airInletTempC - dT : airInletTempC + dT;

  return {
    capacityW: r.capacityW,
    uWm2K: r.uWm2K,
    hAirWm2K: r.hAirWm2K,
    hRefWm2K: r.hRefWm2K,
    airOutletTempC,
    effectiveAreaM2: r.effectiveAreaM2,
    warnings: [...(coil.technical?.warnings ?? []), ...r.warnings],
  };
}

export function simulateCoilRun(input: CoilRunInput): SectionResult {
  return simulateCoil(buildCoil(input));
}

function missingDatasheetFields(coil: Coil): string[] {
  const missing: string[] = [];
  const capacity = coil.datasheetReference?.capacityW;
  if (!coil.air.airflowM3h) missing.push("airflow");
  if (coil.mode === "evaporator" && coil.refrigerantSide.refTempC == null) missing.push("Tevap");
  if (coil.mode === "condenser" && coil.refrigerantSide.refTempC == null) missing.push("Tcond");
  if (capacity == null || capacity <= 0) missing.push("capacidade");
  if (!coil.refrigerantSide.refrigerant) missing.push("refrigerante");
  return missing;
}

function simulatorResultFromSection(coil: Coil, section: SectionResult): CoilSimulatorResult {
  return {
    coilType: coil.mode,
    capacityW: section.capacityW,
    capacityKcalh: section.capacityW * 0.859845,
    sensibleW: coil.mode === "evaporator" ? section.capacityW : null,
    latentW: null,
    dtRealK: 0,
    dtNominalK: 0,
    faceAreaM2: null,
    faceVelocityMs: null,
    airflowFactor: 1,
    dtFactor: 1,
    airPressureDropPa: null,
    refPressureDropKpa: null,
    condensateLh: null,
    warnings: section.warnings,
  };
}

export function calibrateCoil(coil: Coil): {
  baseline: CoilSimulatorResult;
  calibrated: CoilSimulatorResult;
  factor: number;
  warnings: string[];
} {
  const missing = missingDatasheetFields(coil);
  if (missing.length > 0) {
    throw new Error(`Calibração bloqueada: faltam ${missing.join(", ")}.`);
  }

  const baselineSection = simulateCoil(coil);
  const datasheetCapacity = coil.datasheetReference!.capacityW;
  const factor = baselineSection.capacityW > 0 ? datasheetCapacity / baselineSection.capacityW : 1;
  const calibratedCoil: Coil = {
    ...coil,
    calibration: {
      ...(coil.calibration ?? {}),
      heatTransferFactor: factor,
      capacityCorrectionFactor: factor,
    },
  };
  const calibratedSection = simulateCoil(calibratedCoil);

  return {
    baseline: simulatorResultFromSection(coil, baselineSection),
    calibrated: simulatorResultFromSection(coil, calibratedSection),
    factor,
    warnings: calibratedSection.warnings,
  };
}
