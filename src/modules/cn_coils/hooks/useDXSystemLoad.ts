import { useMemo } from "react";

export type SolarOrientation = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

export interface DXSystemInputs {
  area_m2: number;
  height_m: number;
  Tamb_C: number;
  Troom_C: number;
  RH_target: number;
  occupancy: number;
  lightingDensity_Wm2: number;
  equipmentLoad_W: number;
  windowArea_m2: number;
  solarFactor: number;
  orientation: SolarOrientation;
  freshAirRate_m3h: number;
  altitude_m: number;
}

export interface DXSystemLoadResult {
  Q_wall_W: number;
  Q_solar_W: number;
  Q_people_sensible_W: number;
  Q_lighting_W: number;
  Q_equipment_W: number;
  Q_sensible_total_W: number;
  Q_people_latent_W: number;
  Q_fresh_latent_W: number;
  Q_latent_total_W: number;
  Q_total_W: number;
  SHR: number;
  TR: number;
  breakdown: Array<{ name: string; value: number; percentage: number }>;
}

export const DEFAULT_DX_SYSTEM_INPUTS: DXSystemInputs = {
  area_m2: 100,
  height_m: 3,
  Tamb_C: 35,
  Troom_C: 22,
  RH_target: 0.55,
  occupancy: 10,
  lightingDensity_Wm2: 15,
  equipmentLoad_W: 2000,
  windowArea_m2: 20,
  solarFactor: 0.6,
  orientation: "W",
  freshAirRate_m3h: 200,
  altitude_m: 0,
};

const solarIrradiance: Record<SolarOrientation, number> = {
  N: 150,
  S: 80,
  E: 350,
  W: 350,
  NE: 280,
  NW: 280,
  SE: 200,
  SW: 200,
};

function breakdown(items: Array<{ name: string; value: number }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items.map((item) => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));
}

export function calculateDXSystemLoad(inputs: DXSystemInputs): DXSystemLoadResult {
  const side = Math.sqrt(Math.max(inputs.area_m2, 0));
  const perimeter = 4 * side;
  const A_walls = perimeter * inputs.height_m;
  const U_wall = 0.55;
  const Q_wall_W = U_wall * A_walls * Math.max(0, inputs.Tamb_C - inputs.Troom_C);
  const Q_solar_W =
    solarIrradiance[inputs.orientation] * inputs.windowArea_m2 * inputs.solarFactor;
  const Q_people_sensible_W = inputs.occupancy * 75;
  const Q_lighting_W = inputs.lightingDensity_Wm2 * inputs.area_m2;
  const Q_equipment_W = inputs.equipmentLoad_W;
  const Q_sensible_total_W =
    Q_wall_W + Q_solar_W + Q_people_sensible_W + Q_lighting_W + Q_equipment_W;

  const Q_people_latent_W = inputs.occupancy * 55;
  const rho_air = 1.2;
  const mDot_fresh = (inputs.freshAirRate_m3h * rho_air) / 3600;
  const W_ext = 0.022;
  const W_int = 0.010;
  const Q_fresh_latent_W = Math.max(0, mDot_fresh * 2500e3 * (W_ext - W_int));
  const Q_latent_total_W = Q_people_latent_W + Q_fresh_latent_W;
  const Q_total_W = Q_sensible_total_W + Q_latent_total_W;
  const SHR = Q_total_W > 0 ? Q_sensible_total_W / Q_total_W : 0;

  return {
    Q_wall_W,
    Q_solar_W,
    Q_people_sensible_W,
    Q_lighting_W,
    Q_equipment_W,
    Q_sensible_total_W,
    Q_people_latent_W,
    Q_fresh_latent_W,
    Q_latent_total_W,
    Q_total_W,
    SHR,
    TR: Q_total_W / 3517,
    breakdown: breakdown([
      { name: "Paredes", value: Q_wall_W },
      { name: "Solar", value: Q_solar_W },
      { name: "Pessoas", value: Q_people_sensible_W + Q_people_latent_W },
      { name: "Iluminação", value: Q_lighting_W },
      { name: "Equipamentos", value: Q_equipment_W },
      { name: "Ar externo", value: Q_fresh_latent_W },
    ]),
  };
}

export function useDXSystemLoad(inputs: DXSystemInputs) {
  return useMemo(() => calculateDXSystemLoad(inputs), [inputs]);
}
