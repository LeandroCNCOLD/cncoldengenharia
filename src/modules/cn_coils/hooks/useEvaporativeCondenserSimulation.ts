import { useMemo } from "react";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface EvaporativeCondenserInputs {
  /** Calor total rejeitado pelo condensador [W] */
  Q_total_W: number;
  /** Temperatura de bulbo úmido do ar de entrada [°C] */
  Twb_C: number;
  /** Temperatura de bulbo seco do ar de entrada [°C] */
  Tdb_C: number;
  /** Altitude do local de instalação [m] */
  altitude_m: number;
  /** Número de filas de tubos */
  tubeRows: number;
  /** Número de tubos por fila */
  tubesPerRow: number;
  /** Comprimento dos tubos [m] */
  tubeLength_m: number;
  /** Diâmetro externo dos tubos [mm] */
  tubeDiameter_mm: number;
  /** Vazão de água de aspersão [L/min] */
  waterFlowRate_Lmin: number;
  /** Velocidade do ar na face do feixe [m/s] */
  airVelocity_ms: number;
}

export interface EvaporativeCondenserResult {
  /** Temperatura de condensação estimada [°C] */
  Tc_C: number;
  /** Calor efetivamente rejeitado [W] */
  Q_rejected_W: number;
  /** Produto UA do trocador [W/K] */
  UA_WK: number;
  /** Eficiência de rejeição (0–1) */
  eta_rejection: number;
  /** Evaporação de água [L/h] */
  waterEvaporation_Lh: number;
  /** Purga (blowdown) [L/h] */
  waterBlowdown_Lh: number;
  /** Drift (arraste) [L/h] */
  waterDrift_Lh: number;
  /** Reposição total de água [L/h] */
  waterMakeup_Lh: number;
  /** Potência dos ventiladores [W] */
  W_fans_W: number;
  /** Área externa total dos tubos [m²] */
  A_ext_m2: number;
  /** Pressão atmosférica local [Pa] */
  P_atm_Pa: number;
  /** Temperatura de saída do ar [°C] */
  Tair_out_C: number;
  /** Umidade específica do ar de entrada [g/kg] */
  W_in_gkg: number;
  /** Umidade específica do ar de saída [g/kg] */
  W_out_gkg: number;
  /** Vazão mássica de ar [kg/s] */
  mDot_air_kgs: number;
  /** Número de unidades de transferência */
  NTU: number;
  /** Approach temperature: Tc - Twb [K] */
  approach_K: number;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_EVAPORATIVE_CONDENSER_INPUTS: EvaporativeCondenserInputs = {
  Q_total_W: 25_000,
  Twb_C: 24,
  Tdb_C: 35,
  altitude_m: 0,
  tubeRows: 4,
  tubesPerRow: 20,
  tubeLength_m: 2.4,
  tubeDiameter_mm: 19.05,
  waterFlowRate_Lmin: 15,
  airVelocity_ms: 3,
};

// ─── Funções auxiliares psicrométricas ─────────────────────────────────────────

/** Pressão de saturação do vapor d'água [Pa] — equação de Magnus */
function pSat_Pa(T_C: number): number {
  return 611.2 * Math.exp((17.67 * T_C) / (T_C + 243.5));
}

/** Umidade específica [kg/kg] a partir de T_C e UR (0–1) */
function humidityRatio(T_C: number, RH: number, P_atm: number): number {
  const pv = Math.min(RH * pSat_Pa(T_C), P_atm * 0.99);
  return 0.622 * pv / Math.max(1, P_atm - pv);
}

/** Entalpia do ar úmido [kJ/kg_ar_seco] */
function enthalpyMoistAir(T_C: number, W_kgkg: number): number {
  return 1.006 * T_C + W_kgkg * (2501 + 1.86 * T_C);
}

// ─── Motor principal ────────────────────────────────────────────────────────────

/**
 * Calcula o desempenho de um condensador evaporativo.
 *
 * Modelo: NTU-efetividade para condensadores evaporativos
 * conforme Dreyer & Erens (1996) e ASHRAE Handbook — HVAC Systems and Equipment.
 *
 * Approach temperature: Tc = Twb + Q / UA_evap
 *
 * Consumo de água — balanço de massa real:
 *   Evaporação: Q_latente / h_fg  (h_fg ≈ 2430 kJ/kg a 30°C)
 *   Purga: evaporação / (CoC - 1), CoC = 3 ciclos de concentração típico
 *   Drift: 0,02% da vazão de circulação (eliminadores de gotículas modernos)
 */
export function calculateEvaporativeCondenser(
  inputs: EvaporativeCondenserInputs,
): EvaporativeCondenserResult {
  const {
    Q_total_W,
    Twb_C,
    Tdb_C,
    altitude_m,
    tubeRows,
    tubesPerRow,
    tubeLength_m,
    tubeDiameter_mm,
    waterFlowRate_Lmin,
    airVelocity_ms,
  } = inputs;

  // 1. Pressão atmosférica local
  const P_atm_Pa = 101325 * Math.pow(1 - 2.2557e-5 * altitude_m, 5.2559);

  // 2. Área externa total dos tubos
  const D_m = tubeDiameter_mm / 1000;
  const A_ext_m2 = Math.PI * D_m * tubeLength_m * tubeRows * tubesPerRow;

  // 3. Vazão mássica de ar
  //    Passo transversal estimado: 1,3×D ou mínimo 25mm
  const pitchT_m = Math.max(D_m * 1.3, 0.025);
  const A_face_m2 = tubeLength_m * tubesPerRow * pitchT_m;
  const rho_ar = P_atm_Pa / (287.05 * (Tdb_C + 273.15));
  const mDot_air_kgs = Math.max(0.01, rho_ar * airVelocity_ms * A_face_m2);

  // 4. Propriedades do ar de entrada
  const RH_in = Math.min(0.99, pSat_Pa(Twb_C) / Math.max(1, pSat_Pa(Tdb_C)));
  const W_in = humidityRatio(Tdb_C, RH_in, P_atm_Pa);
  const h_in = enthalpyMoistAir(Tdb_C, W_in); // kJ/kg

  // 5. UA do lado evaporativo
  //    h_evap ≈ 3500 W/m²K para aspersão forçada (literatura: 2000–5000 W/m²K)
  const h_evap = 3500;
  const UA_WK = Math.max(1, h_evap * A_ext_m2);

  // 6. Temperatura de condensação (approach de Merkel)
  //    Tc = Twb + Q / UA
  const Tc_C = Twb_C + Q_total_W / UA_WK;
  const approach_K = Tc_C - Twb_C;

  // 7. NTU-efetividade (condensação isotérmica → C_max → ∞)
  //    ε = 1 - exp(-NTU)
  const cp_ar = 1006 + 1860 * W_in; // J/(kg·K) ar úmido
  const NTU = UA_WK / (mDot_air_kgs * cp_ar);
  const epsilon = Math.min(0.98, 1 - Math.exp(-NTU));
  const Q_rejected_W = Q_total_W * epsilon;
  const eta_rejection = epsilon;

  // 8. Estado do ar de saída
  const Q_ar_kJs = Q_rejected_W / 1000; // kJ/s
  const h_out = h_in + Q_ar_kJs / mDot_air_kgs; // kJ/kg
  const Tair_out_C = (h_out - 2501 * W_in) / (1.006 + 1.86 * W_in);
  const W_out = humidityRatio(Math.min(Tair_out_C, Tc_C - 1), 0.98, P_atm_Pa);

  // 9. Consumo de água — balanço de massa real
  //    h_fg a 30°C ≈ 2430 kJ/kg (ASHRAE Fundamentals)
  const h_fg_kJkg = 2430;
  //    Fração latente: ~75% do calor rejeitado é por evaporação
  const Q_latente_W = Q_rejected_W * 0.75;
  const waterEvaporation_kgs = Q_latente_W / (h_fg_kJkg * 1000);
  const waterEvaporation_Lh = waterEvaporation_kgs * 3600; // L/h (ρ≈1 kg/L)

  //    Purga: CoC = 3 ciclos de concentração → m_purga = m_evap / (CoC - 1)
  const CoC = 3;
  const waterBlowdown_Lh = waterEvaporation_Lh / (CoC - 1);

  //    Drift: 0,02% da vazão de circulação (eliminadores modernos)
  const waterCirculation_Lh = waterFlowRate_Lmin * 60;
  const waterDrift_Lh = waterCirculation_Lh * 0.0002;

  //    Reposição total
  const waterMakeup_Lh = waterEvaporation_Lh + waterBlowdown_Lh + waterDrift_Lh;

  // 10. Potência dos ventiladores
  //     ΔP_ar ≈ 50 Pa por fila (estimativa conservadora, v = 2–4 m/s)
  const deltaP_Pa = 50 * tubeRows;
  const eta_fan = 0.55;
  const W_fans_W = (deltaP_Pa * mDot_air_kgs / rho_ar) / eta_fan;

  return {
    Tc_C,
    Q_rejected_W,
    UA_WK,
    eta_rejection,
    waterEvaporation_Lh,
    waterBlowdown_Lh,
    waterDrift_Lh,
    waterMakeup_Lh,
    W_fans_W,
    A_ext_m2,
    P_atm_Pa,
    Tair_out_C,
    W_in_gkg: W_in * 1000,
    W_out_gkg: W_out * 1000,
    mDot_air_kgs,
    NTU,
    approach_K,
  };
}

export function useEvaporativeCondenserSimulation(inputs: EvaporativeCondenserInputs) {
  return useMemo(() => calculateEvaporativeCondenser(inputs), [inputs]);
}
