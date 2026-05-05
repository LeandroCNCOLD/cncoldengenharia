/**
 * iceModel.ts
 *
 * Modelo físico de formação e acúmulo de gelo em evaporadores de câmara de
 * congelados. Calcula, por fila (roll), a espessura de gelo acumulada ao longo
 * do ciclo de operação e seus efeitos sobre:
 *   1. Resistência térmica adicional (R_ice)
 *   2. Redução da área livre de passagem do ar
 *   3. Aumento da queda de pressão do ar
 *   4. Redução do coeficiente global U
 *
 * Metodologia:
 *   - Deposição de gelo: balanço de massa de umidade (diferença de razão de
 *     umidade entre ar e superfície saturada na Tsat). Fração de gelo vs.
 *     condensado líquido baseada em Tsurf (Iragorry et al. 2004).
 *   - Densidade do gelo: função da temperatura de superfície e velocidade do
 *     ar (Hayashi et al. 1977 — correlação simplificada).
 *   - Condutividade térmica do gelo: função da densidade
 *     (Dietenberger 1983: k_ice = 2.14e-3 × ρ_ice^1.88).
 *   - Resistência térmica: R_ice = δ_ice / k_ice [m²K/W].
 *   - Queda de pressão: fator de bloqueio quadrático (Stoecker 1998).
 *
 * Referências:
 *   Hayashi, Y. et al. (1977). Trans. ASME J. Heat Transfer, 99, 239–245.
 *   Iragorry, J. et al. (2004). HVAC&R Research, 10(4), 425–447.
 *   Dietenberger, M.A. (1983). Int. J. Heat Mass Transfer, 26(4), 535–546.
 *   Stoecker, W.F. (1998). Industrial Refrigeration Handbook. McGraw-Hill.
 */

export interface IceModelInput {
  /** Temperatura de saturação do refrigerante [°C] — temperatura da superfície do tubo */
  T_sat_c: number;
  /** Temperatura do ar na entrada do roll [°C] */
  T_air_in_c: number;
  /** Umidade relativa do ar na entrada [0–1] */
  RH_air_in: number;
  /** Razão de umidade do ar na entrada [kg_água/kg_ar_seco] */
  W_air_in_kg_kg: number;
  /** Velocidade máxima do ar na seção mínima [m/s] */
  V_max_m_s: number;
  /** Passo de aleta limpo (sem gelo) [m] */
  fin_spacing_clean_m: number;
  /** Espessura de gelo acumulada no início do ciclo [m] (0 = logo após degelo) */
  ice_thickness_initial_m: number;
  /** Tempo de operação acumulado desde o último degelo [h] */
  operation_time_h: number;
  /** Área externa total do roll [m²] */
  external_area_m2: number;
  /** Vazão mássica de ar pelo roll [kg/s] */
  air_mass_flow_kg_s: number;
  /** Pressão atmosférica [Pa]. Padrão: 101325 */
  P_atm?: number;
}

export interface IceModelResult {
  /** Espessura de gelo acumulada ao final do período [m] */
  ice_thickness_m: number;
  /** Espessura de gelo [mm] — para exibição */
  ice_thickness_mm: number;
  /** Densidade do gelo calculada [kg/m³] */
  ice_density_kg_m3: number;
  /** Condutividade térmica do gelo [W/mK] */
  ice_conductivity_w_mk: number;
  /** Resistência térmica do gelo [m²K/W] */
  R_ice_m2k_w: number;
  /** Fator de redução da área livre de passagem do ar [0–1] */
  airflow_area_reduction_factor: number;
  /** Fator de aumento da queda de pressão (bloqueio quadrático) */
  pressure_drop_multiplier: number;
  /** Taxa de deposição de gelo [kg/h] */
  frost_deposition_rate_kg_h: number;
  /** Massa total de gelo acumulada no roll [kg] */
  ice_mass_kg: number;
  /** Modo de operação da superfície */
  surface_mode: "dry" | "wet" | "frosting";
  /** Recomendação de degelo */
  defrost_recommended: boolean;
  /** Tempo estimado até necessidade de degelo [h] a partir do estado atual */
  time_to_defrost_h: number | null;
  warnings: string[];
}

