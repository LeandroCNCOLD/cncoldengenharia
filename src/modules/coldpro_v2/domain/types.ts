export type HeatExchangerType =
  | "evaporator_dx"
  | "condenser"
  | "reheat"
  | "cooling_water"
  | "heating_water"
  | "steam"
  | "pump_evaporator"
  | "multiphase_condenser";

export type HeatExchangerRole =
  | "main_evaporator"
  | "main_condenser"
  | "humidity_reheat"
  | "auxiliary_condenser"
  | "secondary_evaporator"
  | "process_cooling"
  | "process_heating"
  | "subcooling_coil";

export type HeatExchangerPosition =
  | "main"
  | "front_of_evaporator"
  | "after_evaporator"
  | "external"
  | "internal"
  | "air_inlet"
  | "air_outlet";

export interface HeatExchanger {
  id: string;
  type: HeatExchangerType;
  role: HeatExchangerRole;
  position: HeatExchangerPosition;
  sequence_order: number;
  enabled: boolean;

  rows: number;
  tubes_per_row: number;
  circuits: number;
  fin_spacing_mm: number;
  length_mm: number;

  tube_diameter_mm: number | null;
  tube_thickness_mm: number | null;

  airflow_m3h: number | null;
  internal_volume_l: number | null;
  exchange_area_m2: number | null;
}

export interface Compressor {
  model: string;
  brand: string | null;
  type: string | null;
  capacity_w: number | null;
  power_w: number | null;
  quantity: number;
}

export interface Fan {
  model: string | null;
  type: string | null;
  airflow_m3h: number | null;
  power_w: number | null;
  quantity: number;
}

export interface ExpansionValve {
  model: string | null;
  type: string | null;
  capacity_w: number | null;
}

export interface Refrigerant {
  name: string;
  gwp: number | null;
  charge_kg: number | null;
}

export interface PerformancePoint {
  evap_temp_c: number;
  cond_temp_c: number;
  capacity_w: number;
  power_w: number;
  cop: number;
  ambient_temp_c: number | null;
  airflow_m3h: number | null;
}

export interface CoilInput {
  rows: number;
  tubes_per_row: number;
  circuits: number;
  fin_spacing_mm: number;
  length_mm: number;
  tube_diameter_mm: number | null;
  tube_thickness_mm: number | null;
  airflow_m3h: number | null;
  delta_t_k: number | null;
  mass_flow_kgs: number | null;
}

export interface CoilResult {
  capacity_w: number;
  sensible_capacity_w: number | null;
  latent_capacity_w: number | null;
  pressure_drop_kpa: number | null;
  air_pressure_drop_pa: number | null;
  leaving_air_temp_c: number | null;
  leaving_air_rh: number | null;
}

export interface CoilEngineResult {
  capacity_w: number;
  capacity_kw: number;
  capacity_kcalh: number;
  capacity_btuh: number;
  capacity_tr: number;
  sensible_capacity_w: number | null;
  latent_capacity_w: number | null;
  exchange_area_m2: number;
  air_pressure_drop_pa: number;
  fluid_pressure_drop_kpa: number;
  fluid_velocity_ms: number;
  warnings: string[];
  status: "ok" | "warning" | "error";
}

