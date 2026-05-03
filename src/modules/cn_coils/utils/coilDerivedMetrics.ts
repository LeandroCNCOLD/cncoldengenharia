import { getRefrigerantLiquidProps } from "../engine_v2/refrigerantProps";

export interface FanFitValidation {
  fitsHeight: boolean;
  fitsWidthSingle: boolean;
  fitsWidthTotal: boolean;
  warnings: string[];
  fanWarnings: Array<{ level: "error" | "ok"; msg: string }>;
}

export interface CoilWeightInputs {
  tubeOD_m: number;
  tubeID_m: number;
  nTubesPerRow: number;
  nRows: number;
  L_fin_m: number;
  tubePitchTransverse_m: number;
  tubePitchLongitudinal_m: number;
  finThickness_m?: number;
  finPitch_m?: number;
  tubeMaterial?: "copper" | "aluminum" | "steel";
  finMaterial?: "aluminum" | "copper";
}

export interface CoilWeightResult {
  m_tubes_kg: number;
  m_fins_kg: number;
  m_total_dry_kg: number;
  n_fins: number;
  n_tubes: number;
}

const DENSITY = {
  copper: 8960,
  aluminum: 2700,
  steel: 7850,
} as const;

export function calcCoilHeight(
  nTubesPerRow: number,
  tubePitchTransverse_mm: number,
): number {
  return nTubesPerRow * tubePitchTransverse_mm;
}

export function calcCoilDepth(
  nRows: number,
  tubePitchLongitudinal_mm: number,
): number {
  return nRows * tubePitchLongitudinal_mm;
}

export function calcCoilDimensions(params: {
  nTubesPerRow?: number;
  finnedHeightMm?: number;
  tubePitchTransverseMm?: number;
  nRows?: number;
  tubePitchLongitudinalMm?: number;
  lengthMm?: number;
}) {
  const tubesPerRow =
    params.nTubesPerRow && params.nTubesPerRow > 0
      ? params.nTubesPerRow
      : params.finnedHeightMm && params.tubePitchTransverseMm
        ? Math.max(1, Math.round(params.finnedHeightMm / params.tubePitchTransverseMm))
        : 0;
  return {
    heightMm: tubesPerRow * (params.tubePitchTransverseMm ?? 0),
    widthMm: params.lengthMm ?? 0,
    depthMm: (params.nRows ?? 0) * (params.tubePitchLongitudinalMm ?? 0),
    tubesPerRow,
  };
}

export function calcTubeLengthPerCircuitM(params: {
  nTubesPerRow: number;
  nRows: number;
  nCircuits: number;
  L_fin_m: number;
}): number {
  if (
    params.nTubesPerRow <= 0 ||
    params.nRows <= 0 ||
    params.nCircuits <= 0 ||
    params.L_fin_m <= 0
  ) {
    return 0;
  }
  const tubesPerCircuitPerRow = params.nTubesPerRow / params.nCircuits;
  return params.L_fin_m * params.nRows * tubesPerCircuitPerRow;
}

export function calcInternalTubeVolumeM3(params: {
  tubeID_m: number;
  nTubesPerRow: number;
  nRows: number;
  nCircuits: number;
  L_fin_m: number;
}): number {
  const area = Math.PI * Math.pow(params.tubeID_m / 2, 2);
  const L_per_circuit_m = calcTubeLengthPerCircuitM(params);
  return area * L_per_circuit_m * params.nCircuits;
}

export function calcCoilWeight(inputs: CoilWeightInputs): CoilWeightResult {
  const {
    tubeOD_m,
    tubeID_m,
    nTubesPerRow,
    nRows,
    L_fin_m,
    tubePitchTransverse_m,
    tubePitchLongitudinal_m,
    finThickness_m = 0.00013,
    finPitch_m = 0.0025,
    tubeMaterial = "copper",
    finMaterial = "aluminum",
  } = inputs;

  const n_tubes = nTubesPerRow * nRows;
  const A_wall = (Math.PI / 4) * (tubeOD_m ** 2 - tubeID_m ** 2);
  const m_tubes_kg = A_wall * L_fin_m * n_tubes * DENSITY[tubeMaterial];

  const n_fins = Math.floor(L_fin_m / finPitch_m);
  const W_fin = nTubesPerRow * tubePitchTransverse_m;
  const H_fin = nRows * tubePitchLongitudinal_m;
  const A_fin_gross = W_fin * H_fin;
  const A_holes = n_tubes * (Math.PI / 4) * tubeOD_m ** 2;
  const A_fin_net = A_fin_gross - A_holes;
  const m_fins_kg = A_fin_net * finThickness_m * n_fins * DENSITY[finMaterial];

  return {
    m_tubes_kg: Math.round(m_tubes_kg * 100) / 100,
    m_fins_kg: Math.round(m_fins_kg * 100) / 100,
    m_total_dry_kg: Math.round((m_tubes_kg + m_fins_kg) * 100) / 100,
    n_fins,
    n_tubes,
  };
}

export function calcRefrigerantCharge(params: {
  refrigerant: string;
  T_evap_C: number;
  tubeID_m: number;
  nTubesPerRow: number;
  nRows: number;
  nCircuits: number;
  L_fin_m: number;
}): { kg: number; L: number; volume_L: number; L_per_circuit_m: number; warnings: string[] } {
  const props = getRefrigerantLiquidProps(params.refrigerant, params.T_evap_C);
  const volumeM3 = calcInternalTubeVolumeM3(params);
  const volumeL = volumeM3 * 1000;
  return {
    kg: volumeM3 * props.rho_kg_m3,
    L: volumeL,
    volume_L: volumeL,
    L_per_circuit_m: calcTubeLengthPerCircuitM(params),
    warnings: props.warnings,
  };
}

