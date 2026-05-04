import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ComponentUtilization } from "@/modules/coldpro_v2";
import { useTranslation } from "@/i18n/useTranslation";

interface UtilizationChartProps {
  utilization: ComponentUtilization;
}

function colorFor(value: number): string {
  if (value > 100) return "#dc2626";
  if (value > 90) return "#ca8a04";
  return "#1E6FD9";
}

export function UtilizationChart({ utilization }: UtilizationChartProps) {
  const { t } = useTranslation();
  const data: { name: string; value: number }[] = [
    { name: t("charts.compressor"), value: utilization.compressor_pct },
    { name: t("charts.evaporator"), value: utilization.evaporator_pct },
    { name: t("charts.condenser"), value: utilization.condenser_pct },
  ];
  if (utilization.evaporator_fan_pct !== undefined)
    data.push({ name: t("charts.evaporatorFan"), value: utilization.evaporator_fan_pct });
  if (utilization.condenser_fan_pct !== undefined)
    data.push({ name: t("charts.condenserFan"), value: utilization.condenser_fan_pct });
  if (utilization.expansion_valve_pct !== undefined)
    data.push({ name: t("charts.valve"), value: utilization.expansion_valve_pct });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 120]} />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, t("charts.utilization")]}
          contentStyle={{ fontSize: 12 }}
        />
        <ReferenceLine
          y={100}
          stroke="#dc2626"
          strokeDasharray="4 4"
          label={{ value: "100%", fontSize: 10 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor(d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
