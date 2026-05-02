import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ProductPerformancePoint } from "@/modules/coldpro_v2";
import { formatCapacity, formatCOP } from "../../utils/formatting";

export type PerformanceMetric = "capacity_w" | "cop" | "compressor_power_w";

interface PerformanceCurveChartProps {
  points: ProductPerformancePoint[];
  metric: PerformanceMetric;
}

const METRIC_LABELS: Record<PerformanceMetric, string> = {
  capacity_w: "Capacidade [W]",
  cop: "COP",
  compressor_power_w: "Potência [W]",
};

const COLORS = ["#1E6FD9", "#16a34a", "#ca8a04", "#7c3aed", "#dc2626", "#0891b2"];

interface TooltipPayloadItem {
  payload: { x: number; y: number; status: string };
}

export function PerformanceCurveChart({ points, metric }: PerformanceCurveChartProps) {
  const condTemps = [...new Set(points.map((p) => p.cond_temp_c))].sort((a, b) => a - b);

  const series = condTemps.map((cond) => ({
    name: `T_cond = ${cond}°C`,
    data: points
      .filter((p) => p.cond_temp_c === cond)
      .sort((a, b) => a.evap_temp_c - b.evap_temp_c)
      .map((p) => ({
        x: p.evap_temp_c,
        y: p[metric],
        status: p.status,
      })),
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          dataKey="x"
          name="T_evap"
          unit="°C"
          tick={{ fontSize: 11 }}
          label={{ value: "T_evap [°C]", position: "insideBottom", offset: -10, fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={METRIC_LABELS[metric]}
          tick={{ fontSize: 11 }}
          label={{ value: METRIC_LABELS[metric], angle: -90, position: "insideLeft", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0] as unknown as TooltipPayloadItem;
            const d = item.payload;
            return (
              <div className="rounded border border-slate-200 bg-white p-2 text-xs shadow">
                <div className="font-semibold text-slate-900">T_evap: {d.x}°C</div>
                <div className="text-slate-700">
                  {METRIC_LABELS[metric]}:{" "}
                  {metric === "cop" ? formatCOP(d.y) : formatCapacity(d.y)}
                </div>
                <div className="text-slate-500">Status: {d.status}</div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, i) => (
          <Scatter
            key={s.name}
            name={s.name}
            data={s.data}
            fill={COLORS[i % COLORS.length]}
            line={{ stroke: COLORS[i % COLORS.length], strokeWidth: 1.5 }}
            lineType="joint"
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