export interface CoilAdvancedInput {
  rows: number;
  tubes_per_row: number;
  circuits: number;
  fin_spacing_mm: number;
  length_mm: number;
  tube_diameter_mm: number | null;
  tube_thickness_mm: number | null;
  airflow_m3h: number | null;
  delta_t_k: number | null;
  mass_flow_kgs: number | null;
  air_inlet_temp_c: number | null;
  air_outlet_temp_c: number | null;
  fluid_inlet_temp_c: number | null;
  fluid_outlet_temp_c: number | null;
  fluid_h_w_m2k: number | null;
  fin_conductivity_w_mk: number | null;
  fin_thickness_m: number | null;
  wall_resistance_m2k_w: number | null;
  fouling_air_m2k_w: number | null;
  fouling_fluid_m2k_w: number | null;
  tube_roughness_m: number | null;
  fluid?: string;
  fluid_temperature_c?: number;
  fluid_pressure_kpa?: number;
  fluid_mass_flow_kgs?: number;
  tube_inner_diameter_m?: number;
  tube_outer_diameter_m?: number;
  tube_length_m?: number;
  tube_material?: string;
  circuit_distribution_mode?: "uniform" | "estimated_imbalance";
  circuit_imbalance_factor?: number;
  two_phase_mode?: "disabled" | "auto" | "forced";
  phase_type?: "evaporator" | "condenser";
  quality_override?: number;
  air_face_area_m2?: number;
  air_velocity_ms?: number;
  tube_pitch_transverse_m?: number;
  tube_pitch_longitudinal_m?: number;
  fin_thickness_mm?: number;
  air_relative_humidity?: number;
  air_mass_flow_kg_s?: number;
  enable_psychrometrics?: boolean;
  reheat_capacity_w?: number;
  enable_coupled_solver?: boolean;
  coupled_deadband_c?: number;
  relative_tolerance?: number;
  coupled_air_outlet_guess_c?: number;
  coupled_max_iterations?: number;
  coupled_tolerance_w?: number;
}

export interface CoilAdvancedResult {
  capacity_w: number;
  capacity_kw: number;
  capacity_kcalh: number;
  capacity_btuh: number;
  capacity_tr: number;
  sensible_capacity_w: number | null;
  latent_capacity_w: number | null;
  lmtd_k: number | null;
  u_w_m2k: number;
  air_h_w_m2k: number;
  fluid_h_w_m2k: number;
  reynolds_air: number;
  prandtl_air: number;
  nusselt_air: number;
  exchange_area_m2: number;
  air_pressure_drop_pa: number;
  fluid_pressure_drop_kpa: number;
  fluid_velocity_ms: number;
  fin_efficiency: number;
  warnings: string[];
  status: "ok" | "warning" | "error";
}

export type CoilSolverMode = "evaporator" | "condenser";

export interface CoilIterativeInput extends CoilAdvancedInput {
  mode: CoilSolverMode;
  air_inlet_temperature_c: number;
  air_outlet_temperature_guess_c: number | null;
  fluid_inlet_temperature_c: number;
  fluid_outlet_temperature_guess_c: number | null;
  fluid_mass_flow_kgs: number;
  fluid_cp_j_kg_k: number;
  correction_factor: number | null;
  max_iterations: number | null;
  tolerance_w: number | null;
  relaxation_factor: number | null;
}

export interface IterationRecord {
  iteration: number;
  fluid_outlet_temperature_c: number;
  air_outlet_temperature_c: number;
  air_mean_temperature_c: number;
  q_fluid_w: number;
  q_calc_w: number;
  error_w: number;
  u_w_m2k: number;
  lmtd_k: number | null;
  reynolds_air: number;
  nusselt_air: number;
  fluid_mean_temperature_c: number;
  fluid_reynolds: number;
  fluid_nusselt: number;
  fluid_h_w_m2k: number;
  fluid_velocity_ms: number;
  limiting_circuit_index: number | null;
  average_fluid_h_w_m2k: number | null;
  min_fluid_h_w_m2k: number | null;
  max_fluid_h_w_m2k: number | null;
  max_fluid_pressure_drop_kpa: number | null;
  quality_x: number | null;
  h_two_phase_w_m2k: number | null;
  air_h_w_m2k: number;
}

