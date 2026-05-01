import { normalizeFieldName } from "./fieldNormalizer";

const KCALH_PER_KW = 859.845;
const KCALH_PER_TR = 3024;
const KCALH_PER_BTUH = 0.252;
const W_PER_KW = 1000;

function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\s+/g, "");
  if (u === "w" || u === "watt" || u === "watts") return "W";
  if (u === "kw") return "kW";
  if (u === "kcal/h" || u === "kcalh" || u === "kcal_h") return "kcal/h";
  if (u === "btu/h" || u === "btuh" || u === "btu_h") return "BTU/h";
  if (u === "tr" || u === "tonrefrigeration" || u === "ton refrigeration") return "TR";
  return unit;
}

export function toWatts(value: number, unit: string): number {
  const u = normalizeUnit(unit);
  switch (u) {
    case "W":
      return value;
    case "kW":
      return value * W_PER_KW;
    case "kcal/h":
      return (value / KCALH_PER_KW) * W_PER_KW;
    case "BTU/h":
      return ((value * KCALH_PER_BTUH) / KCALH_PER_KW) * W_PER_KW;
    case "TR":
      return ((value * KCALH_PER_TR) / KCALH_PER_KW) * W_PER_KW;
    default:
      return value;
  }
}

export function fromWatts(valueW: number, unit: string): number {
  const u = normalizeUnit(unit);
  switch (u) {
    case "W":
      return valueW;
    case "kW":
      return valueW / W_PER_KW;
    case "kcal/h":
      return (valueW / W_PER_KW) * KCALH_PER_KW;
    case "BTU/h":
      return ((valueW / W_PER_KW) * KCALH_PER_KW) / KCALH_PER_BTUH;
    case "TR":
      return ((valueW / W_PER_KW) * KCALH_PER_KW) / KCALH_PER_TR;
    default:
      return valueW;
  }
}

export function formatCapacity(
  valueW: number,
  unit: "kcal/h" | "kW" | "BTU/h" | "TR" | "W" = "kcal/h",
): string {
  const converted = fromWatts(valueW, unit);
  const decimals = unit === "TR" ? 2 : unit === "kW" ? 3 : 0;
  return `${converted.toFixed(decimals)} ${unit}`;
}

const UNIT_PATTERNS: { pattern: RegExp; unit: string }[] = [
  { pattern: /kcal[\s_/]*h/i, unit: "kcal/h" },
  { pattern: /btu[\s_/]*h/i, unit: "BTU/h" },
  { pattern: /\btr\b/i, unit: "TR" },
  { pattern: /ton[\s_]*refrigeration/i, unit: "TR" },
  { pattern: /\bkw\b/i, unit: "kW" },
  { pattern: /\bwatts?\b/i, unit: "W" },
  { pattern: /\b_w\b/, unit: "W" },
];

export function detectUnitFromFieldName(fieldName: string): string | null {
  const normalized = normalizeFieldName(fieldName);
  const original = fieldName.toLowerCase();

  for (const { pattern, unit } of UNIT_PATTERNS) {
    if (pattern.test(original) || pattern.test(normalized)) {
      return unit;
    }
  }

  if (normalized.endsWith("_w") && !normalized.endsWith("_kw")) return "W";
  if (normalized.endsWith("_kw")) return "kW";

  return null;
}
