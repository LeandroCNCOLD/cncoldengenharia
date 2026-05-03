// Conversões de unidades — replica o comportamento dos dropdowns do UNILAB.
// Cada grupo expõe a unidade canônica (SI) usada internamente pelo motor
// e funções toCanonical(value, unit) e fromCanonical(valueSI, unit).

export type UnitOption<U extends string> = { id: U; label: string };

// ---------- CAPACIDADE (canonical: W) ----------
export type CapacityUnit = "W" | "kW" | "kcal_h" | "TR" | "BTU_h";
export const CAPACITY_UNITS: UnitOption<CapacityUnit>[] = [
  { id: "W", label: "W" },
  { id: "kW", label: "kW" },
  { id: "kcal_h", label: "kcal/h" },
  { id: "TR", label: "TR" },
  { id: "BTU_h", label: "BTU/h" },
];
const CAP_TO_W: Record<CapacityUnit, number> = {
  W: 1,
  kW: 1000,
  kcal_h: 1.163, // 1 kcal/h = 1.163 W
  TR: 3516.8528, // 1 TR ≈ 3516.85 W
  BTU_h: 0.29307107, // 1 BTU/h ≈ 0.293 W
};

// ---------- VAZÃO VOLUMÉTRICA AR (canonical: m³/h) ----------
export type AirFlowUnit = "m3_h" | "m3_s" | "CFM" | "L_s";
export const AIRFLOW_UNITS: UnitOption<AirFlowUnit>[] = [
  { id: "m3_h", label: "m³/h" },
  { id: "m3_s", label: "m³/s" },
  { id: "CFM", label: "CFM" },
  { id: "L_s", label: "L/s" },
];
const AIRFLOW_TO_M3H: Record<AirFlowUnit, number> = {
  m3_h: 1,
  m3_s: 3600,
  CFM: 1.69901082, // 1 CFM = 1.699 m³/h
  L_s: 3.6,
};

// ---------- TEMPERATURA (canonical: °C) ----------
export type TempUnit = "C" | "F" | "K";
export const TEMP_UNITS: UnitOption<TempUnit>[] = [
  { id: "C", label: "°C" },
  { id: "F", label: "°F" },
  { id: "K", label: "K" },
];

// ---------- DIFERENÇA DE TEMPERATURA (canonical: K) ----------
export type DeltaTUnit = "K" | "C" | "F";
export const DELTA_T_UNITS: UnitOption<DeltaTUnit>[] = [
  { id: "K", label: "K" },
  { id: "C", label: "°C" },
  { id: "F", label: "°F" },
];

// ---------- VAZÃO MÁSSICA (canonical: kg/h) ----------
export type MassFlowUnit = "kg_h" | "kg_s" | "lb_h" | "g_s";
export const MASS_FLOW_UNITS: UnitOption<MassFlowUnit>[] = [
  { id: "kg_h", label: "kg/h" },
  { id: "kg_s", label: "kg/s" },
  { id: "lb_h", label: "lb/h" },
  { id: "g_s", label: "g/s" },
];
const MASSFLOW_TO_KGH: Record<MassFlowUnit, number> = {
  kg_h: 1,
  kg_s: 3600,
  lb_h: 0.45359237,
  g_s: 3.6,
};

// ---------- PRESSÃO (canonical: Pa) ----------
export type PressureUnit = "Pa" | "kPa" | "bar" | "psi" | "mmH2O" | "mmHg";
export const PRESSURE_UNITS: UnitOption<PressureUnit>[] = [
  { id: "Pa", label: "Pa" },
  { id: "kPa", label: "kPa" },
  { id: "bar", label: "bar" },
  { id: "psi", label: "psi" },
  { id: "mmH2O", label: "mmH₂O" },
  { id: "mmHg", label: "mmHg" },
];
const PRESSURE_TO_PA: Record<PressureUnit, number> = {
  Pa: 1,
  kPa: 1000,
  bar: 100_000,
  psi: 6894.757,
  mmH2O: 9.80665,
  mmHg: 133.322,
};

// ---------- VELOCIDADE (canonical: m/s) ----------
export type VelocityUnit = "m_s" | "ft_min" | "km_h";
export const VELOCITY_UNITS: UnitOption<VelocityUnit>[] = [
  { id: "m_s", label: "m/s" },
  { id: "ft_min", label: "ft/min" },
  { id: "km_h", label: "km/h" },
];
const VELOCITY_TO_MS: Record<VelocityUnit, number> = {
  m_s: 1,
  ft_min: 0.00508,
  km_h: 1 / 3.6,
};

// ---------- helpers ----------
function linear<U extends string>(map: Record<U, number>) {
  return {
    toCanonical: (value: number, unit: U): number => value * map[unit],
    fromCanonical: (valueSI: number, unit: U): number => valueSI / map[unit],
  };
}

export const capacityConv = linear(CAP_TO_W);
export const airFlowConv = linear(AIRFLOW_TO_M3H);
export const massFlowConv = linear(MASSFLOW_TO_KGH);
export const pressureConv = linear(PRESSURE_TO_PA);
export const velocityConv = linear(VELOCITY_TO_MS);

export const tempConv = {
  toCanonical: (value: number, unit: TempUnit): number => {
    if (unit === "C") return value;
    if (unit === "F") return ((value - 32) * 5) / 9;
    return value - 273.15; // K
  },
  fromCanonical: (valueC: number, unit: TempUnit): number => {
    if (unit === "C") return valueC;
    if (unit === "F") return (valueC * 9) / 5 + 32;
    return valueC + 273.15;
  },
};

// ΔT: K e °C são equivalentes em magnitude; °F = K * 9/5
export const deltaTConv = {
  toCanonical: (value: number, unit: DeltaTUnit): number => {
    if (unit === "F") return (value * 5) / 9;
    return value; // K e C são equivalentes em delta
  },
  fromCanonical: (valueK: number, unit: DeltaTUnit): number => {
    if (unit === "F") return (valueK * 9) / 5;
    return valueK;
  },
};
