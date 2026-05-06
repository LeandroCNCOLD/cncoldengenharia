import { useMemo } from "react";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface WaterCondenserInputs {
  /** Calor total a rejeitar [W] */
  Q_total_W: number;
  /** Temperatura de entrada da água de resfriamento [°C] */
  Tw_in_C: number;
  /** Vazão volumétrica de água [m³/h] */
  waterFlowRate_m3h: number;
  /** Número de tubos */
  tubeCount: number;
  /** Comprimento dos tubos [m] */
  tubeLength_m: number;
  /** Diâmetro externo dos tubos [mm] */
  tubeDiameter_mm: number;
  /** Número de passes */
  passes: number;
  /** Refrigerante (para propriedades do lado casco) */
  refrigerant: string;
  /** Superaquecimento de entrada no condensador [K] */
  superheat_K: number;
  /** Sub-resfriamento na saída do condensador [K] */
  subcooling_K: number;
}

export interface WaterCondenserResult {
  /** Temperatura de condensação [°C] */
  Tc_C: number;
  /** Temperatura de saída da água [°C] */
  Tw_out_C: number;
  /** LMTD contracorrente [K] */
  LMTD_K: number;
  /** Coeficiente global de transferência de calor [W/m²K] */
  U_Wm2K: number;
  /** Área necessária [m²] */
  A_needed_m2: number;
  /** Área disponível (tubos) [m²] */
  A_available_m2: number;
  /** Margem de área (>0: folga, <0: subdimensionado) */
  areaMargin: number;
  /** Queda de pressão no lado água [kPa] */
  pressureDrop_kPa: number;
  /** Potência da bomba [W] */
  pumpPower_W: number;
  /** Coeficiente convectivo lado água [W/m²K] */
  h_water_Wm2K: number;
  /** Coeficiente convectivo lado refrigerante [W/m²K] */
  h_ref_Wm2K: number;
  /** Velocidade da água nos tubos [m/s] */
  v_water_ms: number;
  /** Número de Reynolds da água */
  Re_water: number;
  /** NTU do trocador */
  NTU: number;
  /** Efetividade do trocador (0–1) */
  epsilon: number;
  /** Approach (Tc - Tw_out) calculado pela geometria [K] */
  approach_K: number;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_WATER_CONDENSER_INPUTS: WaterCondenserInputs = {
  Q_total_W: 30_000,
  Tw_in_C: 30,
  waterFlowRate_m3h: 3,
  tubeCount: 20,
  tubeLength_m: 2,
  tubeDiameter_mm: 19.05,
  passes: 2,
  refrigerant: "R404A",
  superheat_K: 20,
  subcooling_K: 5,
};

// ─── Motor principal ────────────────────────────────────────────────────────────

/**
 * Calcula o desempenho de um condensador casco-e-tubos (água).
 *
 * Modelo NTU-ε (Incropera 7ª ed., Cap. 11; ASHRAE HE&R 2021, Cap. 39):
 *   - Condensação isotérmica → C_refrigerante → ∞ → Cmin = C_água → Cr = 0
 *   - ε = 1 − exp(−NTU)  com  NTU = U × A_disponível / C_água
 *   - Tc calculado iterativamente: Tc = Tw_in + Q / (ε × C_água)
 *     (não mais approach fixo de 5 K — Tc agora depende da geometria real)
 *   - Coeficiente lado água: Dittus-Boelter (Re, Pr)
 *   - Coeficiente lado refrigerante: condensação em filme (Shah 1979 simplificado)
 *   - LMTD contracorrente para verificação de área
 *   - Queda de pressão: Darcy-Weisbach (Blasius / Hagen-Poiseuille)
 */
export function calculateWaterCondenser(
  inputs: WaterCondenserInputs,
): WaterCondenserResult {
  const {
    Q_total_W,
    Tw_in_C,
    waterFlowRate_m3h,
    tubeCount,
    tubeLength_m,
    tubeDiameter_mm,
    passes,
    superheat_K: _sh,
    subcooling_K: _sc,
  } = inputs;

  void _sh; void _sc; // reservados para modelo de 3 zonas futuro

  const Q = Math.max(0, Q_total_W);

  // ── Propriedades da água (a ~35°C — média entre Tw_in e Tw_out estimado) ────
  const cpWater = 4178;      // J/(kg·K)
  const rhoWater = 994;      // kg/m³
  const muWater = 7.2e-4;    // Pa·s
  const kWater = 0.623;      // W/(m·K)

  // ── Geometria dos tubos ──────────────────────────────────────────────────────
  const D_ext = tubeDiameter_mm / 1000;
  const D_int = Math.max(0.005, D_ext - 0.002); // espessura de parede 1 mm
  const A_tube_int = Math.PI * D_int ** 2 / 4;  // área seccional de 1 tubo

  // ── Vazão mássica de água ────────────────────────────────────────────────────
  const mDotWater = Math.max(0.001, (waterFlowRate_m3h * rhoWater) / 3600); // kg/s
  const C_agua = mDotWater * cpWater; // W/K

  // ── Temperatura de saída da água (balanço de energia) ───────────────────────
  const Tw_out_C = Tw_in_C + Q / C_agua;

  // ── Coeficiente convectivo lado água (Dittus-Boelter) ───────────────────────
  const v_water = mDotWater / (rhoWater * A_tube_int * Math.max(1, tubeCount));
  const Re_water = Math.max(1, rhoWater * v_water * D_int / muWater);
  const Pr_water = cpWater * muWater / kWater;
  const Nu_water = Re_water > 2300
    ? 0.023 * Math.pow(Re_water, 0.8) * Math.pow(Pr_water, 0.4) // Dittus-Boelter, aquecimento
    : 3.66; // Nusselt laminar (Nu constante)
  const h_water = Nu_water * kWater / D_int;

  // ── Coeficiente convectivo lado refrigerante (condensação em filme) ──────────
  // Shah (1979) simplificado para condensação em casco:
  // h_ref ≈ 3000–5000 W/m²K; 3500 é valor médio conservador.
  const h_ref = 3500;

  // ── Resistência da parede (cobre: k=380 W/mK) ────────────────────────────────
  const k_wall = 380;
  const R_wall_m2K = (D_ext / 2) * Math.log(D_ext / D_int) / k_wall; // [m²K/W] por área ext
  const R_fouling_water = 0.0001; // m²K/W (TEMA R, água de torre)
  const R_fouling_ref = 0.00005;  // m²K/W (TEMA R, refrigerante)

  // ── Coeficiente global U (baseado na área externa) ───────────────────────────
  // 1/U = 1/h_ref + Rf_ref + R_wall + (A_ext/A_int)×(Rf_água + 1/h_água)
  const ratio_A = D_ext / D_int; // A_ext / A_int por unidade de comprimento
  const U_Wm2K = 1 / (
    1 / h_ref +
    R_fouling_ref +
    R_wall_m2K +
    ratio_A * (R_fouling_water + 1 / h_water)
  );

  // ── Área de troca disponível (baseada na geometria real) ─────────────────────
  const A_available_m2 = Math.PI * D_ext * tubeLength_m * Math.max(1, tubeCount) * Math.max(1, passes);

  // ── NTU-ε (condensação isotérmica: C_ref → ∞, Cr = 0) ───────────────────────
  // Referência: Incropera 7ª ed., Eq. 11.35 (condensador/evaporador)
  const NTU = (U_Wm2K * A_available_m2) / C_agua;
  const epsilon = Math.min(0.99, 1 - Math.exp(-NTU));

  // ── Temperatura de condensação calculada pela geometria ───────────────────────
  // Q = ε × C_água × (Tc − Tw_in)  →  Tc = Tw_in + Q / (ε × C_água)
  // Isso substitui o approach fixo de 5 K: Tc agora responde à geometria real.
  // Trocador grande (NTU alto, ε → 1): Tc ≈ Tw_in + Q/C_água = Tw_out → approach → 0 K
  // Trocador pequeno (NTU baixo, ε → 0): Tc → ∞ → approach grande → subdimensionado
  const Tc_C = epsilon > 0.001
    ? Tw_in_C + Q / (epsilon * C_agua)
    : Tw_out_C + 30; // fallback se ε ≈ 0 (trocador muito pequeno)
  const approach_K = Tc_C - Tw_out_C;

  // ── LMTD contracorrente (zona de condensação dominante) ──────────────────────
  // Tc constante, água de Tw_in (fria) a Tw_out (quente)
  const DT1 = Math.max(0.1, Tc_C - Tw_out_C); // extremidade quente (saída da água)
  const DT2 = Math.max(0.1, Tc_C - Tw_in_C);  // extremidade fria (entrada da água)
  const LMTD_K = Math.abs(DT2 - DT1) < 1e-9
    ? DT1
    : (DT2 - DT1) / Math.log(DT2 / DT1);

  // ── Área necessária (verificação via LMTD) ───────────────────────────────────
  const A_needed_m2 = Q / Math.max(1, U_Wm2K * LMTD_K);
  const areaMargin = A_needed_m2 > 0
    ? (A_available_m2 - A_needed_m2) / A_needed_m2
    : 0;

  // ── Queda de pressão (Darcy-Weisbach) ────────────────────────────────────────
  const f = Re_water > 2300
    ? 0.316 * Math.pow(Re_water, -0.25) // Blasius (turbulento suave)
    : 64 / Re_water;                     // Hagen-Poiseuille (laminar)
  const L_total = tubeLength_m * Math.max(1, passes);
  const pressureDrop_Pa = f * (L_total / D_int) * rhoWater * v_water ** 2 / 2;
  const pressureDrop_kPa = pressureDrop_Pa / 1000;

  // ── Potência da bomba ─────────────────────────────────────────────────────────
  const eta_pump = 0.55;
  const pumpPower_W = (pressureDrop_Pa * waterFlowRate_m3h / 3600) / eta_pump;

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
    h_water_Wm2K: h_water,
    h_ref_Wm2K: h_ref,
    v_water_ms: v_water,
    Re_water,
    NTU,
    epsilon,
    approach_K,
  };
}

export function useWaterCondenserSimulation(inputs: WaterCondenserInputs) {
  return useMemo(() => calculateWaterCondenser(inputs), [inputs]);
}
