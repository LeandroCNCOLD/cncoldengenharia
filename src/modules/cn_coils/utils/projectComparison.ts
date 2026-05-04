import type { SavedProject, SavedProjectType } from "../store/useProjectStore";

export type HighlightKind = "best" | "worst" | "neutral" | "missing";
export type MetricDirection = "higher_is_better" | "lower_is_better" | "neutral";

export interface ComparisonMetrics {
  typeLabel: string;
  loadW: number | null;
  qRealW: number | null;
  teC: number | null;
  tcC: number | null;
  cop: number | null;
  wCompW: number | null;
  eer: number | null;
  bottleneck: string | null;
}

export const projectTypeLabels: Record<SavedProjectType, string> = {
  cold_room: "Câmara Fria",
  dx_complete: "DX Completo",
  heat_pump: "Bomba de Calor",
  component_workspace: "Workspace",
};

export function fmtBR(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits });
}

function loadTotal(snapshot: SavedProject["snapshot"]): number | null {
  const load = snapshot.loadResult;
  if (!load) return null;
  const qTotal = load.Q_total_W;
  if (typeof qTotal === "number") return qTotal;
  const qHeating = load.Q_heating_W;
  const qCooling = load.Q_cooling_W;
  if (typeof qHeating === "number" || typeof qCooling === "number") {
    return Math.max(
      typeof qHeating === "number" ? qHeating : 0,
      typeof qCooling === "number" ? qCooling : 0,
    );
  }
  return null;
}

export function bottleneckLabel(value: string | null): string {
  switch (value) {
    case "evaporator":
      return "Evaporador";
    case "condenser":
      return "Condensador";
    case "compressor":
      return "Compressor";
    case "balanced":
      return "Balanceado";
    default:
      return "—";
  }
}

export function getProjectMetrics(project: SavedProject): ComparisonMetrics {
  const eq = project.snapshot.equilibriumResult;
  return {
    typeLabel: projectTypeLabels[project.type],
    loadW: loadTotal(project.snapshot),
    qRealW: eq?.Q_evap_W ?? null,
    teC: eq?.Te_eq_C ?? null,
    tcC: eq?.Tc_eq_C ?? null,
    cop: eq?.COP_real ?? null,
    wCompW: eq?.W_comp_W ?? null,
    eer: eq ? eq.COP_real * 3.412 : null,
    bottleneck: eq?.bottleneck ?? null,
  };
}

export function highlightBestWorst(
  values: Array<number | null>,
  metric: MetricDirection,
): HighlightKind[] {
  if (metric === "neutral") {
    return values.map((value) => (value === null ? "missing" : "neutral"));
  }
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (valid.length < 2) return values.map((value) => (value === null ? "missing" : "neutral"));

  const best = metric === "higher_is_better" ? Math.max(...valid) : Math.min(...valid);
  const worst = metric === "higher_is_better" ? Math.min(...valid) : Math.max(...valid);

  return values.map((value) => {
    if (value === null || !Number.isFinite(value)) return "missing";
    if (value === best) return "best";
    if (value === worst) return "worst";
    return "neutral";
  });
}

export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.round(((value - min) / (max - min)) * 100);
}
