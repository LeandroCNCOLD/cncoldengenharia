import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "../constants/chartColors";
import { useFrostAnalysis } from "../hooks/useFrostAnalysis";
import type { CycleResult, CycleStatePoint } from "../engines/cycle/cycleTypes";

interface FrostAnalysisTabProps {
  Te: number;
  Tair_in: number;
  RH: number;
  Q_nominal: number;
  geometry: string;
}

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const makeStatePoint = (T_C: number): CycleStatePoint => ({
  T_C,
  P_kPa: 0,
  h_kJkg: 0,
  s_kJkgK: 0,
  quality: 0,
  phase: "two_phase",
});

function buildCycleResult(Te: number, TairIn: number, qNominal: number): CycleResult {
  return {
    converged: true,
    iterations: 1,
    residual: 0,
    Te_C: Te,
    Tc_C: Math.max(TairIn + 10, Te + 25),
    m_dot_kgS: Math.max(qNominal / 180_000, 0.01),
    Q_evap_W: qNominal,
    Q_cond_W: qNominal * 1.25,
    W_comp_W: qNominal * 0.25,
    COP: 4,
    EER: 13.65,
    statePoints: {
      point1_evapOut: makeStatePoint(Te + 5),
      point2_compOut: makeStatePoint(TairIn + 30),
      point3_condOut: makeStatePoint(TairIn + 10),
      point4_valveOut: makeStatePoint(Te),
    },
    evaporatorResult: {
      totalCapacityW: qNominal,
      sensibleCapacityW: qNominal,
      latentCapacityW: 0,
      airOutletTempC: TairIn - 5,
      airOutletRH: 90,
      airPressureDropPa: 0,
      fluidPressureDropKPa: 0,
      overallU_WM2K: 0,
      safetyFactor: 1,
    },
    condenserResult: {
      totalCapacityW: qNominal * 1.25,
      airOutletTempC: TairIn + 8,
      airPressureDropPa: 0,
      fluidPressureDropKPa: 0,
      overallU_WM2K: 0,
    },
    compressorResult: {
      Q_evap_W: qNominal,
      W_comp_W: qNominal * 0.25,
      COP: 4,
      compressionRatio: 1,
      mode: "frost-tab",
    },
    warnings: [],
  };
}

function regimeForSurface(surfaceTempC: number) {
  if (surfaceTempC > 0) {
    return {
      kind: "dry" as const,
      badge: "🌬️ Regime Seco — Sem formação de gelo",
      className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    };
  }
  if (surfaceTempC >= -2) {
    return {
      kind: "wet" as const,
      badge: "💧 Regime Úmido — Condensação",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    };
  }
  return {
    kind: "frost" as const,
    badge: "❄️ Regime Gelo — Formação ativa",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  };
}

function defrostRecommendation(Te: number) {
  if (Te > -15) {
    return {
      title: "Degelo por ar (off-cycle)",
      description:
        "A temperatura de evaporação permite interromper a refrigeração e usar o próprio ar da câmara para remover a geada.",
    };
  }
  if (Te >= -25) {
    return {
      title: "Degelo elétrico ou por gás quente",
      description:
        "A formação de gelo tende a ser mais intensa; avalie resistência elétrica ou gás quente conforme disponibilidade do sistema.",
    };
  }
  return {
    title: "Degelo por gás quente (hot gas) obrigatório",
    description:
      "A operação em baixa temperatura exige degelo ativo por gás quente para reduzir tempo de parada e recuperar capacidade.",
  };
}

export function FrostAnalysisTab({
  Te,
  Tair_in,
  RH,
  Q_nominal,
  geometry,
}: FrostAnalysisTabProps) {
  const surfaceTempC = Te + 3;
  const regime = regimeForSurface(surfaceTempC);
  const cycleResult = useMemo(
    () => buildCycleResult(Te, Tair_in, Math.max(Q_nominal, 0)),
    [Q_nominal, Tair_in, Te],
  );
  const externalAreaM2 = useMemo(() => {
    const fromGeometry = Number(geometry.replace(/[^\d.]/g, ""));
    return Number.isFinite(fromGeometry) && fromGeometry > 0
      ? Math.max(1, fromGeometry / 100)
      : 12;
  }, [geometry]);

  const frost = useFrostAnalysis({
    cycleResult,
    refrigerantId: "R404A",
    airInletTempC: Tair_in,
    airRelativeHumidity: RH,
    airMassFlowKgS: 1,
    evaporatorExternalAreaM2: externalAreaM2,
    config: { operationTimeH: 8 },
  });

  if (regime.kind === "dry") {
    return (
      <Card>
        <CardHeader>
          <Badge className={regime.className}>{regime.badge}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nenhuma análise de geada necessária para este ponto de operação.
        </CardContent>
      </Card>
    );
  }

  if (!frost) {
    return (
      <Card>
        <CardHeader>
          <Badge className={regime.className}>{regime.badge}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Não foi possível calcular a análise de geada para os dados atuais.
        </CardContent>
      </Card>
    );
  }

  const recommended = defrostRecommendation(Te);
  const chartData = frost.degradationCurve.map((point) => ({
    t: point.timeH,
    qPct: Q_nominal > 0 ? (point.effectiveCapacityW / Q_nominal) * 100 : 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge className={regime.className}>{regime.badge}</Badge>
        <span className="text-xs text-muted-foreground">
          T superfície: {fmt(surfaceTempC, 1)} °C
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard label="Ponto de Gelo" value={`${fmt(frost.frostPoint_C, 1)} °C`} />
        <SummaryCard label="Taxa de Acúmulo" value={`${fmt(frost.massRate_kgh, 3)} kg/h`} />
        <SummaryCard
          label="Intervalo de Degelo"
          value={`${fmt(frost.recommendedDefrostInterval_h, 1)} h`}
        />
        <SummaryCard
          label="Capacidade Residual"
          value={`${fmt(frost.residualCapacityPct, 0)}%`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Degradação de Capacidade Q(t)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  type="text" inputMode="decimal" onFocus={(e) => e.target.select()}
                  domain={[0, Math.max(frost.recommendedDefrostInterval_h, 1)]}
                  label={{ value: "Tempo (h)", position: "insideBottom", offset: -5 }}
                />
                <YAxis
                  domain={[0, 100]}
                  label={{ value: "Capacidade (%)", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  formatter={(value: number) => [`${fmt(value, 1)}%`, "Capacidade"]}
                  labelFormatter={(label) => `Tempo: ${fmt(Number(label), 1)} h`}
                />
                <ReferenceLine
                  y={70}
                  stroke={CHART_COLORS.danger}
                  strokeDasharray="4 4"
                  label="Limite 70%"
                />
                <Line
                  type="monotone"
                  dataKey="qPct"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Capacidade"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Método de Degelo Recomendado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{recommended.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{recommended.description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