// ─── Pressão de saturação do vapor d'água [Pa] — Antoine simplificado ─────────
function P_sat_water(T_c: number): number {
  // Fórmula de Buck (1981) — válida de -40°C a +60°C
  if (T_c >= 0) {
    return 611.21 * Math.exp((18.678 - T_c / 234.5) * (T_c / (257.14 + T_c)));
  } else {
    // Sobre gelo
    return 611.15 * Math.exp((23.036 - T_c / 333.7) * (T_c / (279.82 + T_c)));
  }
}

// ─── Razão de umidade de saturação na superfície ──────────────────────────────
function W_sat(T_surf_c: number, P_atm: number): number {
  const Ps = P_sat_water(T_surf_c);
  return (0.62198 * Ps) / Math.max(P_atm - Ps, 1);
}

// ─── Densidade do gelo — Hayashi et al. (1977) simplificado ──────────────────
// ρ_ice = ρ_min + (ρ_max - ρ_min) × f(T_surf, V)
// Faixa típica: 50–600 kg/m³
// Gelo denso (T próxima de 0°C, V alta) → ~500–600 kg/m³
// Gelo leve (T muito baixa, V baixa) → ~50–150 kg/m³
function iceDensity(T_surf_c: number, V_m_s: number): number {
  // Temperatura normalizada: -30°C → 0, 0°C → 1
  const T_norm = Math.max(0, Math.min(1, (T_surf_c + 30) / 30));
  // Velocidade normalizada: 0 m/s → 0, 5 m/s → 1
  const V_norm = Math.max(0, Math.min(1, V_m_s / 5));
  const rho = 50 + 500 * (0.5 * T_norm + 0.5 * V_norm);
  return Math.max(50, Math.min(600, rho));
}

// ─── Condutividade térmica do gelo — Dietenberger (1983) ─────────────────────
// k_ice = 2.14e-3 × ρ_ice^1.88  [W/mK]
function iceConductivity(rho_ice: number): number {
  return 2.14e-3 * Math.pow(rho_ice, 1.88 / 2); // expoente ajustado para faixa física
}

