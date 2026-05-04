import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompressorEnvelopePoint } from "../hooks/useCompressorEnvelopeGenerator";
import { CHART_COLORS } from "../constants/chartColors";

interface CompressorEnvelopeChartProps {
  points: CompressorEnvelopePoint[];
  nominalTe_C: number;
  nominalTc_C: number;
  voltage_V?: number;
}

const COLORS: Record<number, string> = {
  35: CHART_COLORS.tc35,
  40: CHART_COLORS.tc40,
  45: CHART_COLORS.tc45,
  50: CHART_COLORS.tc50,
  55: CHART_COLORS.tc55,
};

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

function buildSeries(points: CompressorEnvelopePoint[], valueKey: "Q_W" | "W_W") {
  const byTe = new Map<number, Record<string, number>>();
  for (const point of points) {
    const row = byTe.get(point.Te_C) ?? { Te_C: point.Te_C };
    row[`Tc_${point.Tc_C}`] = point[valueKey] / 1000;
    byTe.set(point.Te_C, row);
  }
  return Array.from(byTe.values()).sort((a, b) => a.Te_C - b.Te_C);
}

function tcs(points: CompressorEnvelopePoint[]) {
  return Array.from(new Set(points.map((point) => point.Tc_C))).sort((a, b) => a - b);
}

export function CompressorEnvelopeChart({
  points,
  nominalTe_C,
  nominalTc_C,
  voltage_V = 380,
}: CompressorEnvelopeChartProps) {
  const tcValues = tcs(points);
  const capacityData = buildSeries(points, "Q_W");
  const powerData = buildSeries(points, "W_W");
  const currentFactor = voltage_V * Math.sqrt(3) * 0.85;

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Gere o envelope para visualizar as curvas do compressor.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={capacityData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="Te_C"
              label={{ value: "Te (°C)", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              label={{ value: "Q (kW)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${fmt(value)} kW`,
                String(name).replace("Tc_", "Tc = ") + "°C",
              ]}
              labelFormatter={(label) => `Te ${fmt(Number(label), 1)} °C`}
            />
            <Legend formatter={(value) => String(value).replace("Tc_", "Tc = ") + "°C"} />
            {tcValues.map((tc) => (
              <Line
                key={tc}
                type="monotone"
                dataKey={`Tc_${tc}`}
                stroke={COLORS[tc] ?? CHART_COLORS.axis}
                strokeWidth={tc === nominalTc_C ? 3 : 2}
                dot={(props) => {
                  const isNominal =
                    Number(props.payload?.Te_C) === nominalTe_C && tc === nominalTc_C;
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={isNominal ? 6 : 3}
                      fill={COLORS[tc] ?? CHART_COLORS.axis}
                      stroke={isNominal ? CHART_COLORS.danger : "none"}
                      strokeWidth={isNominal ? 2 : 0}
                    />
                  );
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={powerData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="Te_C"
              label={{ value: "Te (°C)", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              label={{ value: "W (kW)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const currentA = currentFactor > 0 ? (value * 1000) / currentFactor : 0;
                return [
                  `${fmt(value)} kW · ${fmt(currentA)} A`,
                  String(name).replace("Tc_", "Tc = ") + "°C",
                ];
              }}
              labelFormatter={(label) => `Te ${fmt(Number(label), 1)} °C`}
            />
            <Legend formatter={(value) => String(value).replace("Tc_", "Tc = ") + "°C"} />
            {tcValues.map((tc) => (
              <Line
                key={tc}
                type="monotone"
                dataKey={`Tc_${tc}`}
                stroke={COLORS[tc] ?? CHART_COLORS.axis}
                strokeWidth={tc === nominalTc_C ? 3 : 2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
