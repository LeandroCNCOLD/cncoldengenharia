import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCoilEnvelopeGenerator } from "../hooks/useCoilEnvelopeGenerator";
import type { EnvelopePoint } from "../store/useCoilEnvelopeStore";
import {
  convertCapacity,
  useUnitStore,
  type CapacityUnit,
} from "../store/useUnitStore";
import {
  formatPolynomial,
  formatPolynomialExcel,
  polynomialRegression,
  superscript,
} from "../utils/polynomialRegression";
import { CHART_COLORS } from "../constants/chartColors";

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
  const { capacityUnit } = useUnitStore();
  const [generated, setGenerated] = useState(false);
  const [polyDegree, setPolyDegree] = useState<2 | 3 | 4>(3);
  const [copiedQ, setCopiedQ] = useState(false);
  const [copiedCOP, setCopiedCOP] = useState(false);

  const polyQ = useMemo(() => {
    if (envelopePoints.length < polyDegree + 1) return null;
    const xs = envelopePoints.map((point) => point.Te);
    const ys = envelopePoints.map((point) =>
      convertCapacity(point.Q_kcalh / 860, capacityUnit),
    );
    try {
      return polynomialRegression(xs, ys, polyDegree);
    } catch {
      return null;
    }
  }, [capacityUnit, envelopePoints, polyDegree]);

  const polyCOP = useMemo(() => {
    if (envelopePoints.length < polyDegree + 1) return null;
    const xs = envelopePoints.map((point) => point.Te);
    const ys = envelopePoints.map((point) => point.COP);
    try {
      return polynomialRegression(xs, ys, polyDegree);
    } catch {
      return null;
    }
  }, [envelopePoints, polyDegree]);

  const handleGenerate = async () => {
    await generateEnvelope();
    setGenerated(true);
  };

  function copyWithFeedback(text: string, setter: (value: boolean) => void) {
    void navigator.clipboard.writeText(text);
    setter(true);
    window.setTimeout(() => setter(false), 2000);
  }

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
                  stroke={CHART_COLORS.warning}
                  strokeDasharray="4 4"
                  label="Nominal"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Q_kcalh"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Q_kcalh"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="COP"
                  stroke={CHART_COLORS.success}
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

          {polyQ && polyCOP && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Equação Polinomial do Envelope</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Grau:</span>
                  <Select
                    value={String(polyDegree)}
                    onValueChange={(value) => setPolyDegree(Number(value) as 2 | 3 | 4)}
                  >
                    <SelectTrigger className="h-6 w-14 px-2 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2º</SelectItem>
                      <SelectItem value="3">3º</SelectItem>
                      <SelectItem value="4">4º</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5 rounded border border-blue-200 bg-blue-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                      Capacidade Q(Te)
                    </p>
                    <code className="block break-all font-mono text-sm text-blue-900">
                      {formatPolynomial(polyQ.coefficients, "Te", capacityUnit, 4)}
                    </code>
                    <p className="mt-1 text-[11px] text-blue-600">
                      R² = {polyQ.rSquared.toFixed(4)}
                      {polyQ.rSquared >= 0.999
                        ? " ✓ Excelente ajuste"
                        : polyQ.rSquared >= 0.99
                          ? " ✓ Bom ajuste"
                          : " ⚠ Ajuste moderado — considere grau maior"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 sm:flex-col">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() =>
                        copyWithFeedback(
                          formatPolynomial(polyQ.coefficients, "Te", capacityUnit, 6),
                          setCopiedQ,
                        )
                      }
                    >
                      {copiedQ ? "✓ Copiado" : "📋 Copiar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() =>
                        copyWithFeedback(formatPolynomialExcel(polyQ.coefficients, "A1"), setCopiedQ)
                      }
                    >
                      📊 Excel
                    </Button>
                  </div>
                </div>

                <div className="mt-2 overflow-x-auto">
                  <table className="border-collapse text-[10px]">
                    <thead>
                      <tr className="border-b border-blue-200">
                        {polyQ.coefficients.map((_, index) => (
                          <th key={index} className="px-3 py-1 text-center font-semibold text-blue-700">
                            a{index} {index > 0 ? `(·Te${superscript(index)})` : "(constante)"}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {polyQ.coefficients.map((coefficient, index) => (
                          <td key={index} className="px-3 py-1 text-center font-mono text-blue-900">
                            {coefficient.toFixed(6)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1.5 rounded border border-green-200 bg-green-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-green-700">
                      COP(Te)
                    </p>
                    <code className="block break-all font-mono text-sm text-green-900">
                      {formatPolynomial(polyCOP.coefficients, "Te", "adimensional", 4)}
                    </code>
                    <p className="mt-1 text-[11px] text-green-600">
                      R² = {polyCOP.rSquared.toFixed(4)}
                      {polyCOP.rSquared >= 0.999
                        ? " ✓ Excelente ajuste"
                        : polyCOP.rSquared >= 0.99
                          ? " ✓ Bom ajuste"
                          : " ⚠ Ajuste moderado"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 px-2 text-[10px]"
                    onClick={() =>
                      copyWithFeedback(
                        formatPolynomial(polyCOP.coefficients, "Te", "adimensional", 6),
                        setCopiedCOP,
                      )
                    }
                  >
                    {copiedCOP ? "✓ Copiado" : "📋 Copiar"}
                  </Button>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Regressão por mínimos quadrados sobre {envelopePoints.length} pontos calculados.
                Use "📊 Excel" para copiar a fórmula pronta para planilha (referência A1 = Te em °C).
              </p>
            </div>
          )}
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
