import type { SavedProject } from "../store/useProjectStore";
import {
  bottleneckLabel,
  fmtBR,
  getProjectMetrics,
  highlightBestWorst,
  type HighlightKind,
  type MetricDirection,
} from "../utils/projectComparison";

interface ComparisonTableProps {
  projects: SavedProject[];
}

interface RowDef {
  label: string;
  direction: MetricDirection;
  value: (project: SavedProject) => number | string | null;
  format?: (value: number) => string;
}

const rows: RowDef[] = [
  { label: "Tipo", direction: "neutral", value: (p) => getProjectMetrics(p).typeLabel },
  { label: "Carga Térmica", direction: "neutral", value: (p) => getProjectMetrics(p).loadW, format: (v) => `${fmtBR(v, 0)} W` },
  { label: "Capacidade Real", direction: "neutral", value: (p) => getProjectMetrics(p).qRealW, format: (v) => `${fmtBR(v, 0)} W` },
  { label: "Te de Equilíbrio", direction: "neutral", value: (p) => getProjectMetrics(p).teC, format: (v) => `${fmtBR(v, 1)} °C` },
  { label: "Tc de Equilíbrio", direction: "lower_is_better", value: (p) => getProjectMetrics(p).tcC, format: (v) => `${fmtBR(v, 1)} °C` },
  { label: "COP Real", direction: "higher_is_better", value: (p) => getProjectMetrics(p).cop, format: (v) => fmtBR(v, 2) },
  { label: "Potência Compressor", direction: "lower_is_better", value: (p) => getProjectMetrics(p).wCompW, format: (v) => `${fmtBR(v, 0)} W` },
  { label: "EER", direction: "higher_is_better", value: (p) => getProjectMetrics(p).eer, format: (v) => `${fmtBR(v, 2)} BTU/Wh` },
  { label: "Gargalo", direction: "neutral", value: (p) => bottleneckLabel(getProjectMetrics(p).bottleneck) },
];

function cellClass(kind: HighlightKind) {
  if (kind === "best") return "bg-emerald-50 font-semibold text-emerald-800";
  if (kind === "worst") return "bg-red-50 font-semibold text-red-800";
  if (kind === "missing") return "text-slate-400";
  return "";
}

function formatValue(row: RowDef, value: number | string | null) {
  if (value === null) return "—";
  if (typeof value === "number") return row.format ? row.format(value) : fmtBR(value);
  return value;
}

export function ComparisonTable({ projects }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border-b p-3 text-left">Métrica</th>
            {projects.map((project) => (
              <th key={project.id} className="border-b p-3 text-left">
                {project.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = projects.map((project) => row.value(project));
            const numeric = values.map((value) => (typeof value === "number" ? value : null));
            const highlights = highlightBestWorst(numeric, row.direction);
            return (
              <tr key={row.label} className="border-b last:border-b-0">
                <td className="p-3 font-medium">{row.label}</td>
                {values.map((value, index) => (
                  <td key={`${row.label}-${projects[index].id}`} className={`p-3 ${cellClass(highlights[index])}`}>
                    {formatValue(row, value)}
                    {highlights[index] === "best" && " ✅"}
                    {highlights[index] === "worst" && " ⚠️"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
