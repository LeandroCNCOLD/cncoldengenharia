import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "../constants/chartColors";
import type {
  SystemCondenserEnvelopePoint,
  SystemEquilibriumResult,
  SystemEvaporatorEnvelopePoint,
} from "../hooks/useSystemEquilibrium";
import type { CompressorEnvelopePoint } from "../store/useCoilEnvelopeStore";

interface SystemEquilibriumChartProps {
  evaporatorEnvelope: SystemEvaporatorEnvelopePoint[];
  compressorEnvelope: CompressorEnvelopePoint[];
  result: SystemEquilibriumResult;
  nominalTc_C: number;
}

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

function compressorSlice(
  envelope: CompressorEnvelopePoint[],
  targetTc: number,
): Array<{ Te_C: number; Q_comp_kW: number }> {
  const availableTc = Array.from(new Set(envelope.map((point) => point.Tc_C))).sort((a, b) => a - b);
  const nearestTc =
    availableTc.reduce(
      (best, current) =>
        Math.abs(current - targetTc) < Math.abs(best - targetTc) ? current : best,
      availableTc[0] ?? targetTc,
    );
  return envelope
    .filter((point) => point.Tc_C === nearestTc)
    .sort((a, b) => a.Te_C - b.Te_C)
    .map((point) => ({ Te_C: point.Te_C, Q_comp_kW: point.Q_W / 1000 }));
}

export function SystemEquilibriumChart({
  evaporatorEnvelope,
  compressorEnvelope,
  result,
  nominalTc_C,
}: SystemEquilibriumChartProps) {
  const evapData = evaporatorEnvelope
    .slice()
    .sort((a, b) => a.Te_C - b.Te_C)
    .map((point) => ({
      Te_C: point.Te_C,
      Q_evap_kW: point.Q_W / 1000,
    }));
  const compData = compressorSlice(compressorEnvelope, result.Tc_eq_C || nominalTc_C);
  const combined = evapData.map((evap) => ({
    ...evap,
    Q_comp_kW:
      compData.find((point) => point.Te_C === evap.Te_C)?.Q_comp_kW ?? null,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gráfico Q × Te</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combined}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="Te_C"
                  label={{ value: "Te (°C)", position: "insideBottom", offset: -5 }}
                />
                <YAxis
                  label={{ value: "Q (kW)", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    typeof value === "number" ? `${fmt(value)} kW` : "—",
                    name === "Q_evap_kW"
                      ? "Evaporador"
                      : `Compressor (Tc = ${fmt(result.Tc_eq_C, 1)} °C)`,
                  ]}
                  labelFormatter={(label) => `Te ${fmt(Number(label), 1)} °C`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Q_evap_kW"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  name="Evaporador"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Q_comp_kW"
                  stroke={CHART_COLORS.accent}
                  strokeWidth={2}
                  name={`Compressor (Tc = ${fmt(result.Tc_eq_C, 1)} °C)`}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <ReferenceDot
                  x={result.Te_eq_C}
                  y={result.Q_evap_W / 1000}
                  r={6}
                  fill={CHART_COLORS.danger}
                  stroke={CHART_COLORS.danger}
                  label="Equilíbrio"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {result.convergencePath.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trajetória de Convergência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.convergencePath}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" />
                  <YAxis label={{ value: "Resíduo (°C)", angle: -90, position: "insideLeft" }} />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === "number" ? `${fmt(value)} °C` : "—",
                      "Resíduo",
                    ]}
                    labelFormatter={(label) => `Iteração ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="residual"
                    stroke={CHART_COLORS.success}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
