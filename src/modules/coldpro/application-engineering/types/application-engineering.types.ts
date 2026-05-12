/**
 * application-engineering.types.ts
 *
 * Tipos do módulo Application Engineering — Engenharia de Aplicação CN COLD
 *
 * Fluxo: Seleção de Compressor → Ponto de Operação → Dimensionamento de Coils
 *        → Validação do Sistema (COP, alertas, status)
 *
 * Referências:
 *   - AHRI Standard 540 (2020) — Compressor Performance Rating
 *   - EN 12900:2013 — Refrigerant compressors — Rating conditions
 *   - ASHRAE Handbook Refrigeration (2022) — Cap. 1
 */

// ─── Modo de determinação do ponto de operação ────────────────────────────────

/** Modo A: Te e Tc fornecidos diretamente pelo engenheiro */
export interface OperatingPointModeA {
  mode: "A";
  /** Temperatura de evaporação (°C) */
  te_c: number;
  /** Temperatura de condensação (°C) */
  tc_c: number;
  /** Superaquecimento (K). Padrão: 10 K */
  superheat_k?: number;
  /** Sub-resfriamento (K). Padrão: 5 K */
  subcooling_k?: number;
}

/** Modo B: Te e Tc calculados a partir das temperaturas de ambiente e câmara */
export interface OperatingPointModeB {
  mode: "B";
  /** Temperatura da câmara frigorífica (°C) */
  t_room_c: number;
  /** Temperatura ambiente (°C) */
  t_ambient_c: number;
  /** Diferença de temperatura no evaporador (K). Padrão: 8 K */
  dt_evap_k?: number;
  /** Diferença de temperatura no condensador (K). Padrão: 12 K */
  dt_cond_k?: number;
  /** Superaquecimento (K). Padrão: 10 K */
  superheat_k?: number;
  /** Sub-resfriamento (K). Padrão: 5 K */
  subcooling_k?: number;
}

export type OperatingPointInput = OperatingPointModeA | OperatingPointModeB;

// ─── Resultado do ponto de operação ──────────────────────────────────────────

export interface OperatingPointResult {
  /** Temperatura de evaporação resolvida (°C) */
  te_c: number;
  /** Temperatura de condensação resolvida (°C) */
  tc_c: number;
  /** Superaquecimento usado (K) */
  superheat_k: number;
  /** Sub-resfriamento usado (K) */
  subcooling_k: number;
  warnings: string[];
}

// ─── Seleção de compressor ────────────────────────────────────────────────────

export interface CompressorSelectionInput {
  /** Refrigerante (ex: "R404A", "R134a") */
  refrigerant: string;
  /** Ponto de operação resolvido */
  operating_point: OperatingPointResult;
  /** Capacidade frigorífica requerida (W) */
  required_capacity_w: number;
  /** Fabricante preferido (opcional) */
  preferred_manufacturer?: string;
  /** Aplicação: LT, MT ou HT */
  application?: "LT" | "MT" | "HT";
}

export interface CompressorSelectionResult {
  /** Modelo selecionado */
  model: string;
  /** Fabricante */
  manufacturer: string;
  /** Capacidade no ponto de operação (W) */
  capacity_w: number;
  /** Potência absorvida (W) */
  power_w: number;
  /** COP do compressor */
  cop_compressor: number;
  /** Temperatura de evaporação usada */
  te_used_c: number;
  /** Temperatura de condensação usada */
  tc_used_c: number;
  /** Corrente elétrica (A) — null se não disponível */
  current_a: number | null;
  /** Status da avaliação */
  status: "ok" | "ok_nominal" | "clamped" | "out_of_envelope" | "no_data";
  /** ID do registro no catálogo */
  catalog_id?: string;
  warnings: string[];
}

// ─── Dimensionamento do evaporador ────────────────────────────────────────────

export interface EvaporatorSizingInput {
  /** Capacidade frigorífica requerida (W) */
  required_capacity_w: number;
  /** Temperatura de evaporação (°C) */
  te_c: number;
  /** Refrigerante */
  refrigerant: string;
  /** Temperatura de entrada do ar (°C) */
  t_air_in_c: number;
  /** Umidade relativa do ar (%). Padrão: 85% */
  rh_air_pct?: number;
  /** Vazão de ar (m³/h) */
  airflow_m3h: number;
  /** Número de filas. Padrão: 4 */
  rows?: number;
  /** Tubos por fila. Padrão: 20 */
  tubes_per_row?: number;
  /** Espaçamento entre aletas (mm). Padrão: 4.5 mm */
  fin_spacing_mm?: number;
  /** Comprimento aletado (mm). Padrão: 1000 mm */
  length_mm?: number;
  /** Diâmetro externo do tubo (mm). Padrão: 9.52 mm */
  tube_diameter_mm?: number;
  /** Número de circuitos. Padrão: 4 */
  circuits?: number;
}

