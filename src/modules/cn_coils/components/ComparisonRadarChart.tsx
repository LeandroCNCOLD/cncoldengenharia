import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SavedProject } from "../store/useProjectStore";
import { getProjectMetrics, normalize } from "../utils/projectComparison";

interface ComparisonRadarChartProps {
  projects: SavedProject[];
}

const COLORS = ["#2563eb", "#16a34a", "#f97316", "#7c3aed"];

function normalizeMetric(values: number[], value: number, inverse = false) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const normalized = normalize(value, min, max);
  return inverse ? 100 - normalized : normalized;
}

export function ComparisonRadarChart({ projects }: ComparisonRadarChartProps) {
  const metrics = projects.map((project) => ({ project, metrics: getProjectMetrics(project) }));
  const cops = metrics.map((item) => item.metrics.cop ?? 0);
  const capacities = metrics.map((item) => item.metrics.qRealW ?? 0);
  const tes = metrics.map((item) => item.metrics.teC ?? 0);
  const tcs = metrics.map((item) => item.metrics.tcC ?? 0);

  const data = ["Eficiência", "Capacidade", "Temp. Evap.", "Temp. Cond.", "Balanço"].map((axis) => {
    const row: Record<string, string | number> = { axis };
    metrics.forEach(({ project, metrics: m }) => {
      const key = project.name;
      if (axis === "Eficiência") row[key] = m.cop == null ? 0 : normalizeMetric(cops, m.cop);
      if (axis === "Capacidade") row[key] = m.qRealW == null ? 0 : normalizeMetric(capacities, m.qRealW);
      if (axis === "Temp. Evap.") row[key] = m.teC == null ? 0 : normalizeMetric(tes, m.teC);
      if (axis === "Temp. Cond.") row[key] = m.tcC == null ? 0 : normalizeMetric(tcs, m.tcC, true);
      if (axis === "Balanço") row[key] = m.bottleneck === "balanced" ? 100 : m.bottleneck ? 60 : 30;
    });
    return row;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Radar de desempenho</CardTitle>
      </CardHeader>
      <CardContent className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" />
            <PolarRadiusAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            {projects.map((project, index) => (
              <Radar
                key={project.id}
                dataKey={project.name}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.12}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
