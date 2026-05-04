import { useMemo } from "react";

export interface WaterCondenserInputs {
  Q_total_W: number;
  Tw_in_C: number;
  waterFlowRate_m3h: number;
  tubeCount: number;
  tubeLength_m: number;
  tubeDiameter_mm: number;
  passes: number;
  refrigerant: string;
}

export interface WaterCondenserResult {
  Tc_C: number;
  Tw_out_C: number;
  LMTD_K: number;
  U_Wm2K: number;
  A_needed_m2: number;
  A_available_m2: number;
  areaMargin: number;
  pressureDrop_kPa: number;
  pumpPower_W: number;
}

export const DEFAULT_WATER_CONDENSER_INPUTS: WaterCondenserInputs = {
  Q_total_W: 30000,
  Tw_in_C: 30,
  waterFlowRate_m3h: 3,
  tubeCount: 20,
  tubeLength_m: 2,
  tubeDiameter_mm: 19.05,
  passes: 2,
  refrigerant: "R404A",
};

export function calculateWaterCondenser(
  inputs: WaterCondenserInputs,
): WaterCondenserResult {
  const Q_total_W = Math.max(0, inputs.Q_total_W);
  const cpWater = 4186;
  const rhoWater = 1000;
  const mDotWater = Math.max(0.001, (inputs.waterFlowRate_m3h * rhoWater) / 3600);
  const Tw_out_C = inputs.Tw_in_C + Q_total_W / (mDotWater * cpWater);
  const Tc_C = Tw_out_C + 5;
  const DT1 = Math.max(0.1, Tc_C - Tw_out_C);
  const DT2 = Math.max(0.1, Tc_C - inputs.Tw_in_C);
  const LMTD_K = Math.abs(DT2 - DT1) < 1e-9 ? DT1 : (DT2 - DT1) / Math.log(DT2 / DT1);
  const hRefrigerant = 4000;
  const hWater = 6000;
  const U_Wm2K = 1 / (1 / hRefrigerant + 1 / hWater + 0.0001);
  const A_needed_m2 = Q_total_W / Math.max(1, U_Wm2K * LMTD_K);
  const A_available_m2 =
    Math.PI *
    (inputs.tubeDiameter_mm / 1000) *
    inputs.tubeLength_m *
    inputs.tubeCount *
    inputs.passes;
  const areaMargin =
    A_needed_m2 > 0 ? (A_available_m2 - A_needed_m2) / A_needed_m2 : 0;
  const velocityProxy = inputs.waterFlowRate_m3h / Math.max(1, inputs.tubeCount);
  const pressureDrop_kPa = Math.max(0, 18 * inputs.passes * velocityProxy ** 2);
  const pumpPower_W = (pressureDrop_kPa * 1000 * inputs.waterFlowRate_m3h / 3600) / 0.55;

  return {
    Tc_C,
    Tw_out_C,
    LMTD_K,
    U_Wm2K,
    A_needed_m2,
    A_available_m2,
    areaMargin,
    pressureDrop_kPa,
    pumpPower_W,
  };
}

export function useWaterCondenserSimulation(inputs: WaterCondenserInputs) {
  return useMemo(() => calculateWaterCondenser(inputs), [inputs]);
}
