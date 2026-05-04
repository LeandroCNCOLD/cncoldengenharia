import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCoilEnvelopeGenerator } from "../hooks/useCoilEnvelopeGenerator";
import type { EnvelopePoint } from "../store/useCoilEnvelopeStore";

interface CoilEnvelopeTabProps {
  equipmentId?: string;
}

const regimeBadge = (regime: EnvelopePoint["regime"]) => {
  if (regime === "frost") return <Badge variant="destructive">❄️ Gelo</Badge>;
  if (regime === "wet") return <Badge variant="secondary">💧 Úmido</Badge>;
  return <Badge variant="outline">🌬️ Seco</Badge>;
};

export function CoilEnvelopeTab({ equipmentId = "manual" }: CoilEnvelopeTabProps) {
  const { generateEnvelope, saveToStore, isGenerating, envelopePoints } =
    useCoilEnvelopeGenerator();
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    await generateEnvelope();
    setGenerated(true);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Envelope do Evaporador</h3>
          <p className="text-sm text-muted-foreground">
            Curva Q×Te — capacidade em função da temperatura de evaporação
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={isGenerating} variant="outline">
            {isGenerating ? "⏳ Gerando..." : "📊 Gerar Envelope"}
          </Button>
          {generated && envelopePoints.length > 0 && (
            <Button onClick={() => saveToStore(equipmentId)}>
              💾 Salvar para Bancada
            </Button>
          )}
        </div>
      </div>

      {envelopePoints.length > 0 && (
        <>
          <div className="h-64 w-full rounded-lg border bg-white p-2 text-slate-900">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={envelopePoints}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="Te"
                  label={{ value: "Te (°C)", position: "insideBottom", offset: -5 }}
                />
                <YAxis
                  yAxisId="left"
                  label={{ value: "Q (kcal/h)", angle: -90, position: "insideLeft" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{ value: "COP", angle: 90, position: "insideRight" }}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "Q_kcalh"
                      ? [`${value.toFixed(0)} kcal/h`, "Capacidade"]
                      : name === "COP"
                        ? [value.toFixed(2), "COP"]
                        : [value, name]
                  }
                />
                <Legend />
                <ReferenceLine
                  yAxisId="left"
                  x={envelopePoints[4]?.Te}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label="Nominal"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Q_kcalh"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Q_kcalh"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="COP"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="COP"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left">Te (°C)</th>
                  <th className="p-2 text-right">Q (kcal/h)</th>
                  <th className="p-2 text-right">W (kW)</th>
                  <th className="p-2 text-right">COP</th>
                  <th className="p-2 text-right">ΔP ar (Pa)</th>
                  <th className="p-2 text-center">Regime</th>
                </tr>
              </thead>
              <tbody>
                {envelopePoints.map((point, index) => (
                  <tr
                    key={point.Te}
                    className={`border-b ${index === 4 ? "bg-amber-50 font-medium text-slate-900" : ""}`}
                  >
                    <td className="p-2">{point.Te.toFixed(1)}</td>
                    <td className="p-2 text-right">
                      {point.Q_kcalh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-2 text-right">{point.W_kW.toFixed(2)}</td>
                    <td className="p-2 text-right">{point.COP.toFixed(2)}</td>
                    <td className="p-2 text-right">{point.deltaP_Pa.toFixed(1)}</td>
                    <td className="p-2 text-center">{regimeBadge(point.regime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!generated && (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground">
          <span className="mb-2 text-4xl">📊</span>
          <p>Clique em "Gerar Envelope" para calcular a curva Q×Te</p>
          <p className="mt-1 text-xs">
            O motor rodará 9 pontos de Te (±8°C em torno do nominal)
          </p>
        </div>
      )}
    </div>
  );
}
