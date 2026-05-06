import { useMemo } from "react";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface HeatingCoilInputs {
  /** Modo de operação */
  mode: "heating" | "reheat";
  /** Temperatura de entrada do ar [°C] */
  Tair_in_C: number;
  /** Umidade relativa de entrada (0–1) */
  RH_in: number;
  /** Vazão de ar [m³/h] */
  airFlowRate_m3h: number;
  /** Altitude [m] */
  altitude_m: number;
  /** Fluido de aquecimento */
  heatingFluid: "hot_water" | "steam";
  /** Temperatura de entrada do fluido [°C] */
  Tf_in_C: number;
  /** Temperatura de saída do fluido [°C] (ignorado para vapor) */
  Tf_out_C: number;
  /** Vazão volumétrica do fluido [m³/h] */
  fluidFlowRate_m3h: number;
  /** Número de filas de tubos */
  tubeRows: number;
  /** Número de tubos por fila */
  tubesPerRow: number;
  /** Comprimento dos tubos [m] */
  tubeLength_m: number;
  /** Passo das aletas [mm] */
  finPitch_mm: number;
  /** Diâmetro externo dos tubos [mm] */
  tubeDiameter_mm: number;
}

export interface HeatingCoilResult {
  /** Temperatura de saída do ar [°C] */
  Tair_out_C: number;
  /** Umidade relativa de saída (0–1) */
  RH_out: number;
  /** Capacidade de aquecimento [W] */
  Q_heating_W: number;
  /** Número de unidades de transferência */
  NTU: number;
  /** Efetividade do trocador (0–1) */
  epsilon: number;
  /** Coeficiente global de transferência de calor [W/m²K] */
  U_Wm2K: number;
  /** Área externa total [m²] */
  A_ext_m2: number;
  /** Queda de pressão do ar [Pa] */
  pressureDrop_Pa: number;
  /** Variação de temperatura no reaquecimento [K] */
  deltaT_reheat_K?: number;
  /** Umidade relativa final após reaquecimento (0–1) */
  RH_final?: number;
  /** Umidade específica de entrada [g/kg] */
  W_in_gkg: number;
  /** Umidade específica de saída [g/kg] */
  W_out_gkg: number;
  /** Entalpia de entrada do ar [kJ/kg] */
  h_in_kJkg: number;
  /** Entalpia de saída do ar [kJ/kg] */
  h_out_kJkg: number;
  /** Coeficiente convectivo lado ar [W/m²K] */
  h_air_Wm2K: number;
  /** Coeficiente convectivo lado fluido [W/m²K] */
  h_fluid_Wm2K: number;
  /** Vazão mássica de ar [kg/s] */
  mDot_air_kgs: number;
  /** Temperatura média do fluido [°C] */
  Tf_mean_C: number;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

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

// ─── Funções auxiliares psicrométricas ─────────────────────────────────────────

/** Pressão de saturação do vapor d'água [Pa] — equação de Magnus */
export function saturationPressurePa(tempC: number): number {
  return 611.2 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

/** Estado do ar úmido: W [kg/kg], rho [kg/m³], h [kJ/kg] */
export function calculateMoistAirState(tempC: number, relativeHumidity: number, altitudeM = 0) {
  const P_atm = 101325 * Math.pow(1 - 2.2557e-5 * altitudeM, 5.2559);
  const Psat = saturationPressurePa(tempC);
  const RH = Math.min(1, Math.max(0.01, relativeHumidity));
  const pv = Math.min(RH * Psat, P_atm * 0.99);
  const W_kgkg = 0.622 * pv / Math.max(1, P_atm - pv);
  const rho_air = P_atm / (287.05 * (tempC + 273.15) * (1 + 1.608 * W_kgkg));
  const h_kJkg = 1.006 * tempC + W_kgkg * (2501 + 1.86 * tempC);
  return { P_atm, Psat, W_kgkg, rho_air, h_kJkg };
}

// ─── Motor principal ────────────────────────────────────────────────────────────

/**
 * Calcula o desempenho de uma bateria de aquecimento aletada.
 *
 * Modelo:
 *   - NTU-efetividade com C_min/C_max corretos (ar vs fluido)
 *   - Coeficiente lado ar: correlação de Granryd (1965) para tubos aletados
 *   - Coeficiente lado fluido: Dittus-Boelter para água quente; h=8000 para vapor
 *   - Queda de pressão: correlação de Kays & London (1984)
 */
export function calculateHeatingCoil(
  inputs: HeatingCoilInputs,
): HeatingCoilResult {
  const airIn = calculateMoistAirState(inputs.Tair_in_C, inputs.RH_in, inputs.altitude_m);
  const { P_atm, W_kgkg: W_in, rho_air, h_kJkg: h_in } = airIn;

  // ── Vazão mássica de ar ──────────────────────────────────────────────────────
  const mDot_air = Math.max(0.001, (inputs.airFlowRate_m3h * rho_air) / 3600);
  const cp_air = 1006 + 1860 * W_in; // J/(kg·K)

  // ── Geometria ────────────────────────────────────────────────────────────────
  const D_ext = inputs.tubeDiameter_mm / 1000;
  const wall_m = 0.001; // espessura de parede 1mm
  const D_int = Math.max(0.005, D_ext - 2 * wall_m);
  const A_tube_bare = Math.PI * D_ext * inputs.tubeLength_m * inputs.tubeRows * inputs.tubesPerRow;

  // Fator de superfície aletada (relação área total / área de tubo nu)
  // Baseado em passo de aleta: A_fin/A_bare ≈ 2×(passo_aleta/passo_tubo_transversal)
  // Estimativa conservadora: finFactor = 1 + 2×(tubeLength / finPitch_m)
  const finPitch_m = Math.max(0.001, inputs.finPitch_mm / 1000);
  const nFins = inputs.tubeLength_m / finPitch_m;
  // Área de aleta por tubo por fila (ambos os lados)
  const pitchT_m = Math.max(D_ext * 1.3, 0.025);
  const A_fin_per_tube = 2 * (pitchT_m * inputs.tubeLength_m) * nFins;
  const A_ext_m2 = A_tube_bare + A_fin_per_tube * inputs.tubeRows * inputs.tubesPerRow;

  // ── Velocidade do ar na face ─────────────────────────────────────────────────
  const A_face = inputs.tubeLength_m * inputs.tubesPerRow * pitchT_m;
  const v_face = Math.max(0.1, (inputs.airFlowRate_m3h / 3600) / A_face);

  // ── Coeficiente convectivo lado ar (Granryd 1965 / correlação simplificada) ──
  // h_ar = 38 × Re_D^0,4 × (s/D)^-0,15 × (Pr)^0,33
  // Simplificado: h_ar ≈ 35–60 W/m²K para v = 1–5 m/s
  const Re_D = rho_air * v_face * D_ext / (1.85e-5); // μ_ar ≈ 1,85×10⁻⁵ Pa·s
  const Pr_ar = 0.71;
  const h_air = 38 * Math.pow(Math.max(1, Re_D), 0.4) * Math.pow(Pr_ar, 0.33) *
    Math.pow(Math.max(0.5, pitchT_m / D_ext), -0.15) * (airIn.P_atm / 101325);

  // ── Coeficiente convectivo lado fluido ────────────────────────────────────────
  let h_fluid: number;
  let mDot_fluid: number;
  let cp_fluid: number;
  let Tf_out_C: number;

  if (inputs.heatingFluid === "steam") {
    h_fluid = 8000; // condensação de vapor: 5000–12000 W/m²K
    mDot_fluid = Infinity;
    cp_fluid = Infinity;
    Tf_out_C = inputs.Tf_in_C; // vapor condensa isotermicamente
  } else {
    // Água quente — Dittus-Boelter
    const rho_f = 970; // kg/m³ a ~80°C
    const mu_f = 3.5e-4; // Pa·s
    const k_f = 0.67; // W/(m·K)
    const cp_f = 4195; // J/(kg·K)
    const Pr_f = cp_f * mu_f / k_f;
    const nTubesParallel = Math.max(1, inputs.tubesPerRow);
    const A_tube_int = Math.PI * D_int ** 2 / 4;
    mDot_fluid = Math.max(0.001, (inputs.fluidFlowRate_m3h * rho_f) / 3600);
    const v_fluid = mDot_fluid / (rho_f * A_tube_int * nTubesParallel);
    const Re_f = Math.max(1, rho_f * v_fluid * D_int / mu_f);
    const Nu_f = Re_f > 2300
      ? 0.023 * Math.pow(Re_f, 0.8) * Math.pow(Pr_f, 0.3) // resfriamento do fluido
      : 3.66;
    h_fluid = Nu_f * k_f / D_int;
    cp_fluid = cp_f;
    Tf_out_C = inputs.Tf_out_C;
  }

  // ── Coeficiente global ────────────────────────────────────────────────────────
  // Eficiência da aleta (alumínio, k=200 W/mK) — simplificado: η_fin ≈ 0,85
  const eta_fin = 0.85;
  const eta_surface = 1 - (1 - eta_fin) * (A_fin_per_tube * inputs.tubeRows * inputs.tubesPerRow) / A_ext_m2;
  const U_Wm2K = 1 / (
    1 / (eta_surface * h_air) +
    0.0001 + // fouling ar
    (D_ext / D_int) / h_fluid
  );

  // ── NTU-efetividade ───────────────────────────────────────────────────────────
  const C_air = mDot_air * cp_air;
  const C_fluid = inputs.heatingFluid === "steam" ? Infinity : mDot_fluid * cp_fluid;
  const C_min = Math.min(C_air, C_fluid);
  const C_max = Math.max(C_air, C_fluid);
  const C_ratio = C_max === Infinity ? 0 : C_min / C_max;

  const NTU = (U_Wm2K * A_ext_m2) / C_min;

  // Efetividade: fluxo cruzado sem mistura (bateria de aquecimento típica)
  // ε = 1 - exp(NTU^0,22 × (exp(-C* × NTU^0,78) - 1) / C*)
  let epsilon: number;
  if (C_ratio < 0.01) {
    epsilon = Math.min(0.98, 1 - Math.exp(-NTU)); // condensador/evaporador
  } else {
    epsilon = Math.min(0.98,
      1 - Math.exp(
        (Math.exp(-C_ratio * Math.pow(NTU, 0.78)) - 1) *
        Math.pow(NTU, 0.22) / C_ratio
      )
    );
  }

  // ── Resultados térmicos ───────────────────────────────────────────────────────
  const Tf_mean_C = (inputs.Tf_in_C + Tf_out_C) / 2;
  // Q_max = C_min × (T_hot_in - T_cold_in) — definição correta do método NTU-ε.
  // Usar Tf_mean subestima Q_max quando há grande diferença entre Tf_in e Tf_out.
  // Referência: Incropera 7ª ed., Eq. 11.21; ASHRAE Fundamentals 2017, Cap. 23.
  const Q_max = C_min * (inputs.Tf_in_C - inputs.Tair_in_C);
  const Q_heating_W = Math.max(0, epsilon * Q_max);
  const Tair_out_C = inputs.Tair_in_C + Q_heating_W / C_air;

  // ── Estado do ar de saída ─────────────────────────────────────────────────────
  const h_out_kJkg = h_in + Q_heating_W / (mDot_air * 1000);
  const Psat_out = saturationPressurePa(Tair_out_C);
  const RH_out = Math.min(1, Math.max(0,
    (W_in * P_atm) / (Psat_out * (0.622 + W_in))
  ));

  // ── Queda de pressão do ar (Kays & London) ────────────────────────────────────
  // ΔP ≈ f × (L/D_h) × ρ × v² / 2
  // Para baterias aletadas: f ≈ 0,12–0,18 (estimativa conservadora)
  const f_fin = 0.15;
  const D_h = 4 * finPitch_m * pitchT_m / (2 * (finPitch_m + pitchT_m)); // diâmetro hidráulico
  const L_depth = inputs.tubeRows * pitchT_m; // profundidade total
  const pressureDrop_Pa = f_fin * (L_depth / Math.max(0.001, D_h)) *
    rho_air * v_face ** 2 / 2;

  return {
    Tair_out_C,
    RH_out,
    Q_heating_W,
    NTU,
    epsilon,
    U_Wm2K,
    A_ext_m2,
    pressureDrop_Pa,
    deltaT_reheat_K: inputs.mode === "reheat" ? Tair_out_C - inputs.Tair_in_C : undefined,
    RH_final: inputs.mode === "reheat" ? RH_out : undefined,
    W_in_gkg: W_in * 1000,
    W_out_gkg: W_in * 1000, // W não muda em aquecimento sensível
    h_in_kJkg: h_in,
    h_out_kJkg,
    h_air_Wm2K: h_air,
    h_fluid_Wm2K: h_fluid,
    mDot_air_kgs: mDot_air,
    Tf_mean_C,
  };
}

export function useHeatingCoilSimulation(inputs: HeatingCoilInputs) {
  return useMemo(() => calculateHeatingCoil(inputs), [inputs]);
}
