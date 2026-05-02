import type { UnifiedOperationalOutput } from "../domain/types";

type UnknownRecord = Record<string, unknown>;

function safeNumber(value: unknown, field: string, warnings: string[]): number {
  if (value === undefined || value === null) {
    warnings.push(`normalizeOperationalOutput: field "${field}" is missing, defaulting to 0.`);
    return 0;
  }
  const n = Number(value);
  if (isNaN(n)) {
    warnings.push(`normalizeOperationalOutput: field "${field}" is NaN, defaulting to 0.`);
    return 0;
  }
  return n;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getOutputStatus(value: unknown): UnifiedOperationalOutput["status"] {
  return value === "ok" || value === "warning" || value === "error" ? value : "error";
}

function getCycleStatus(value: unknown): UnifiedOperationalOutput["cycle_status"] {
  return value === "normal" ||
    value === "defrost_recommended" ||
    value === "defrost_required" ||
    value === "error"
    ? value
    : "error";
}

function isStandardMode(input: unknown): input is UnknownRecord {
  const record = asRecord(input);
  return !!record && asRecord(record.coupled_result) !== null;
}

function isProgressiveMode(input: unknown): input is UnknownRecord {
  const record = asRecord(input);
  return !!record && Array.isArray(record.rolls);
}

function normalizeStandard(input: UnknownRecord): UnifiedOperationalOutput {
  const w: string[] = [];
  const coupledResult = asRecord(input.coupled_result);
  const frostResult = asRecord(input.frost_result);
  const defrostResult = asRecord(input.defrost_result);

  const initial = safeNumber(coupledResult?.capacity_w, "coupled_result.capacity_w", w);
  const effective = safeNumber(input.effective_capacity_w, "effective_capacity_w", w);
  const lossP = safeNumber(input.capacity_loss_pct, "capacity_loss_pct", w);
  const avail = safeNumber(input.operational_availability_pct, "operational_availability_pct", w);
  const useful = safeNumber(input.useful_operation_time_h, "useful_operation_time_h", w);
  const opTime = safeNumber(input.operation_time_h, "operation_time_h", w);
  const defrostMin = safeNumber(input.defrost_time_min, "defrost_time_min", w);

  const adapterWarnings: string[] = [];
  if (lossP > 20) adapterWarnings.push("Perda de capacidade por gelo acima de 20%.");
  if (effective <= 0) adapterWarnings.push("Capacidade efetiva zero ou negativa.");
  if (avail < 90) adapterWarnings.push("Disponibilidade operacional abaixo de 90%.");

  const warnings = Array.from(
    new Set([...getStringArray(input.warnings), ...w, ...adapterWarnings]),
  );
  const cycleStatus = getCycleStatus(input.cycle_status);

  return {
    mode: "standard",
    initial_capacity_w: initial,
    effective_capacity_w: effective,
    capacity_loss_pct: lossP,
    operational_availability_pct: avail,
    useful_operation_time_h: useful,
    operation_time_h: opTime,
    frost: {
      frost_detected:
        safeNumber(frostResult?.frost_mass_kg ?? 0, "frost_result.frost_mass_kg", w) > 0,
      recommended_defrost: input.recommended_defrost === true,
      capacity_loss_pct: lossP,
    },
    defrost: {
      defrost_required: cycleStatus === "defrost_required",
      defrost_time_min: defrostMin,
      defrost_feasible: defrostResult?.defrost_time_feasible !== false,
    },
    estimated_time_to_defrost_h: null,
    progressive: undefined,
    cycle_status: cycleStatus,
    warnings,
    status: getOutputStatus(input.status),
  };
}

function normalizeProgressive(input: UnknownRecord): UnifiedOperationalOutput {
  const w: string[] = [];

  const rolls = Array.isArray(input.rolls) ? input.rolls.map((roll) => asRecord(roll) ?? {}) : [];
  const initial = safeNumber(input.total_capacity_w, "total_capacity_w", w);
  const lossP = 0;
  const effective = initial;
  const opTime = 0;
  const useful = 0;
  const avail = 100;

  const totalDP = safeNumber(input.total_air_pressure_drop_pa, "total_air_pressure_drop_pa", w);
  const energyErr = safeNumber(input.energy_balance_error_pct, "energy_balance_error_pct", w);

  const rollFrost = rolls.map((r) =>
    safeNumber(r.frost_thickness_mm, "roll.frost_thickness_mm", w),
  );
  const maxFrostIdx = rollFrost.reduce(
    (best: number, val: number, idx: number) => (val > (rollFrost[best] ?? 0) ? idx : best),
    0,
  );
  const maxFrostMm = rollFrost[maxFrostIdx] ?? 0;
  const frostDetected = maxFrostMm > 0;

  const estDefrost =
    input.estimated_time_to_defrost_h !== undefined
      ? input.estimated_time_to_defrost_h === null
        ? null
        : safeNumber(input.estimated_time_to_defrost_h, "estimated_time_to_defrost_h", w)
      : null;

  const adapterWarnings: string[] = [];
  if (totalDP > 80)
    adapterWarnings.push(
      "Perda de carga total acima de 80 Pa. Verificar capacidade do ventilador.",
    );
  if (energyErr > 5)
    adapterWarnings.push("Erro de balanço energético acima de 5%. Verificar condições de entrada.");
  if (effective <= 0) adapterWarnings.push("Capacidade efetiva zero ou negativa.");

  const warnings = Array.from(
    new Set([...getStringArray(input.warnings), ...w, ...adapterWarnings]),
  );

  const inputStatus = getOutputStatus(input.status);
  const status = warnings.length > 0 && inputStatus === "ok" ? "warning" : inputStatus;

  return {
    mode: "progressive",
    initial_capacity_w: initial,
    effective_capacity_w: effective,
    capacity_loss_pct: lossP,
    operational_availability_pct: avail,
    useful_operation_time_h: useful,
    operation_time_h: opTime,
    frost: {
      frost_detected: frostDetected,
      recommended_defrost: false,
      capacity_loss_pct: lossP,
      critical_frost_thickness_mm: maxFrostMm,
      critical_roll_index: maxFrostIdx,
    },
    defrost: {
      defrost_required: false,
      defrost_time_min: 0,
      defrost_feasible: true,
    },
    estimated_time_to_defrost_h: estDefrost,
    progressive: {
      roll_count: rolls.length,
      total_pressure_drop_pa: totalDP,
      energy_balance_error_pct: energyErr,
      critical_roll_index: maxFrostIdx,
      critical_frost_thickness_mm: maxFrostMm,
      roll_capacity_w: rolls.map((r) => safeNumber(r.capacity_w, "roll.capacity_w", w)),
      roll_frost_thickness_mm: rollFrost,
    },
    cycle_status: inputStatus === "error" ? "error" : "normal",
    warnings,
    status,
  };
}

export function normalizeOperationalOutput(input: unknown): UnifiedOperationalOutput {
  if (isStandardMode(input)) {
    return normalizeStandard(input);
  }

  if (isProgressiveMode(input)) {
    return normalizeProgressive(input);
  }

  return {
    mode: "standard",
    initial_capacity_w: 0,
    effective_capacity_w: 0,
    capacity_loss_pct: 0,
    operational_availability_pct: 0,
    useful_operation_time_h: 0,
    operation_time_h: 0,
    frost: {
      frost_detected: false,
      recommended_defrost: false,
      capacity_loss_pct: 0,
    },
    defrost: {
      defrost_required: false,
      defrost_time_min: 0,
      defrost_feasible: true,
    },
    estimated_time_to_defrost_h: null,
    progressive: undefined,
    cycle_status: "error",
    warnings: ["normalizeOperationalOutput: input shape not recognized."],
    status: "error",
  };
}