export interface CoilIterativeResult {
  converged: boolean;
  iterations: number;
  capacity_w: number;
  capacity_kw: number;
  capacity_kcalh: number;
  capacity_btuh: number;
  capacity_tr: number;
  air_outlet_temperature_c: number;
  fluid_outlet_temperature_c: number;
  lmtd_k: number | null;
  u_w_m2k: number;
  air_h_w_m2k: number;
  fluid_h_w_m2k: number;
  reynolds_air: number;
  prandtl_air: number;
  nusselt_air: number;
  air_pressure_drop_pa: number;
  fluid_pressure_drop_kpa: number;
  fluid_reynolds: number;
  fluid_prandtl: number;
  fluid_nusselt: number;
  fluid_velocity_ms: number;
  fluid_flow_regime: string;
  wall_resistance_m2k_w: number;
  air_j_factor: number | null;
  air_total_area_m2: number | null;
  fluid_phase: "single" | "two_phase";
  quality_x: number | null;
  h_two_phase_w_m2k: number | null;
  h_liquid_base: number | null;
  circuit_results: CircuitPerformanceResult[] | null;
  circuit_aggregation: CircuitAggregationResult | null;
  air_humidity_in: number | null;
  air_humidity_out: number | null;
  water_removed_kg_h: number | null;
  latent_load_w: number | null;
  sensible_load_w: number | null;
  final_air_temperature: number | null;
  final_air_RH: number | null;
  error_w: number;
  iteration_history: IterationRecord[];
  warnings: string[];
  status: "ok" | "warning" | "error";
}

export interface CircuitFlowItem {
  circuit_index: number;
  mass_flow_kgs: number;
  flow_fraction: number;
}

export interface CircuitFlowDistributionResult {
  circuit_flows: CircuitFlowItem[];
  total_mass_flow_kgs: number;
  circuits: number;
  distribution_mode: string;
  imbalance_factor: number;
  warnings: string[];
}

export interface CircuitPerformanceResult {
  circuit_index: number;
  mass_flow_kgs: number;
  velocity_m_s: number;
  reynolds: number;
  prandtl: number;
  nusselt: number;
  h_w_m2k: number;
  friction_factor: number;
  flow_regime: string;
  pressure_drop_pa: number;
  pressure_drop_kpa: number;
  warnings: string[];
}

export interface CircuitAggregationResult {
  average_h_w_m2k: number;
  min_h_w_m2k: number;
  max_h_w_m2k: number;
  average_reynolds: number;
  min_reynolds: number;
  max_reynolds: number;
  average_velocity_m_s: number;
  min_velocity_m_s: number;
  max_velocity_m_s: number;
  max_pressure_drop_kpa: number;
  average_pressure_drop_kpa: number;
  limiting_circuit_index: number;
  warnings: string[];
}

export interface WetCoilInput {
  T_air_in: number;
  RH_in: number;
  T_surface: number;
  air_mass_flow_kg_s: number;
  P_atm?: number;
}

export interface WetCoilResult {
  mode: "wet" | "dry";
  T_air_out: number;
  RH_out: number;
  W_in: number;
  W_out: number;
  water_removed_kg_s: number;
  latent_load_w: number;
  sensible_load_w: number;
  total_load_w: number;
  warnings: string[];
}

export interface ReheatInput {
  T_air_in: number;
  RH_in: number;
  air_mass_flow_kg_s: number;
  Q_reheat_w: number;
  P_atm?: number;
}

export interface ReheatResult {
  T_air_out: number;
  RH_out: number;
  W_out: number;
  warnings: string[];
}

export interface CoilSurfaceModeResult {
  mode: "dry" | "wet" | "transition";
  warnings: string[];
}

export interface WetAirCorrectionResult {
  corrected_air_h_w_m2k: number;
  correction_factor: number;
  warnings: string[];
}

export interface MoistAirCoolingLoadResult {
  W_in: number;
  W_out: number;
  h_in_kj_kg: number;
  h_out_kj_kg: number;
  delta_h_kj_kg: number;
  T_dp: number;
  water_removed_kg_s: number;
  water_removed_kg_h: number;
  latent_load_w: number;
  sensible_load_w: number;
  total_load_w: number;
  warnings: string[];
}

export interface CoupledIterationRecord {
  iteration: number;
  T_air_out: number;
  coil_surface_mode: "dry" | "wet" | "transition";
  dew_point_c: number;
  W_in: number;
  W_out: number;
  Q_psychrometric_w: number;
  Q_thermal_w: number;
  error_w: number;
  relative_error: number;
  u_w_m2k: number;
  air_h_corrected_w_m2k: number;
  wet_air_correction_factor: number;
  lmtd_k: number;
}

