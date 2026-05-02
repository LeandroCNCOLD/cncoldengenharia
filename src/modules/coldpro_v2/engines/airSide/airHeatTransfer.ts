import type { AirProperties } from "./airProperties";
import type { AirGeometryResult } from "./airGeometry";

export interface AirSideHTCInput {
  air_velocity_ms: number;
  air_properties: AirProperties;
  geometry: AirGeometryResult;
}

export interface AirSideHTCResult {
  h_air_w_m2k: number;
  reynolds_air: number;
  j_factor: number;
  warnings: string[];
}

export function calculateAirSideHTC(input: AirSideHTCInput): AirSideHTCResult {
  const warnings: string[] = [];
  const V = input.air_velocity_ms;
  const ap = input.air_properties;
  const Dh = input.geometry.hydraulic_diameter_m;

  const Re = ap.viscosity_pa_s > 0 ? (ap.density_kg_m3 * V * Dh) / ap.viscosity_pa_s : 0;
  const Pr = ap.prandtl;

  let j: number;
  if (Re < 1000) {
    j = Re > 0 ? 0.008 * Math.pow(Re, -0.5) : 0;
  } else if (Re < 10000) {
    j = 0.023 * Math.pow(Re, -0.2);
  } else {
    j = 0.015 * Math.pow(Re, -0.15);
  }

  const Pr23 = Pr > 0 ? Math.pow(Pr, 2 / 3) : 1;
  let h = Pr23 > 0 ? (j * ap.density_kg_m3 * V * ap.cp_j_kg_k) / Pr23 : 0;

  h = Math.max(5, Math.min(500, h));

  if (h > 200) {
    warnings.push(
      "h_ar acima de 200 W/m²K. Verificar velocidade e geometria de aletas — valor incomum para ar seco.",
    );
  }

  return {
    h_air_w_m2k: h,
    reynolds_air: Re,
    j_factor: j,
    warnings,
  };
}