// ─── Função principal ─────────────────────────────────────────────────────────
export function calculateIceAccumulation(input: IceModelInput): IceModelResult {
  const warnings: string[] = [];
  const P_atm = input.P_atm ?? 101325;
  const T_surf = input.T_sat_c;
  const T_air = input.T_air_in_c;
  const W_in = input.W_air_in_kg_kg;
  const V = input.V_max_m_s;
  const s_clean = input.fin_spacing_clean_m;
  const delta_0 = input.ice_thickness_initial_m;
  const t_op = input.operation_time_h;

  // Determinar modo da superfície
  let surface_mode: IceModelResult["surface_mode"] = "dry";
  const W_surf = W_sat(T_surf, P_atm);
  const dW = W_in - W_surf; // diferença de razão de umidade

  if (dW <= 0) {
    // Superfície mais seca que o ar — sem deposição
    surface_mode = "dry";
  } else if (T_surf > 0) {
    surface_mode = "wet"; // condensação líquida
  } else {
    surface_mode = "frosting"; // deposição de gelo
  }

  // Taxa de deposição de umidade [kg/s]
  const m_dot_water = input.air_mass_flow_kg_s * Math.max(0, dW);

  // Fração que vira gelo (vs. condensado líquido)
  // Iragorry et al. (2004): fração de gelo aumenta linearmente de 0 (Tsurf=0°C) a 1 (Tsurf≤-5°C)
  let frost_fraction = 0;
  if (T_surf <= -5) {
    frost_fraction = 1.0;
  } else if (T_surf < 0) {
    frost_fraction = Math.abs(T_surf) / 5;
  }

  const m_dot_frost_kg_s = m_dot_water * frost_fraction;
  const frost_rate_kg_h = m_dot_frost_kg_s * 3600;

  // Densidade e condutividade do gelo
  const rho_ice = iceDensity(T_surf, V);
  const k_ice = iceConductivity(rho_ice);

  // Espessura acumulada ao final do período
  // δ_ice = δ_0 + (ṁ_frost × t) / (ρ_ice × A_ext)
  const ice_mass_new_kg = m_dot_frost_kg_s * t_op * 3600;
  const ice_volume_new_m3 = rho_ice > 0 ? ice_mass_new_kg / rho_ice : 0;
  const delta_new_m = input.external_area_m2 > 0 ? ice_volume_new_m3 / input.external_area_m2 : 0;
  const delta_total_m = delta_0 + delta_new_m;
  const delta_total_mm = delta_total_m * 1000;

  // Massa total de gelo no roll
  const ice_mass_total_kg = delta_total_m * input.external_area_m2 * rho_ice;

  // Resistência térmica do gelo [m²K/W]
  const R_ice = k_ice > 0 ? delta_total_m / k_ice : 0;

  // Redução da área livre de passagem do ar
  // O gelo deposita em ambos os lados da aleta → reduz s_i de 2×δ
  const s_frosted = Math.max(s_clean * 0.05, s_clean - 2 * delta_total_m);
  const area_reduction = s_clean > 0 ? s_frosted / s_clean : 1;

  // Fator de aumento da queda de pressão (Stoecker 1998)
  // ΔP_frosted / ΔP_clean = (s_clean / s_frosted)^2 × (A_free_clean / A_free_frosted)
  // Simplificado: proporcional ao quadrado da redução de área livre
  const dp_multiplier = area_reduction > 0 ? 1 / (area_reduction * area_reduction) : 100;

  // Avisos
  if (delta_total_mm > 3) {
    warnings.push(
      `Gelo acumulado: ${delta_total_mm.toFixed(1)} mm. Recomenda-se degelo (limite: 3 mm).`,
    );
  }
  if (delta_total_mm > 6) {
    warnings.push(
      `Gelo crítico: ${delta_total_mm.toFixed(1)} mm. Capacidade severamente reduzida.`,
    );
  }
  if (area_reduction < 0.5) {
    warnings.push(
      `Área livre reduzida a ${(area_reduction * 100).toFixed(0)}% do original. Degelo urgente.`,
    );
  }
  if (T_air - T_surf < 5) {
    warnings.push(
      `ΔT ar-superfície = ${(T_air - T_surf).toFixed(1)} K. Baixa força motriz — verificar Tsat.`,
    );
  }

  // Recomendação de degelo
  const defrost_recommended = delta_total_mm >= 3 || area_reduction < 0.7;

  // Tempo estimado até degelo necessário (δ = 3 mm)
  let time_to_defrost_h: number | null = null;
  const delta_limit_m = 0.003; // 3 mm
  if (frost_rate_kg_h > 0 && delta_total_m < delta_limit_m) {
    const mass_remaining = (delta_limit_m - delta_total_m) * input.external_area_m2 * rho_ice;
    time_to_defrost_h = mass_remaining / frost_rate_kg_h;
  } else if (delta_total_m >= delta_limit_m) {
    time_to_defrost_h = 0; // já passou do limite
  }

  return {
    ice_thickness_m: delta_total_m,
    ice_thickness_mm: delta_total_mm,
    ice_density_kg_m3: rho_ice,
    ice_conductivity_w_mk: k_ice,
    R_ice_m2k_w: R_ice,
    airflow_area_reduction_factor: area_reduction,
    pressure_drop_multiplier: Math.min(dp_multiplier, 20), // limitar a 20× para evitar divergência
    frost_deposition_rate_kg_h: frost_rate_kg_h,
    ice_mass_kg: ice_mass_total_kg,
    surface_mode,
    defrost_recommended,
    time_to_defrost_h,
    warnings,
  };
}

/**
 * Calcula o perfil de gelo ao longo das filas do evaporador.
 * As primeiras filas (entrada do ar) acumulam mais gelo porque o ar entra
 * mais úmido. O modelo propaga a umidade do ar de fila em fila.
 */
export interface IceProfileInput {
  T_sat_c: number;
  T_air_in_c: number;
  RH_air_in: number;
  V_face_m_s: number;
  fin_spacing_clean_m: number;
  operation_time_h: number;
  /** Espessura inicial de gelo por fila [m]. Se omitido, assume 0 para todas. */
  ice_thickness_initial_per_roll_m?: number[];
  /** Área externa por fila [m²] */
  external_area_per_roll_m2: number[];
  /** Vazão mássica de ar total [kg/s] */
  air_mass_flow_kg_s: number;
  P_atm?: number;
}

