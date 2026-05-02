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
import type { OperatingMapPoint } from "@/modules/coldpro_v2";
import { formatCapacity, formatCOP } from "../../utils/formatting";

interface OperatingMapChartProps {
  points: OperatingMapPoint[];
}

const STATUS_COLORS: Record<OperatingMapPoint["status"], string> = {
  approved: "#16a34a",
  warning: "#ca8a04",
  rejected: "#dc2626",
};

interface TooltipPayloadItem {
  payload: OperatingMapPoint & { x: number; y: number };
}

export function OperatingMapChart({ points }: OperatingMapChartProps) {
  const groups: Record<OperatingMapPoint["status"], (OperatingMapPoint & { x: number; y: number })[]> = {
    approved: [],
    warning: [],
    rejected: [],
  };
  for (const p of points) {
    groups[p.status].push({ ...p, x: p.evap_temp_c, y: p.cond_temp_c });
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
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
          name="T_cond"
          unit="°C"
          tick={{ fontSize: 11 }}
          label={{ value: "T_cond [°C]", angle: -90, position: "insideLeft", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0] as unknown as TooltipPayloadItem;
            const d = item.payload;
            return (
              <div className="rounded border border-slate-200 bg-white p-2 text-xs shadow">
                <div className="font-semibold text-slate-900">
                  T_evap {d.evap_temp_c}°C / T_cond {d.cond_temp_c}°C
                </div>
                <div className="text-slate-700">Capacidade: {formatCapacity(d.capacity_w)}</div>
                <div className="text-slate-700">COP: {formatCOP(d.cop)}</div>
                <div className="text-slate-500">Status: {d.status}</div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {(Object.keys(groups) as Array<keyof typeof groups>).map((status) => (
          <Scatter
            key={status}
            name={status}
            data={groups[status]}
            fill={STATUS_COLORS[status]}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
