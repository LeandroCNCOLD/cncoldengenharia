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
  error_w: number;
  iteration_history: IterationRecord[];
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
