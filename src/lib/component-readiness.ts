// CN Cold Engineering — Lógica de prontidão e detecção de conflitos.
import {
  COMPONENT_FIELDS,
  type ComponentType,
} from "@/lib/component-schema";

export interface FieldConflict {
  key: string;
  values: { source: string; value: unknown }[];
}

export interface ReadinessReport {
  ready: boolean;
  missingRequired: string[];
  filledRequired: number;
  totalRequired: number;
  conflicts: FieldConflict[];
  blockReasons: string[];
}

export function computeReadiness(
  type: ComponentType,
  fields: Record<string, unknown>,
  conflicts: FieldConflict[],
): ReadinessReport {
  const required = COMPONENT_FIELDS[type].filter((f) => f.required);
  const missing = required
    .filter((f) => {
      const v = fields[f.key];
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    })
    .map((f) => f.key);

  const blockReasons: string[] = [];
  if (missing.length > 0) {
    blockReasons.push(`${missing.length} campo(s) obrigatório(s) ausente(s)`);
  }
  if (conflicts.length > 0) {
    blockReasons.push(`${conflicts.length} conflito(s) entre arquivos`);
  }

  return {
    ready: missing.length === 0 && conflicts.length === 0,
    missingRequired: missing,
    filledRequired: required.length - missing.length,
    totalRequired: required.length,
    conflicts,
    blockReasons,
  };
}

/** Compara dois valores normalizando números e strings. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-6;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => valuesEqual(x, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