export interface CoupledCoilResult {
  solver_type: "coupled";
  converged: boolean;
  iterations: number;
  capacity_w: number;
  capacity_kcalh: number;
  capacity_kw: number;
  air_inlet_temperature_c: number;
  air_outlet_temperature_c: number;
  surface_temperature_c: number;
  coil_surface_mode: "dry" | "wet" | "transition";
  dew_point_c: number;
  W_in: number;
  W_out: number;
  water_removed_kg_h: number;
  latent_load_w: number;
  sensible_load_w: number;
  total_load_w: number;
  u_w_m2k: number;
  air_h_dry_w_m2k: number;
  air_h_corrected_w_m2k: number;
  wet_air_correction_factor: number;
  fluid_h_w_m2k: number;
  lmtd_k: number;
  error_w: number;
  relative_error: number;
  iteration_history: CoupledIterationRecord[];
  warnings: string[];
  status: string;
}

export type DripTrayCondition = "water" | "melting_ice" | "dry_air";

export interface DripTrayCoilInput {
  refrigerant?: string;
  tube_outer_diameter_m: number;
  tube_thickness_m: number;
  tube_material?: "copper" | "aluminum" | "steel" | "stainless_steel";
  tray_length_m: number;
  number_of_bends: number;
  pitch_m?: number;
  liquid_mass_flow_kgs: number;
  T_liquid_in_c: number;
  tray_condition: DripTrayCondition;
  T_tray_c: number;
  max_iterations?: number;
  tolerance_c?: number;
}

export interface DripTrayCoilResult {
  number_of_passes: number;
  bend_diameter_m: number;
  straight_length_m: number;
  bend_length_m: number;
  total_length_m: number;
  external_area_m2: number;
  tube_inner_diameter_m: number;
  h_internal_w_m2k: number;
  h_external_w_m2k: number;
  wall_resistance_m2k_w: number;
  u_w_m2k: number;
  reynolds_internal: number;
  prandtl_internal: number;
  nusselt_internal: number;
  internal_velocity_ms: number;
  T_liquid_in_c: number;
  T_liquid_out_c: number;
  liquid_subcooling_k: number;
  T_tray_c: number;
  tray_condition: DripTrayCondition;
  lmtd_k: number;
  q_tray_w: number;
  q_tray_kcalh: number;
  converged: boolean;
  iterations: number;
  warnings: string[];
  status: "ok" | "warning" | "error";
}

export interface ReheatCoilSizingInput {
  Q_reheat_target_w: number;
  T_air_in_c: number;
  T_air_out_c: number;
  air_mass_flow_kg_s: number;
  T_condensing_c: number;
  T_hot_gas_in_c: number;
  refrigerant?: string;
  tube_outer_diameter_m: number;
  tube_thickness_m: number;
  tube_material?: "copper" | "aluminum" | "steel" | "stainless_steel";
  fin_spacing_m: number;
  fin_thickness_m: number;
  fin_material?: "aluminum" | "copper";
  tube_pitch_transversal_m: number;
  tube_pitch_longitudinal_m: number;
  coil_length_m: number;
  circuits: number;
  max_rows?: number;
  evaporator_air_pressure_drop_pa?: number;
  fan_static_pressure_pa?: number;
}

export interface ReheatCoilSizingResult {
  rows_required: number;
  total_tube_length_m: number;
  external_area_m2: number;
  internal_area_m2: number;
  h_air_w_m2k: number;
  h_refrigerant_w_m2k: number;
  u_w_m2k: number;
  lmtd_k: number;
  Q_available_w: number;
  Q_available_kcalh: number;
  Q_target_w: number;
  Q_target_kcalh: number;
  capacity_ratio: number;
  reheat_air_pressure_drop_pa: number;
  total_air_pressure_drop_pa: number;
  fan_feasible: boolean;
  T_air_in_c: number;
  T_air_out_c: number;
  T_condensing_c: number;
  sizing_feasible: boolean;
  converged: boolean;
  warnings: string[];
  status: "ok" | "warning" | "error";
}