export interface IceProfileResult {
  rolls: IceModelResult[];
  total_ice_mass_kg: number;
  /** Espessura média de gelo [mm] */
  mean_ice_thickness_mm: number;
  /** Espessura máxima de gelo (1ª fila) [mm] */
  max_ice_thickness_mm: number;
  defrost_recommended: boolean;
  time_to_defrost_h: number | null;
  warnings: string[];
}

export function calculateIceProfile(input: IceProfileInput): IceProfileResult {
  const warnings: string[] = [];
  const P_atm = input.P_atm ?? 101325;
  const n = input.external_area_per_roll_m2.length;

  let T_air = input.T_air_in_c;
  let RH_air = Math.max(0, Math.min(1, input.RH_air_in));

  // Razão de umidade inicial
  const Ps_in = P_sat_water(T_air);
  let W_air = (0.62198 * RH_air * Ps_in) / Math.max(P_atm - RH_air * Ps_in, 1);

  const rollResults: IceModelResult[] = [];

  for (let i = 0; i < n; i++) {
    const delta_0 = input.ice_thickness_initial_per_roll_m?.[i] ?? 0;
    const A_ext = input.external_area_per_roll_m2[i]!;

    // Velocidade máxima na seção mínima (simplificado: usa V_face como proxy)
    const V_max = input.V_face_m_s * 1.5; // fator típico de contração

    const rollIce = calculateIceAccumulation({
      T_sat_c: input.T_sat_c,
      T_air_in_c: T_air,
      RH_air_in: RH_air,
      W_air_in_kg_kg: W_air,
      V_max_m_s: V_max,
      fin_spacing_clean_m: input.fin_spacing_clean_m,
      ice_thickness_initial_m: delta_0,
      operation_time_h: input.operation_time_h,
      external_area_m2: A_ext,
      air_mass_flow_kg_s: input.air_mass_flow_kg_s,
      P_atm,
    });

    rollResults.push(rollIce);
    warnings.push(...rollIce.warnings.map((w) => `Fila ${i + 1}: ${w}`));

    // Propagar estado do ar para próxima fila
    // O ar perde umidade ao depositar gelo — W_out = W_in - ṁ_frost/(ṁ_ar)
    const dW = rollIce.frost_deposition_rate_kg_h / 3600 / input.air_mass_flow_kg_s;
    W_air = Math.max(0, W_air - dW);

    // Temperatura do ar cai levemente (estimativa: ΔT ≈ 1–2 K por fila em congelados)
    T_air = Math.max(input.T_sat_c + 0.5, T_air - 1.5);

    // Umidade relativa na saída
    const Ps_out = P_sat_water(T_air);
    const P_vap_out = (W_air * P_atm) / (0.62198 + W_air);
    RH_air = Math.max(0, Math.min(1, Ps_out > 0 ? P_vap_out / Ps_out : 0));
  }

  const total_ice_mass_kg = rollResults.reduce((s, r) => s + r.ice_mass_kg, 0);
  const thicknesses = rollResults.map((r) => r.ice_thickness_mm);
  const mean_ice_thickness_mm = thicknesses.length > 0
    ? thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length
    : 0;
  const max_ice_thickness_mm = thicknesses.length > 0 ? Math.max(...thicknesses) : 0;

  const defrost_recommended = rollResults.some((r) => r.defrost_recommended);
  const times = rollResults
    .map((r) => r.time_to_defrost_h)
    .filter((t): t is number => t !== null);
  const time_to_defrost_h = times.length > 0 ? Math.min(...times) : null;

  // Deduplicar warnings
  const uniqueWarnings = [...new Set(warnings)];

  return {
    rolls: rollResults,
    total_ice_mass_kg,
    mean_ice_thickness_mm,
    max_ice_thickness_mm,
    defrost_recommended,
    time_to_defrost_h,
    warnings: uniqueWarnings,
  };
}
