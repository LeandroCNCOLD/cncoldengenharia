// Propriedades do ar úmido derivadas da psicrometria ASHRAE.
// Substitui as constantes grosseiras (rho=1.2, cp=1.005) da Etapa 5.

import {
  airDensity,
  enthalpy,
  humidityRatio,
  moistAirCp,
  dewPoint,
  PSY_CONSTANTS,
} from "./psychrometrics";

export interface MoistAirState {
  T_C: number;
  RH: number;          // 0..1
  W_kg_kg: number;     // umidade absoluta
  h_kJ_kg: number;     // entalpia específica
  rho_kg_m3: number;   // densidade da mistura
  cp_J_kgK: number;    // calor específico do ar úmido
  Tdp_C: number;       // ponto de orvalho
  pAtm_Pa: number;
}

export function buildMoistAirState(
  T_C: number,
  RH_pct: number,
  pAtm_Pa: number = PSY_CONSTANTS.P_ATM_DEFAULT,
): MoistAirState {
  const RH = Math.min(Math.max(RH_pct / 100, 0), 1);
  const W = humidityRatio(T_C, RH, pAtm_Pa);
  return {
    T_C,
    RH,
    W_kg_kg: W,
    h_kJ_kg: enthalpy(T_C, W),
    rho_kg_m3: airDensity(T_C, W, pAtm_Pa),
    cp_J_kgK: moistAirCp(W),
    Tdp_C: dewPoint(T_C, RH, pAtm_Pa),
    pAtm_Pa,
  };
}
