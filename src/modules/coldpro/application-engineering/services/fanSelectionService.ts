/**
 * fanSelectionService.ts
 *
 * Seleção de ventilador a partir de catálogo simplificado.
 * Ranqueia candidatos por adequação à vazão e pressão estática requeridas.
 */
import type {
  FanSelectionInput,
  FanSelectionResult,
  FanCandidate,
} from "../types/application-engineering.types";

// ─── Catálogo interno simplificado ───────────────────────────────────────────
// Baseado em ventiladores típicos de refrigeração industrial CN COLD

interface FanSpec {
  model: string;
  manufacturer: string;
  diameter_mm: number;
  /** Vazão nominal (m³/h) */
  airflow_nominal_m3h: number;
  /** Pressão estática nominal (Pa) */
  static_pressure_nominal_pa: number;
  /** Potência nominal (W) */
  power_nominal_w: number;
  /** Eficiência nominal (%) */
  efficiency_pct: number;
  /** Aplicações compatíveis */
  applications: Array<"evaporator" | "condenser">;
}

const FAN_CATALOG: FanSpec[] = [
  // Evaporadores — baixa pressão, alta vazão
  { model: "EBM-250-E", manufacturer: "EBM-Papst", diameter_mm: 250, airflow_nominal_m3h: 800, static_pressure_nominal_pa: 80, power_nominal_w: 120, efficiency_pct: 62, applications: ["evaporator"] },
  { model: "EBM-300-E", manufacturer: "EBM-Papst", diameter_mm: 300, airflow_nominal_m3h: 1400, static_pressure_nominal_pa: 100, power_nominal_w: 200, efficiency_pct: 65, applications: ["evaporator"] },
  { model: "EBM-350-E", manufacturer: "EBM-Papst", diameter_mm: 350, airflow_nominal_m3h: 2200, static_pressure_nominal_pa: 120, power_nominal_w: 320, efficiency_pct: 67, applications: ["evaporator"] },
  { model: "EBM-400-E", manufacturer: "EBM-Papst", diameter_mm: 400, airflow_nominal_m3h: 3200, static_pressure_nominal_pa: 140, power_nominal_w: 480, efficiency_pct: 68, applications: ["evaporator"] },
  { model: "EBM-450-E", manufacturer: "EBM-Papst", diameter_mm: 450, airflow_nominal_m3h: 4500, static_pressure_nominal_pa: 160, power_nominal_w: 680, efficiency_pct: 70, applications: ["evaporator"] },
  { model: "EBM-500-E", manufacturer: "EBM-Papst", diameter_mm: 500, airflow_nominal_m3h: 6000, static_pressure_nominal_pa: 180, power_nominal_w: 950, efficiency_pct: 71, applications: ["evaporator"] },
  // Condensadores — maior pressão estática
  { model: "EBM-300-C", manufacturer: "EBM-Papst", diameter_mm: 300, airflow_nominal_m3h: 1200, static_pressure_nominal_pa: 150, power_nominal_w: 220, efficiency_pct: 60, applications: ["condenser"] },
  { model: "EBM-350-C", manufacturer: "EBM-Papst", diameter_mm: 350, airflow_nominal_m3h: 2000, static_pressure_nominal_pa: 180, power_nominal_w: 360, efficiency_pct: 63, applications: ["condenser"] },
  { model: "EBM-400-C", manufacturer: "EBM-Papst", diameter_mm: 400, airflow_nominal_m3h: 3000, static_pressure_nominal_pa: 200, power_nominal_w: 550, efficiency_pct: 65, applications: ["condenser"] },
  { model: "EBM-450-C", manufacturer: "EBM-Papst", diameter_mm: 450, airflow_nominal_m3h: 4200, static_pressure_nominal_pa: 220, power_nominal_w: 780, efficiency_pct: 67, applications: ["condenser"] },
  { model: "EBM-500-C", manufacturer: "EBM-Papst", diameter_mm: 500, airflow_nominal_m3h: 5800, static_pressure_nominal_pa: 250, power_nominal_w: 1100, efficiency_pct: 68, applications: ["condenser"] },
  { model: "EBM-630-C", manufacturer: "EBM-Papst", diameter_mm: 630, airflow_nominal_m3h: 9000, static_pressure_nominal_pa: 280, power_nominal_w: 1800, efficiency_pct: 70, applications: ["condenser"] },
];

// ─── Lógica de seleção ────────────────────────────────────────────────────────

/**
 * Calcula pontuação de adequação (0–100) para um ventilador.
 * Penaliza excesso de capacidade e inadequação de pressão.
 */
function scoreFan(spec: FanSpec, input: FanSelectionInput): number {
  const airflowRatio = spec.airflow_nominal_m3h / input.airflow_m3h;
  const pressureRatio = spec.static_pressure_nominal_pa / input.static_pressure_pa;

  // Ventilador deve atender a vazão e pressão (com margem de 10%)
  if (airflowRatio < 0.9 || pressureRatio < 0.9) return 0;

  // Penalizar excesso excessivo (>50% acima do requerido)
  const airflowPenalty = Math.max(0, airflowRatio - 1.5) * 30;
  const pressurePenalty = Math.max(0, pressureRatio - 1.5) * 20;

  // Bônus por eficiência
  const efficiencyBonus = (spec.efficiency_pct - 60) * 0.5;

  // Penalizar diâmetro excessivo
  const diameterPenalty =
    input.max_diameter_mm && spec.diameter_mm > input.max_diameter_mm ? 100 : 0;

  const score = 100 - airflowPenalty - pressurePenalty + efficiencyBonus - diameterPenalty;
  return Math.max(0, Math.min(100, score));
}

export function selectFan(input: FanSelectionInput): FanSelectionResult {
  const warnings: string[] = [];

  const candidates: FanCandidate[] = FAN_CATALOG
    .filter((spec) => spec.applications.includes(input.application_type))
    .map((spec) => ({
      model: spec.model,
      manufacturer: spec.manufacturer,
      diameter_mm: spec.diameter_mm,
      airflow_m3h: spec.airflow_nominal_m3h,
      static_pressure_pa: spec.static_pressure_nominal_pa,
      power_w: spec.power_nominal_w,
      efficiency_pct: spec.efficiency_pct,
      score: scoreFan(spec, input),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    warnings.push(
      `Nenhum ventilador adequado encontrado para ${input.airflow_m3h} m³/h e ${input.static_pressure_pa} Pa.`,
    );
    return { recommended: null, candidates: [], warnings };
  }

  return {
    recommended: candidates[0],
    candidates: candidates.slice(0, 5),
    warnings,
  };
}
