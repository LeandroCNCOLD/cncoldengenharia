// Conversões e normalização de unidades para o catálogo técnico.
// Saída sempre em SI: °C, W, m³/h, Pa/kPa, kg/h, L, m².

export type TemperatureUnit = "C" | "F" | "K";
export type CapacityUnit = "W" | "kW" | "BTU/h" | "kcal/h" | "TR";
export type FlowUnit = "m3/h" | "m3/s" | "L/s" | "CFM";
export type PressureUnit = "Pa" | "kPa" | "bar" | "psi" | "mbar";
export type MassFlowUnit = "kg/h" | "kg/s" | "lb/h";

const BTU_H_TO_W = 0.29307107;
const KCAL_H_TO_W = 1.16222222;
const TR_TO_W = 3516.8528421;
const CFM_TO_M3H = 1.69901082;
const PSI_TO_PA = 6894.757293;
const LB_H_TO_KG_H = 0.45359237;

export function normalizeTemperature(value: number, unit: TemperatureUnit): number {
  switch (unit) {
    case "C":
      return value;
    case "F":
      return ((value - 32) * 5) / 9;
    case "K":
      return value - 273.15;
  }
}

export function normalizeCapacity(value: number, unit: CapacityUnit): number {
  switch (unit) {
    case "W":
      return value;
    case "kW":
      return value * 1000;
    case "BTU/h":
      return value * BTU_H_TO_W;
    case "kcal/h":
      return value * KCAL_H_TO_W;
    case "TR":
      return value * TR_TO_W;
  }
}

export function normalizeFlow(value: number, unit: FlowUnit): number {
  switch (unit) {
    case "m3/h":
      return value;
    case "m3/s":
      return value * 3600;
    case "L/s":
      return value * 3.6;
    case "CFM":
      return value * CFM_TO_M3H;
  }
}

export function normalizePressure(
  value: number,
  unit: PressureUnit,
  target: "Pa" | "kPa" = "Pa",
): number {
  let pa: number;
  switch (unit) {
    case "Pa":
      pa = value;
      break;
    case "kPa":
      pa = value * 1000;
      break;
    case "bar":
      pa = value * 100_000;
      break;
    case "mbar":
      pa = value * 100;
      break;
    case "psi":
      pa = value * PSI_TO_PA;
      break;
  }
  return target === "Pa" ? pa : pa / 1000;
}

export function normalizeMassFlow(value: number, unit: MassFlowUnit): number {
  switch (unit) {
    case "kg/h":
      return value;
    case "kg/s":
      return value * 3600;
    case "lb/h":
      return value * LB_H_TO_KG_H;
  }
}

/** Detecta unidade de capacidade a partir de string livre (heurística simples). */
export function detectCapacityUnit(text: string): CapacityUnit {
  const t = text.toLowerCase();
  if (t.includes("btu")) return "BTU/h";
  if (t.includes("kcal")) return "kcal/h";
  if (t.includes("tr") || t.includes("ton")) return "TR";
  if (t.includes("kw")) return "kW";
  return "W";
}

export function detectTemperatureUnit(text: string): TemperatureUnit {
  const t = text.toLowerCase();
  if (t.includes("°f") || t.includes(" f") || t.endsWith("f")) return "F";
  if (t.includes("k")) return "K";
  return "C";
}
