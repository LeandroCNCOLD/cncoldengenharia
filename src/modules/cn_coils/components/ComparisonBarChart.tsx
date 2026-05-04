import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "../constants/chartColors";
import type { SavedProject } from "../store/useProjectStore";
import { fmtBR, getProjectMetrics } from "../utils/projectComparison";

interface ComparisonBarChartProps {
  projects: SavedProject[];
}

export function ComparisonBarChart({ projects }: ComparisonBarChartProps) {
  const data = projects.map((project) => {
    const metrics = getProjectMetrics(project);
    return {
      name: project.name,
      COP: metrics.cop ?? 0,
      "EER/3.412": metrics.eer ? metrics.eer / 3.412 : 0,
      Q_real_kW: metrics.qRealW ? metrics.qRealW / 1000 : 0,
      W_comp_kW: metrics.wCompW ? metrics.wCompW / 1000 : 0,
      Te_eq: metrics.teC ?? 0,
      Tc_eq: metrics.tcC ?? 0,
      raw: metrics,
    };
  });

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <MetricChart title="COP e EER normalizado" data={data}>
        <Bar dataKey="COP" fill={CHART_COLORS.primary} />
        <Bar dataKey="EER/3.412" fill={CHART_COLORS.success} />
      </MetricChart>
      <MetricChart title="Capacidade vs Potência (kW)" data={data}>
        <Bar dataKey="Q_real_kW" fill={CHART_COLORS.primary} name="Q real" />
        <Bar dataKey="W_comp_kW" fill={CHART_COLORS.accent} name="W comp" />
      </MetricChart>
      <MetricChart title="Temperaturas de equilíbrio" data={data} includeZero>
        <Bar dataKey="Te_eq" fill={CHART_COLORS.secondary} name="Te eq" />
        <Bar dataKey="Tc_eq" fill={CHART_COLORS.danger} name="Tc eq" />
      </MetricChart>
    </div>
  );
}

function MetricChart({
  title,
  data,
  children,
  includeZero = false,
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  children: React.ReactNode;
  includeZero?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} />
            <YAxis />
            {includeZero && <ReferenceLine y={0} stroke={CHART_COLORS.axis} />}
            <Tooltip formatter={(value) => fmtBR(Number(value))} />
            <Legend />
            {children}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
