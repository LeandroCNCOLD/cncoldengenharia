import type { AirGeometryResult } from "./airGeometry";

export interface AirPressureDropInput {
  air_velocity_ms: number;
  air_density: number;
  geometry: AirGeometryResult;
  rows: number;
  tube_pitch_longitudinal_m?: number;
}

export interface AirPressureDropResult {
  pressure_drop_pa: number;
  warnings: string[];
}

export function calculateAirPressureDrop(input: AirPressureDropInput): AirPressureDropResult {
  const warnings: string[] = [];
  const V = input.air_velocity_ms;
  const rho = input.air_density;
  const Dh = input.geometry.hydraulic_diameter_m;

  const Re = Dh > 0 && V > 0 ? (rho * V * Dh) / 0.0000182 : 0;

  let f: number;
  if (Re < 1000) {
    f = Re > 0 ? 0.5 / Math.pow(Re, 0.3) : 0;
  } else {
    f = 0.2 / Math.pow(Re, 0.2);
  }

  let L_total: number;
  if (input.tube_pitch_longitudinal_m !== undefined) {
    L_total = input.rows * input.tube_pitch_longitudinal_m;
  } else {
    L_total = input.rows * 0.022;
    warnings.push(
      "tube_pitch_longitudinal_m não fornecido. Usando 22mm como default para cálculo de ΔP.",
    );
  }

  const pressure_drop_pa = Dh > 0 ? f * (L_total / Dh) * ((rho * V * V) / 2) : 0;

  return { pressure_drop_pa, warnings };
}
