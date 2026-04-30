/**
 * calibrateFromCatalogCurve
 * --------------------------------------------------------------
 * Compara o resultado de uma simulação (system / coil) com um ponto
 * da curva real do catálogo CN COLD e calcula:
 *   - erro absoluto e percentual por grandeza
 *   - fator de correção sugerido (ratio catálogo/simulado)
 *
 * NÃO faz cálculo termodinâmico aqui. O caller fornece o resultado
 * simulado (vindo do thermalcalcAdapter) e o ponto de referência.
 *
 * Convenção dos campos numéricos da curva (best-effort, suporta variações):
 *   capacidade total ............ q_total | capacity_w | qtot_w | capacity
 *   potência consumida .......... power_w | potencia_w | input_power
 *   vazão de refrigerante ....... mass_flow_kgh | massflow | mfr_kgh
 *   pressão sucção .............. p_evap_bar | suction_bar
 *   pressão descarga ............ p_cond_bar | discharge_bar
 */
import type { CatalogCurve, CatalogCurvePoint } from "./catalog-curves";

export interface SimulatedSnapshot {
  capacity_w?: number | null;
  power_w?: number | null;
  mass_flow_kgh?: number | null;
  p_evap_bar?: number | null;
  p_cond_bar?: number | null;
}

export interface MetricComparison {
  key: string;
  label: string;
  catalog: number | null;
  simulated: number | null;
  errorAbs: number | null;
  errorPct: number | null;
  /** fator multiplicativo a aplicar no resultado simulado para casar com catálogo */
  correctionFactor: number | null;
}

export interface CalibrationResult {
  point: CatalogCurvePoint;
  metrics: MetricComparison[];
  averageErrorPct: number | null;
  divergent: boolean;
  factors: {
    capacityCorrectionFactor: number;
    powerCorrectionFactor: number;
    massFlowCorrectionFactor: number;
  };
  warnings: string[];
}

const METRICS: Array<{ key: keyof SimulatedSnapshot; label: string; aliases: string[] }> = [
  {
    key: "capacity_w",
    label: "Capacidade (W)",
    aliases: ["q_total", "capacity_w", "qtot_w", "capacity", "capacidade_w", "q_w"],
  },
  {
    key: "power_w",
    label: "Potência (W)",
    aliases: ["power_w", "potencia_w", "input_power", "p_w", "consumo_w"],
  },
  {
    key: "mass_flow_kgh",
    label: "Vazão (kg/h)",
    aliases: ["mass_flow_kgh", "massflow", "mfr_kgh", "vazao_kgh"],
  },
  {
    key: "p_evap_bar",
    label: "P. evap (bar)",
    aliases: ["p_evap_bar", "suction_bar", "psuc_bar", "p_suc"],
  },
  {
    key: "p_cond_bar",
    label: "P. cond (bar)",
    aliases: ["p_cond_bar", "discharge_bar", "pdis_bar", "p_dis"],
  },
];

function readPointValue(point: CatalogCurvePoint, aliases: string[]): number | null {
  for (const alias of aliases) {
    const v = point[alias];
    if (v == null) continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function safeRatio(catalog: number | null, simulated: number | null): number | null {
  if (catalog == null || simulated == null || simulated === 0) return null;
  return catalog / simulated;
}

/**
 * Função principal — compara um snapshot simulado com 1 ponto da curva.
 */
export function calibrateFromCatalogCurve(
  simulated: SimulatedSnapshot,
  point: CatalogCurvePoint,
  options?: { divergenceThresholdPct?: number },
): CalibrationResult {
  const threshold = options?.divergenceThresholdPct ?? 10;
  const warnings: string[] = [];

  const metrics: MetricComparison[] = METRICS.map((m) => {
    const catalog = readPointValue(point, m.aliases);
    const sim = simulated[m.key] ?? null;
    const errorAbs = catalog != null && sim != null ? sim - catalog : null;
    const errorPct =
      catalog != null && sim != null && catalog !== 0
        ? ((sim - catalog) / catalog) * 100
        : null;
    const correctionFactor = safeRatio(catalog, sim);
    return {
      key: m.key,
      label: m.label,
      catalog,
      simulated: sim,
      errorAbs,
      errorPct,
      correctionFactor,
    };
  });

  const validErrors = metrics
    .map((m) => (m.errorPct != null ? Math.abs(m.errorPct) : null))
    .filter((v): v is number => v != null);

  const averageErrorPct =
    validErrors.length > 0
      ? validErrors.reduce((a, b) => a + b, 0) / validErrors.length
      : null;

  const divergent = averageErrorPct != null && averageErrorPct > threshold;
  if (divergent) warnings.push(`Modelo divergente do catálogo (${averageErrorPct!.toFixed(1)}%)`);

  if (validErrors.length === 0) {
    warnings.push("Curva não contém grandezas comparáveis com a simulação.");
  }

  return {
    point,
    metrics,
    averageErrorPct,
    divergent,
    factors: {
      capacityCorrectionFactor:
        metrics.find((m) => m.key === "capacity_w")?.correctionFactor ?? 1,
      powerCorrectionFactor:
        metrics.find((m) => m.key === "power_w")?.correctionFactor ?? 1,
      massFlowCorrectionFactor:
        metrics.find((m) => m.key === "mass_flow_kgh")?.correctionFactor ?? 1,
    },
    warnings,
  };
}

/**
 * Helper: extrai uma lista plana de pontos de uma curva.
 * Aceita curva_json em formatos: array de objetos, objeto com `points`, ou objeto único.
 */
export function extractPointsFromCurve(curve: CatalogCurve): CatalogCurvePoint[] {
  const raw = curve.curva_json as unknown;
  if (Array.isArray(raw)) return raw as CatalogCurvePoint[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.points)) return obj.points as CatalogCurvePoint[];
    if (Array.isArray(obj.pontos)) return obj.pontos as CatalogCurvePoint[];
    if (Array.isArray(obj.data)) return obj.data as CatalogCurvePoint[];
    return [obj as CatalogCurvePoint];
  }
  return [];
}
