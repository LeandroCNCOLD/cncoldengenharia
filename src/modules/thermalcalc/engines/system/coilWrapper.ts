// ColdPro — wrapper único de coil para o System Simulator.
// A matemática segue em simulateHybridCoil; este arquivo só escolhe o modo.
import { simulateHybridCoil } from "../coil/internals/hybridCoilEngine";
import type { CoilCalculationInput } from "../coil/internals/types";
import type {
  Coil,
  CoilGeometry,
  CoilMode,
  CoilSimulatorResult,
} from "@/modules/thermalcalc/types/coilSimulatorTypes";
import type { GeometryInput } from "../coil/internals/types";
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

export type CoilSectionRunInput = CoilRunInput;

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
  const geometry = resolved?.geometry ?? defaultGeometryFromCode(input.geometryCode, thermalMode);
  return {
    id: input.id ?? input.geometryCode,
    type: "coil",
    mode: input.mode,
    geometry,
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

function toHybridGeometry(
  geometry: CoilGeometry | GeometryInput,
  mode: CoilCalculationInput["mode"],
): GeometryInput {
  const source = geometry as Partial<GeometryInput> & CoilGeometry;
  return {
    code: source.code ?? source.description ?? "COIL",
    mode,
    finType: source.finType ?? "unknown",
    tubeType: source.tubeType ?? "unknown",
    tubeOuterDiameterMm: source.tubeOuterDiameterMm ?? source.tubeOdMm ?? 9.52,
    tubeInnerDiameterMm: source.tubeInnerDiameterMm ?? source.tubeIdMm ?? 8.92,
    tubePitchMm: source.tubePitchMm ?? source.tubeSpacingMm ?? 25,
    rowPitchMm: source.rowPitchMm ?? source.rowSpacingMm ?? 22,
    finPitchMm: source.finPitchMm ?? 3,
    finThicknessMm: source.finThicknessMm ?? 0.13,
    coilLengthMm: source.coilLengthMm ?? 1000,
    coilHeightMm:
      source.coilHeightMm ??
      (source.tubesPerRow ?? 12) * (source.tubePitchMm ?? source.tubeSpacingMm ?? 25),
    coilDepthMm: source.coilDepthMm,
    rows: source.rows ?? 3,
    tubesPerRow: source.tubesPerRow ?? 12,
    circuits: source.circuits ?? 4,
    skippedTubes: source.skippedTubes,
    tubeMaterialConductivityWmK: source.tubeMaterialConductivityWmK,
    finMaterialConductivityWmK: source.finMaterialConductivityWmK,
    unilabExchangeAreaM2: source.unilabExchangeAreaM2,
    unilabInternalVolumeL: source.unilabInternalVolumeL,
  };
}

export function simulateCoil(coil: Coil): SectionResult {
  return coil.mode === "evaporator" ? simulateEvaporatorCoil(coil) : simulateCondenserCoil(coil);
}

function simulateEvaporatorCoil(coil: Coil): SectionResult {
  return simulateHybridCoilAsSection(coil, {
    thermalMode: "direct_expansion",
    wet: (coil.air.rhInPct ?? defaultHumidityFor("evaporator")) >= 70,
    outletSign: -1,
  });
}

function simulateCondenserCoil(coil: Coil): SectionResult {
  return simulateHybridCoilAsSection(coil, {
    thermalMode: "condensation",
    wet: false,
    outletSign: 1,
  });
}

function simulateHybridCoilAsSection(
  coil: Coil,
  opts: {
    thermalMode: CoilCalculationInput["mode"];
    wet: boolean;
    outletSign: -1 | 1;
  },
): SectionResult {
  const rh = coil.air.rhInPct ?? defaultHumidityFor(coil.mode);
  const calcInput: CoilCalculationInput = {
    mode: opts.thermalMode,
    geometry: toHybridGeometry(coil.geometry, opts.thermalMode),
    factors: coil.technical?.factors,
    unilabSource: coil.technical?.unilabSource,
    airInletTempC: coil.air.airTempInC ?? 0,
    refTempC: coil.refrigerantSide.refTempC ?? 0,
    airflowM3h: coil.air.airflowM3h ?? 0,
    relativeHumidityPct: rh,
    wet: opts.wet,
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
  const airOutletTempC = airInletTempC + opts.outletSign * dT;

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

export const runCoilSection = simulateCoilRun;

export function runCoilCollection(coils: Coil[]): SectionResult[] {
  return coils.map((coil) => simulateCoil(coil));
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

export function calibrateCoil(
  coil: Coil,
  datasheet: Coil["datasheetReference"] = coil.datasheetReference,
): {
  baseline: CoilSimulatorResult;
  calibrated: CoilSimulatorResult;
  factor: number;
  warnings: string[];
} {
  const coilWithDatasheet: Coil = { ...coil, datasheetReference: datasheet };
  const missing = missingDatasheetFields(coilWithDatasheet);
  if (missing.length > 0) {
    throw new Error(`Calibração bloqueada: faltam ${missing.join(", ")}.`);
  }

  const baselineSection = simulateCoil(coilWithDatasheet);
  const datasheetCapacity = coilWithDatasheet.datasheetReference!.capacityW ?? 0;
  const factor = baselineSection.capacityW > 0 ? datasheetCapacity / baselineSection.capacityW : 1;
  const calibratedCoil: Coil = {
    ...coilWithDatasheet,
    calibration: {
      ...(coil.calibration ?? {}),
      heatTransferFactor: factor,
      capacityCorrectionFactor: factor,
    },
  };
  const calibratedSection = simulateCoil(calibratedCoil);

  return {
    baseline: simulatorResultFromSection(coilWithDatasheet, baselineSection),
    calibrated: simulatorResultFromSection(coil, calibratedSection),
    factor,
    warnings: calibratedSection.warnings,
  };
}
