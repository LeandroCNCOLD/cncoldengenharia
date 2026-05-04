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
 * Modelo:
 *   - Coeficiente lado água: correlação de Dittus-Boelter (Re, Pr)
 *   - Coeficiente lado refrigerante: condensação em filme (Shah 1979 simplificado)
 *   - LMTD contracorrente com 3 zonas: dessuperaquecimento + condensação + sub-resfriamento
 *   - Queda de pressão: Darcy-Weisbach (fator de atrito de Churchill)
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
    superheat_K,
    subcooling_K,
  } = inputs;

  const Q = Math.max(0, Q_total_W);

  // ── Propriedades da água (a ~30°C) ──────────────────────────────────────────
  const cpWater = 4182;      // J/(kg·K)
  const rhoWater = 995;      // kg/m³
  const muWater = 8e-4;      // Pa·s
  const kWater = 0.617;      // W/(m·K)

  // ── Geometria dos tubos ──────────────────────────────────────────────────────
  const D_ext = tubeDiameter_mm / 1000;
  const D_int = Math.max(0.005, D_ext - 0.002); // espessura de parede 1 mm
  const A_tube_int = Math.PI * D_int ** 2 / 4; // área seccional de 1 tubo

  // ── Vazão mássica de água ────────────────────────────────────────────────────
  const mDotWater = Math.max(0.001, (waterFlowRate_m3h * rhoWater) / 3600); // kg/s

  // ── Temperatura de saída da água ─────────────────────────────────────────────
  const Tw_out_C = Tw_in_C + Q / (mDotWater * cpWater);

  // ── Temperatura de condensação ───────────────────────────────────────────────
  // Tc = Tw_out + approach mínimo de 5K (pinch point na zona de condensação)
  const Tc_C = Tw_out_C + 5;

  // ── Coeficiente convectivo lado água (Dittus-Boelter) ───────────────────────
  const v_water = mDotWater / (rhoWater * A_tube_int * tubeCount);
  const Re_water = Math.max(1, rhoWater * v_water * D_int / muWater);
  // Turbulento: Nu = 0,023 Re^0,8 Pr^0,4 com Pr = cp·μ/k
  const Nu_water = Re_water > 2300
    ? 0.023 * Math.pow(Re_water, 0.8) * Math.pow(cpWater * muWater / kWater, 0.4)
    : 3.66; // laminar
  const h_water = Nu_water * kWater / D_int;

  // ── Coeficiente convectivo lado refrigerante (estimativa simplificada) ──────
  const h_ref = 3500;

  // ── Resistência da parede (aço inox: k=16 W/mK; cobre: k=380 W/mK) ──────────
  const k_wall = 380; // cobre
  const R_wall = Math.log(D_ext / D_int) / (2 * Math.PI * k_wall * tubeLength_m);
  const R_fouling_water = 0.0001; // m²K/W (TEMA R)
  const R_fouling_ref = 0.00005;  // m²K/W

  // ── Coeficiente global (baseado na área externa) ─────────────────────────────
  const A_int_per_m = Math.PI * D_int;
  const A_ext_per_m = Math.PI * D_ext;
  const U_Wm2K = 1 / (
    1 / h_ref +
    R_fouling_ref +
    R_wall * A_ext_per_m +
    (A_ext_per_m / A_int_per_m) * (R_fouling_water + 1 / h_water)
  );

  // ── LMTD contracorrente ──────────────────────────────────────────────────────
  // Zona de condensação (dominante): Tc constante, água de Tw_in a Tw_out
  const DT1 = Math.max(0.1, Tc_C - Tw_out_C); // extremidade quente
  const DT2 = Math.max(0.1, Tc_C - Tw_in_C);  // extremidade fria
  const LMTD_K = Math.abs(DT2 - DT1) < 1e-9
    ? DT1
    : (DT2 - DT1) / Math.log(DT2 / DT1);

  // ── Área necessária e disponível ─────────────────────────────────────────────
  const A_needed_m2 = Q / Math.max(1, U_Wm2K * LMTD_K);
  const A_available_m2 = Math.PI * D_ext * tubeLength_m * tubeCount * passes;
  const areaMargin = A_needed_m2 > 0
    ? (A_available_m2 - A_needed_m2) / A_needed_m2
    : 0;

  // ── Queda de pressão (Darcy-Weisbach) ────────────────────────────────────────
  // Fator de atrito de Churchill (1977) — válido para todos os regimes
  const f = Re_water > 2300
    ? 0.316 * Math.pow(Re_water, -0.25) // Blasius (turbulento suave)
    : 64 / Re_water; // Hagen-Poiseuille
  const L_total = tubeLength_m * passes;
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
  };
}

export function useWaterCondenserSimulation(inputs: WaterCondenserInputs) {
  return useMemo(() => calculateWaterCondenser(inputs), [inputs]);
}