export type DefrostMethod = "hot_gas_reversal" | "hot_gas_bypass" | "electric";

export interface DefrostCycleInput {
  method: DefrostMethod;
  frost_mass_kg: number;
  frost_temperature_c: number;
  compressor_capacity_w: number;
  T_condensing_c: number;
  T_evaporating_c: number;
  refrigerant?: string;
  bypass_fraction?: number;
  evaporator_external_area_m2?: number;
  max_defrost_time_min?: number;
  P_atm?: number;
}

export interface DefrostComponentRecommendation {
  component: string;
  specification: string;
  critical: boolean;
  notes: string;
}

export interface DefrostCycleResult {
  method: DefrostMethod;
  Q_sensible_kj: number;
  Q_latent_kj: number;
  Q_total_required_kj: number;
  Q_defrost_available_w: number;
  Q_defrost_available_kw: number;
  defrost_time_min: number;
  defrost_time_feasible: boolean;
  reversal_q_fraction?: number;
  bypass_mass_flow_kg_s?: number;
  bypass_line_diameter_mm?: number;
  accumulator_volume_l?: number;
  electric_power_w?: number;
  electric_power_density_w_m2?: number;
  components: DefrostComponentRecommendation[];
  liquid_return_risk: "low" | "medium" | "high";
  risk_notes: string[];
  warnings: string[];
  status: "ok" | "warning" | "error";
}

export type AgroCycleMode = "cooling_only" | "dehumidification" | "invalid";

export interface AgroCycleInput {
  T_room_c: number;
  RH_room: number;
  T_setpoint_c: number;
  RH_setpoint: number;
  air_mass_flow_kg_s: number;
  P_atm?: number;
  max_iterations?: number;
  tolerance_w?: number;
}

export interface AgroCycleResult {
  mode: AgroCycleMode;
  T_room_c: number;
  RH_room: number;
  W_in: number;
  h_in_kj_kg: number;
  T_setpoint_c: number;
  RH_setpoint: number;
  W_setpoint: number;
  h_reheat_out_kj_kg: number;
  T_evap_out_required_c: number;
  RH_evap_out: number;
  h_evap_out_kj_kg: number;
  Q_evap_w: number;
  Q_evap_kcalh: number;
  Q_reheat_w: number;
  Q_reheat_kcalh: number;
  Q_total_cycle_w: number;
  Q_total_cycle_kcalh: number;
  water_removed_kg_s: number;
  water_removed_kg_h: number;
  final_RH_check: number;
  final_RH_error: number;
  converged: boolean;
  iterations: number;
  warnings: string[];
  status: "ok" | "warning" | "error";
}

export type EquipmentType =
  | "condensing_unit"
  | "evaporator_unit"
  | "complete_system"
  | "plugin_humidity"
  | "custom";

export interface EquipmentConfigurationResult {
  status: "valid" | "invalid";
  errors: string[];
  warnings: string[];
}

export interface EquipmentSimulationResult {
  total_capacity_kcalh: number;
  evaporator_capacity_kcalh: number;
  condenser_capacity_kcalh: number;
  reheat_capacity_kcalh: number;
  bottleneck: string;
  warnings: string[];
}

export interface Equipment {
  id: string;
  model_code: string;
  model_name: string;
  line: string | null;
  equipment_type: EquipmentType;

  voltage: number | null;
  phases: number | null;
  frequency: number | null;

  refrigerant: Refrigerant | null;
  compressor: Compressor | null;
  fans: Fan[];
  expansion_valve: ExpansionValve | null;

  heat_exchangers: HeatExchanger[];

  performance_points: PerformancePoint[];
  metadata: Record<string, unknown>;
}

export interface SimulationAssembly {
  equipment: Equipment;
  operating_conditions: {
    ambient_temp_c: number;
    room_temp_c: number;
    room_rh: number;
    altitude_m: number;
  };
  results: CoilResult[];
}
