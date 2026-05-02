import type { Equipment, HeatExchanger } from "../domain/types";

export interface TechnicalStatusResult {
  status: "complete" | "incomplete" | "critical";
  missingFields: string[];
  warnings: string[];
  componentsStatus: Record<string, unknown>;
}

const REQUIRED_GEOMETRY_FIELDS: (keyof HeatExchanger)[] = [
  "rows",
  "tubes_per_row",
  "circuits",
  "fin_spacing_mm",
  "length_mm",
];

function validateHeatExchanger(hx: HeatExchanger): { missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!hx.enabled) return { missing, warnings };

  for (const field of REQUIRED_GEOMETRY_FIELDS) {
    const value = hx[field];
    if (value === null || value === undefined || value === 0) {
      missing.push(`${hx.id}.${field}`);
    }
  }

  return { missing, warnings };
}

function hasRole(equipment: Equipment, role: string): boolean {
  return equipment.heat_exchangers.some((hx) => hx.role === role && hx.enabled);
}

function detectEquipmentType(equipment: Equipment): string {
  const hasEvap = hasRole(equipment, "main_evaporator");
  const hasCond = hasRole(equipment, "main_condenser");

  if (hasEvap && hasCond) return "complete_system";
  if (hasCond && !hasEvap) return "condensing_unit";
  if (hasEvap && !hasCond) return "evaporator_unit";
  return "unknown";
}

export function getTechnicalStatus(equipment: Equipment): TechnicalStatusResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const componentsStatus: Record<string, unknown> = {};

  const equipType = detectEquipmentType(equipment);
  componentsStatus["detected_type"] = equipType;

  for (const hx of equipment.heat_exchangers) {
    const result = validateHeatExchanger(hx);
    missingFields.push(...result.missing);
    warnings.push(...result.warnings);

    componentsStatus[hx.id] = {
      type: hx.type,
      role: hx.role,
      enabled: hx.enabled,
      valid: result.missing.length === 0,
      missing: result.missing,
    };
  }

  if (equipType === "complete_system") {
    if (!hasRole(equipment, "main_evaporator")) {
      missingFields.push("main_evaporator");
    }
    if (!hasRole(equipment, "main_condenser")) {
      missingFields.push("main_condenser");
    }
  }

  let status: TechnicalStatusResult["status"];

  if (missingFields.length === 0) {
    status = "complete";
  } else if (missingFields.some((f) => f === "main_evaporator" || f === "main_condenser")) {
    status = "critical";
  } else {
    status = "incomplete";
  }

  return { status, missingFields, warnings, componentsStatus };
}
