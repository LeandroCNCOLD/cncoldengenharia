import { useMemo } from "react";

export interface HeatingCoilInputs {
  mode: "heating" | "reheat";
  Tair_in_C: number;
  RH_in: number;
  airFlowRate_m3h: number;
  altitude_m: number;
  heatingFluid: "hot_water" | "steam";
  Tf_in_C: number;
  Tf_out_C: number;
  fluidFlowRate_m3h: number;
  tubeRows: number;
  tubesPerRow: number;
  tubeLength_m: number;
  finPitch_mm: number;
  tubeDiameter_mm: number;
}

export interface HeatingCoilResult {
  Tair_out_C: number;
  RH_out: number;
  Q_heating_W: number;
  NTU: number;
  epsilon: number;
  U_Wm2K: number;
  A_ext_m2: number;
  pressureDrop_Pa: number;
  deltaT_reheat_K?: number;
  RH_final?: number;
  W_in_gkg: number;
}

export const DEFAULT_HEATING_COIL_INPUTS: HeatingCoilInputs = {
  mode: "heating",
  Tair_in_C: 15,
  RH_in: 0.6,
  airFlowRate_m3h: 3000,
  altitude_m: 0,
  heatingFluid: "hot_water",
  Tf_in_C: 80,
  Tf_out_C: 60,
  fluidFlowRate_m3h: 1.5,
  tubeRows: 2,
  tubesPerRow: 16,
  tubeLength_m: 1.2,
  finPitch_mm: 3,
  tubeDiameter_mm: 15.88,
};

export function saturationPressurePa(tempC: number): number {
  return 611.2 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

export function calculateMoistAirState(tempC: number, relativeHumidity: number, altitudeM = 0) {
  const P_atm = 101325 * Math.pow(1 - 2.2557e-5 * altitudeM, 5.2559);
  const Psat = saturationPressurePa(tempC);
  const RH = Math.min(1, Math.max(0.01, relativeHumidity));
  const W_kgkg = (0.622 * RH * Psat) / Math.max(1, P_atm - RH * Psat);
  const rho_air = P_atm / (287 * (tempC + 273.15) * (1 + W_kgkg));
  return { P_atm, Psat, W_kgkg, rho_air };
}

export function calculateHeatingCoil(
  inputs: HeatingCoilInputs,
): HeatingCoilResult {
  const airIn = calculateMoistAirState(inputs.Tair_in_C, inputs.RH_in, inputs.altitude_m);
  const P_atm = airIn.P_atm;
  const W_in = airIn.W_kgkg;
  const rho_air = airIn.rho_air;
  const mDot_air = Math.max(0.001, (inputs.airFlowRate_m3h * rho_air) / 3600);
  const cp_air = 1006 + 1860 * W_in;

  const A_ext =
    Math.PI *
    (inputs.tubeDiameter_mm / 1000) *
    inputs.tubeLength_m *
    inputs.tubeRows *
    inputs.tubesPerRow;
  const h_air = 45;
  const h_fluid = inputs.heatingFluid === "steam" ? 8000 : 4000;
  const U = 1 / (1 / h_air + 1 / h_fluid);
  const NTU = (U * A_ext) / (mDot_air * cp_air);
  const fluidOut = inputs.heatingFluid === "steam" ? inputs.Tf_in_C : inputs.Tf_out_C;
  const Tf_mean = (inputs.Tf_in_C + fluidOut) / 2;
  const epsilon = Math.min(0.98, Math.max(0, 1 - Math.exp(-NTU)));
  const Tair_out_C = inputs.Tair_in_C + epsilon * (Tf_mean - inputs.Tair_in_C);
  const Q_heating_W = mDot_air * cp_air * (Tair_out_C - inputs.Tair_in_C);
  const Psat_out = saturationPressurePa(Tair_out_C);
  const RH_out = Math.min(1, Math.max(0, (W_in * P_atm) / (Psat_out * (0.622 + W_in))));
  const faceVelocity = inputs.airFlowRate_m3h / 3600 / Math.max(0.01, inputs.tubeLength_m * inputs.tubeRows * 0.25);
  const pressureDrop_Pa =
    12 * inputs.tubeRows * Math.pow(faceVelocity, 1.7) * (3 / Math.max(1, inputs.finPitch_mm));

  return {
    Tair_out_C,
    RH_out,
    Q_heating_W,
    NTU,
    epsilon,
    U_Wm2K: U,
    A_ext_m2: A_ext,
    pressureDrop_Pa,
    deltaT_reheat_K: inputs.mode === "reheat" ? Tair_out_C - inputs.Tair_in_C : undefined,
    RH_final: inputs.mode === "reheat" ? RH_out : undefined,
    W_in_gkg: W_in * 1000,
  };
}

export function useHeatingCoilSimulation(inputs: HeatingCoilInputs) {
  return useMemo(() => calculateHeatingCoil(inputs), [inputs]);
}