export interface EvaporatorSizingResult {
  /** Capacidade calculada (W) */
  capacity_w: number;
  /** Temperatura de saída do ar (°C) */
  t_air_out_c: number;
  /** Área de troca total (m²) */
  exchange_area_m2: number;
  /** Área com aletas (m²) */
  finned_area_m2: number;
  /** LMTD (K) */
  lmtd_k: number;
  /** Coeficiente global U (W/m²·K) */
  u_overall_w_m2k: number;
  /** Queda de pressão do ar (Pa) */
  dp_air_pa: number;
  /** Velocidade do ar na face (m/s) */
  face_velocity_ms: number;
  /** Carga de gelo estimada (kg) */
  frost_load_kg?: number;
  // ── Campos extras do motor V2 (CoilCycleResult) ──
  /** Capacidade sensível (W) */
  sensible_capacity_w?: number;
  /** Capacidade latente (W) */
  latent_capacity_w?: number;
  /** Umidade relativa de saída do ar (%) */
  air_outlet_rh?: number;
  /** Queda de pressão do refrigerante (kPa) */
  fluid_pressure_drop_kpa?: number;
  /** Coeficiente convectivo do ar (W/m²·K) */
  h_air_w_m2k?: number;
  /** Coeficiente convectivo do fluido (W/m²·K) */
  h_fluid_w_m2k?: number;
  /** Temperatura de saída do refrigerante (°C) */
  refrigerant_outlet_temp_c?: number;
  /** Qualidade de entrada do refrigerante (0–1) */
  inlet_quality?: number;
  /** Fator de segurança da simulação */
  safety_factor?: number;
  warnings: string[];
}

// ─── Dimensionamento do condensador ──────────────────────────────────────────

export interface CondenserSizingInput {
  /** Calor total a rejeitar (W) = capacidade + potência do compressor */
  heat_rejection_w: number;
  /** Temperatura de condensação (°C) */
  tc_c: number;
  /** Temperatura ambiente (°C) */
  t_ambient_c: number;
  /** Vazão de ar (m³/h) */
  airflow_m3h: number;
  /** Refrigerante (ex: "R404A", "R134a"). Padrão: "R404A" */
  refrigerant?: string;
  /** Número de filas. Padrão: 2 */
  rows?: number;
  /** Tubos por fila. Padrão: 20 */
  tubes_per_row?: number;
  /** Espaçamento entre aletas (mm). Padrão: 2.0 mm */
  fin_spacing_mm?: number;
  /** Comprimento aletado (mm). Padrão: 1200 mm */
  length_mm?: number;
  /** Diâmetro externo do tubo (mm). Padrão: 9.52 mm */
  tube_diameter_mm?: number;
  /** Número de circuitos. Padrão: 2 */
  circuits?: number;
}

export interface CondenserSizingResult {
  /** Calor rejeitado calculado (W) */
  heat_rejection_w: number;
  /** Temperatura de saída do ar (°C) */
  t_air_out_c: number;
  /** Área de troca total (m²) */
  exchange_area_m2: number;
  /** Área com aletas (m²) */
  finned_area_m2: number;
  /** LMTD (K) */
  lmtd_k: number;
  /** Coeficiente global U (W/m²·K) */
  u_overall_w_m2k: number;
  /** Queda de pressão do ar (Pa) */
  dp_air_pa: number;
  /** Velocidade do ar na face (m/s) */
  face_velocity_ms: number;
  // ── Campos extras do motor V2 (CoilCycleResult) ──
  /** Capacidade sensível (W) */
  sensible_capacity_w?: number;
  /** Capacidade latente (W) */
  latent_capacity_w?: number;
  /** Umidade relativa de saída do ar (%) */
  air_outlet_rh?: number;
  /** Queda de pressão do refrigerante (kPa) */
  fluid_pressure_drop_kpa?: number;
  /** Coeficiente convectivo do ar (W/m²·K) */
  h_air_w_m2k?: number;
  /** Coeficiente convectivo do fluido (W/m²·K) */
  h_fluid_w_m2k?: number;
  /** Temperatura de saída do refrigerante (°C) */
  refrigerant_outlet_temp_c?: number;
  /** Qualidade de entrada do refrigerante (0–1) */
  inlet_quality?: number;
  /** Fator de segurança da simulação */
  safety_factor?: number;
  warnings: string[];
}