export function computeFluidVelocity(params: {
  refrigerant: string;
  T_evap_C: number;
  Q_total_W: number;
  nCircuits: number;
  tubeID_m: number;
  massFlow_kg_s?: number;
}): number {
  const props = getRefrigerantLiquidProps(params.refrigerant, params.T_evap_C);
  const massFlowKgS =
    params.massFlow_kg_s && params.massFlow_kg_s > 0
      ? params.massFlow_kg_s
      : params.Q_total_W / (props.h_fg_kJkg * 1000);
  // Display uses an evaporating two-phase mean density; using saturated liquid
  // density here severely under-reports velocity in direct-expansion coils.
  const effectiveRho = props.rho_kg_m3 * 0.06;
  const tubeAreaM2 = Math.PI * Math.pow(params.tubeID_m / 2, 2);
  return (massFlowKgS / params.nCircuits) / (effectiveRho * tubeAreaM2);
}

export function calcCoilDerivedDimensions(params: {
  nTubesPerRow: number;
  tubePitchTransverse_mm: number;
  nRows: number;
  tubePitchLongitudinal_mm: number;
  lengthMm: number;
  tubeID_m: number;
  tubeOD_m?: number;
  nCircuits: number;
  refrigerant: string;
  T_evap_C: number;
  finThickness_m?: number;
  finPitch_m?: number;
}) {
  const altura_mm = calcCoilHeight(params.nTubesPerRow, params.tubePitchTransverse_mm);
  const prof_mm = calcCoilDepth(params.nRows, params.tubePitchLongitudinal_mm);
  const largura_mm = params.lengthMm;
  const charge = calcRefrigerantCharge({
    refrigerant: params.refrigerant,
    T_evap_C: params.T_evap_C,
    tubeID_m: params.tubeID_m,
    nTubesPerRow: params.nTubesPerRow,
    nRows: params.nRows,
    nCircuits: params.nCircuits,
    L_fin_m: params.lengthMm / 1000,
  });
  const weight = calcCoilWeight({
    tubeOD_m: params.tubeOD_m ?? 0,
    tubeID_m: params.tubeID_m,
    nTubesPerRow: params.nTubesPerRow,
    nRows: params.nRows,
    L_fin_m: params.lengthMm / 1000,
    tubePitchTransverse_m: params.tubePitchTransverse_mm / 1000,
    tubePitchLongitudinal_m: params.tubePitchLongitudinal_mm / 1000,
    finThickness_m: params.finThickness_m,
    finPitch_m: params.finPitch_m,
  });

  return {
    altura_mm,
    largura_mm,
    prof_mm,
    L_per_circuit_m: charge.L_per_circuit_m,
    volumeInterno_L: charge.volume_L,
    cargaRefrigerante_kg: charge.kg,
    pesoTubos_kg: weight.m_tubes_kg,
    pesoAletas_kg: weight.m_fins_kg,
    pesoSeco_kg: weight.m_total_dry_kg,
    pesoComFluido_kg: Math.round((weight.m_total_dry_kg + charge.kg) * 100) / 100,
    n_fins: weight.n_fins,
    n_tubes: weight.n_tubes,
    gabinete_largura_mm: largura_mm + 160,
    gabinete_altura_mm: altura_mm + 200,
    gabinete_prof_mm: prof_mm + 50,
    warnings: charge.warnings,
  };
}

export function validateFanFit(params: {
  fanD: number;
  altura_mm: number;
  largura_mm: number;
  nFans: number;
}): FanFitValidation {
  const { fanD, altura_mm, largura_mm } = params;
  const nFans = Math.max(1, Math.floor(params.nFans) || 1);
  const fitsHeight = fanD <= altura_mm;
  const fitsWidthSingle = fanD <= largura_mm;
  const totalFanWidth = fanD * nFans;
  const fitsWidthTotal = totalFanWidth <= largura_mm;
  const fanWarnings: Array<{ level: "error" | "ok"; msg: string }> = [];

  if (!fitsHeight) {
    fanWarnings.push({
      level: "error",
      msg: `Ventilador Ø${fanD}mm NÃO CABE na altura do aletado (${altura_mm}mm). Reduza o ventilador ou aumente o nº de tubos por fileira.`,
    });
  }

  if (!fitsWidthSingle) {
    fanWarnings.push({
      level: "error",
      msg: `Ventilador Ø${fanD}mm NÃO CABE na largura do aletado (${largura_mm}mm). Reduza o ventilador ou aumente o comprimento aletado.`,
    });
  } else if (!fitsWidthTotal) {
    fanWarnings.push({
      level: "error",
      msg: `${nFans}× Ø${fanD}mm = ${totalFanWidth}mm NÃO CABE na largura do aletado (${largura_mm}mm). Reduza o nº de ventiladores ou aumente o comprimento.`,
    });
  }

  if (fitsHeight && fitsWidthTotal && fanD > 0) {
    fanWarnings.push({
      level: "ok",
      msg: `${nFans > 1 ? `${nFans}× ` : ""}Ø${fanD}mm cabem no aletado (altura: ${altura_mm}mm | largura: ${largura_mm}mm)`,
    });
  }

  return {
    fitsHeight,
    fitsWidthSingle,
    fitsWidthTotal,
    warnings: fanWarnings.map((w) => w.msg),
    fanWarnings,
  };
}
