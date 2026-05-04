import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CycleResult } from "../engines/cycle/cycleTypes";
import type { CompressorWorkspaceInputs } from "../hooks/useCompressorEnvelopeGenerator";

interface CompressorOperatingPointTabProps {
  result: CycleResult | null;
  inputs: CompressorWorkspaceInputs;
  isCalculating: boolean;
}

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

function dischargeTemp(result: CycleResult | null): number {
  return result?.statePoints.point2_compOut.T_C ?? 0;
}

function dischargeBadge(value: number) {
  if (value > 130) {
    return {
      label: "⚠️ Temperatura de descarga crítica",
      className: "bg-red-100 text-red-800 hover:bg-red-100",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    };
  }
  if (value > 110) {
    return {
      label: "⚠️ Temperatura de descarga elevada",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: "✅ Temperatura de descarga normal",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  };
}

export function CompressorOperatingPointTab({
  result,
  inputs,
  isCalculating,
}: CompressorOperatingPointTabProps) {
  if (isCalculating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Calculando ponto de operação...
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Selecione um compressor e clique em Calcular para avaliar o ponto nominal.
        </CardContent>
      </Card>
    );
  }

  const tDischarge = dischargeTemp(result);
  const badge = dischargeBadge(tDischarge);
  const cards = [
    ["Capacidade de Refrigeração", `${fmt(result.Q_evap_W / 1000)} kW`],
    ["Potência Absorvida", `${fmt(result.W_comp_W / 1000)} kW`],
    ["COP", fmt(result.COP)],
    ["EER", fmt(result.COP * 3.412)],
    ["Temp. de Descarga", `${fmt(tDischarge, 1)} °C`],
    ["Fluxo de Massa", `${fmt(result.m_dot_kgS * 3600, 1)} kg/h`],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge className={badge.className}>
          <span className="mr-1 inline-flex">{badge.icon}</span>
          {badge.label}
        </Badge>
        <div className="text-xs text-muted-foreground">
          {inputs.compressorBrand} {inputs.compressorModel} · {inputs.refrigerant} ·{" "}
          {fmt(inputs.voltage_V, 0)} V / {fmt(inputs.frequency_Hz, 0)} Hz
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