// ─── Ponto de operação do compressor (grade Te×Tc) ────────────────────────────

export interface CompressorOperatingPoint {
  te_c: number;
  tc_c: number;
  comp_capacity_w: number;
  comp_power_w: number;
  evap_capacity_w: number;
  cond_heat_rejection_w: number;
  evap_meets: boolean;
  cond_meets: boolean;
}

// ─── Seleção de ventilador ────────────────────────────────────────────────────

export interface FanSelectionInput {
  /** Vazão de ar requerida (m³/h) */
  airflow_m3h: number;
  /** Queda de pressão estática requerida (Pa) */
  static_pressure_pa: number;
  /** Tipo de aplicação: "evaporator" | "condenser" */
  application_type: "evaporator" | "condenser";
  /** Diâmetro máximo aceitável (mm). Opcional */
  max_diameter_mm?: number;
}

export interface FanCandidate {
  model: string;
  manufacturer: string;
  diameter_mm: number;
  airflow_m3h: number;
  static_pressure_pa: number;
  power_w: number;
  efficiency_pct: number;
  /** Pontuação de adequação (0–100) */
  score: number;
}

export interface FanSelectionResult {
  /** Ventilador recomendado */
  recommended: FanCandidate | null;
  /** Lista de candidatos ordenados por pontuação */
  candidates: FanCandidate[];
  warnings: string[];
}

// ─── Validação do sistema ─────────────────────────────────────────────────────

export interface SystemValidationInput {
  compressor: CompressorSelectionResult;
  evaporator: EvaporatorSizingResult;
  condenser: CondenserSizingResult;
  required_capacity_w: number;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface SystemAlert {
  code: string;
  severity: AlertSeverity;
  message: string;
  recommendation?: string;
}

export interface SystemValidationResult {
  /** COP do sistema (Q_evap / W_compressor) */
  cop_system: number;
  /** COP do compressor */
  cop_compressor: number;
  /** Capacidade efetiva do evaporador (W) */
  effective_capacity_w: number;
  /** Calor total rejeitado pelo condensador (W) */
  total_heat_rejection_w: number;
  /** Razão de cobertura: capacidade_evap / capacidade_requerida */
  coverage_ratio: number;
  /** Status geral: "ok" | "warning" | "critical" */
  status: "ok" | "warning" | "critical";
  /** Alertas do sistema */
  alerts: SystemAlert[];
  warnings: string[];
}

// ─── Estado global do módulo ──────────────────────────────────────────────────

export interface ApplicationEngineeringState {
  /** Ponto de operação */
  operatingPointInput: OperatingPointInput;
  operatingPointResult: OperatingPointResult | null;

  /** Seleção de compressor */
  compressorInput: Partial<CompressorSelectionInput>;
  compressorResult: CompressorSelectionResult | null;

  /** Dimensionamento do evaporador */
  evaporatorInput: Partial<EvaporatorSizingInput>;
  evaporatorResult: EvaporatorSizingResult | null;

  /** Dimensionamento do condensador */
  condenserInput: Partial<CondenserSizingInput>;
  condenserResult: CondenserSizingResult | null;

  /** Seleção de ventilador do evaporador */
  evapFanResult: FanSelectionResult | null;

  /** Seleção de ventilador do condensador */
  condFanResult: FanSelectionResult | null;

  /** Validação do sistema */
  validationResult: SystemValidationResult | null;

  /** Grade de pontos de operação do compressor (Te×Tc) */
  compressorOperatingPoints: CompressorOperatingPoint[] | null;
  /** Cobertura do evaporador (0–1): fração de pontos atendidos */
  evaporatorCoverageRatio: number | null;
  /** Cobertura do condensador (0–1): fração de pontos atendidos */
  condenserCoverageRatio: number | null;

  /** Estado de cálculo */
  isCalculating: boolean;
  lastError: string | null;
}
