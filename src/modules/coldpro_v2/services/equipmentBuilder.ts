import type {
  Equipment,
  EquipmentType,
  HeatExchanger,
  CoilInput,
  EquipmentConfigurationResult,
  EquipmentSimulationResult,
} from "../domain/types";
import { calculateCoil } from "../engines/coilCalculationEngine";

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `eq-${Date.now()}-${idCounter}`;
}

// ── Create ───────────────────────────────────────────────────────

export function createEquipment(input: {
  model_code: string;
  model_name: string;
  type: EquipmentType;
}): Equipment {
  return {
    id: generateId(),
    model_code: input.model_code,
    model_name: input.model_name,
    line: null,
    equipment_type: input.type,

    voltage: null,
    phases: null,
    frequency: null,

    refrigerant: null,
    compressor: null,
    fans: [],
    expansion_valve: null,

    heat_exchangers: [],

    performance_points: [],
    metadata: {},
  };
}

// ── Add heat exchanger ───────────────────────────────────────────

export function addHeatExchanger(equipment: Equipment, exchanger: HeatExchanger): Equipment {
  const duplicate = equipment.heat_exchangers.some((hx) => hx.id === exchanger.id);
  if (duplicate) {
    return equipment;
  }

  const heat_exchangers = [...equipment.heat_exchangers, exchanger].sort(
    (a, b) => a.sequence_order - b.sequence_order,
  );

  return { ...equipment, heat_exchangers };
}

// ── Remove heat exchanger ────────────────────────────────────────

export function removeHeatExchanger(equipment: Equipment, exchangerId: string): Equipment {
  const heat_exchangers = equipment.heat_exchangers.filter((hx) => hx.id !== exchangerId);
  return { ...equipment, heat_exchangers };
}

// ── Toggle heat exchanger ────────────────────────────────────────

export function toggleHeatExchanger(
  equipment: Equipment,
  exchangerId: string,
  enabled: boolean,
): Equipment {
  const heat_exchangers = equipment.heat_exchangers.map((hx) =>
    hx.id === exchangerId ? { ...hx, enabled } : hx,
  );
  return { ...equipment, heat_exchangers };
}

// ── Sort heat exchangers ─────────────────────────────────────────

export function sortHeatExchangersBySequence(equipment: Equipment): Equipment {
  const heat_exchangers = [...equipment.heat_exchangers].sort(
    (a, b) => a.sequence_order - b.sequence_order,
  );
  return { ...equipment, heat_exchangers };
}

// ── Validate configuration ───────────────────────────────────────

function hasEnabledRole(equipment: Equipment, role: string): boolean {
  return equipment.heat_exchangers.some((hx) => hx.role === role && hx.enabled);
}

export function validateEquipmentConfiguration(equipment: Equipment): EquipmentConfigurationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const eqType = equipment.equipment_type;

  if (eqType === "condensing_unit") {
    if (!equipment.compressor) {
      errors.push("Condensing unit requer compressor");
    }
    if (!hasEnabledRole(equipment, "main_condenser")) {
      errors.push("Condensing unit requer main_condenser");
    }
  }

  if (eqType === "evaporator_unit") {
    if (!hasEnabledRole(equipment, "main_evaporator")) {
      errors.push("Evaporator unit requer main_evaporator");
    }
  }

  if (eqType === "complete_system") {
    if (!hasEnabledRole(equipment, "main_evaporator")) {
      errors.push("Complete system requer main_evaporator");
    }
    if (!hasEnabledRole(equipment, "main_condenser")) {
      errors.push("Complete system requer main_condenser");
    }
  }

  if (eqType === "plugin_humidity") {
    if (!hasEnabledRole(equipment, "main_evaporator")) {
      errors.push("Plugin umidade requer main_evaporator");
    }
    if (!hasEnabledRole(equipment, "humidity_reheat")) {
      errors.push("Plugin umidade requer humidity_reheat");
    }
  }

  if (equipment.heat_exchangers.length === 0) {
    warnings.push("Nenhum heat exchanger configurado");
  }

  const status = errors.length === 0 ? "valid" : "invalid";
  return { status, errors, warnings };
}

// ── Simulate equipment ───────────────────────────────────────────

function hxToCoilInput(hx: HeatExchanger): CoilInput {
  return {
    rows: hx.rows,
    tubes_per_row: hx.tubes_per_row,
    circuits: hx.circuits,
    fin_spacing_mm: hx.fin_spacing_mm,
    length_mm: hx.length_mm,
    tube_diameter_mm: hx.tube_diameter_mm,
    tube_thickness_mm: hx.tube_thickness_mm,
    airflow_m3h: hx.airflow_m3h,
    delta_t_k: 10,
    mass_flow_kgs: null,
  };
}

export function simulateEquipment(equipment: Equipment): EquipmentSimulationResult {
  const warnings: string[] = [];
  let evaporator_capacity_kcalh = 0;
  let condenser_capacity_kcalh = 0;
  let reheat_capacity_kcalh = 0;

  const enabledHxs = equipment.heat_exchangers.filter((hx) => hx.enabled);

  for (const hx of enabledHxs) {
    const result = calculateCoil(hxToCoilInput(hx));
    warnings.push(...result.warnings.map((w) => `[${hx.id}] ${w}`));

    if (hx.role === "main_evaporator" || hx.role === "secondary_evaporator") {
      evaporator_capacity_kcalh += result.capacity_kcalh;
    } else if (hx.role === "main_condenser" || hx.role === "auxiliary_condenser") {
      condenser_capacity_kcalh += result.capacity_kcalh;
    } else if (hx.role === "humidity_reheat") {
      reheat_capacity_kcalh += result.capacity_kcalh;
    }
  }

  const total_capacity_kcalh =
    evaporator_capacity_kcalh + condenser_capacity_kcalh + reheat_capacity_kcalh;

  let bottleneck = "none";
  if (evaporator_capacity_kcalh > 0 && condenser_capacity_kcalh > 0) {
    bottleneck = evaporator_capacity_kcalh <= condenser_capacity_kcalh ? "evaporator" : "condenser";
  } else if (evaporator_capacity_kcalh > 0) {
    bottleneck = "evaporator";
  } else if (condenser_capacity_kcalh > 0) {
    bottleneck = "condenser";
  }

  return {
    total_capacity_kcalh,
    evaporator_capacity_kcalh,
    condenser_capacity_kcalh,
    reheat_capacity_kcalh,
    bottleneck,
    warnings,
  };
}
