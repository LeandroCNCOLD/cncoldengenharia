import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  SystemBottleneck,
  SystemEquilibriumResult,
} from "../hooks/useSystemEquilibrium";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const bottleneckLabels: Record<SystemBottleneck, string> = {
  evaporator: "Evaporador",
  condenser: "Condensador",
  compressor: "Compressor",
  balanced: "Sistema balanceado",
};

interface SystemEquilibriumResultsTabProps {
  result: SystemEquilibriumResult | null;
}

export function SystemEquilibriumResultsTab({
  result,
}: SystemEquilibriumResultsTabProps) {
  if (!result) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Execute o teste integrado para calcular o equilíbrio do sistema.
        </CardContent>
      </Card>
    );
  }

  const cards = [
    ["Temperatura de Evaporação", `${fmt(result.Te_eq_C)} °C`],
    ["Temperatura de Condensação", `${fmt(result.Tc_eq_C)} °C`],
    ["Capacidade Real", `${fmt(result.Q_evap_W / 1000)} kW`],
    ["Potência do Compressor", `${fmt(result.W_comp_W / 1000)} kW`],
    ["COP Real", fmt(result.COP_real)],
    ["Calor Rejeitado", `${fmt(result.Q_cond_W / 1000)} kW`],
  ];

  return (
    <div className="space-y-4">
      <div>
        {result.converged ? (
          <Badge className="bg-emerald-100 px-3 py-1 text-sm text-emerald-800 hover:bg-emerald-100">
            ✅ Sistema convergiu em {result.iterations} iterações
          </Badge>
        ) : (
          <Badge className="bg-amber-100 px-3 py-1 text-sm text-amber-800 hover:bg-amber-100">
            ⚠️ Resultado estimado — não convergiu
          </Badge>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert
        className={
          result.bottleneck === "balanced"
            ? "border-emerald-300 bg-emerald-50 text-emerald-950"
            : "border-amber-300 bg-amber-50 text-amber-950"
        }
      >
        <AlertTitle>
          Gargalo do sistema: {bottleneckLabels[result.bottleneck]}
        </AlertTitle>
        <AlertDescription>{result.bottleneckReason}</AlertDescription>
      </Alert>

      {result.warnings.map((warning, index) => (
        <Alert key={`${warning}-${index}`} className="border-amber-300 bg-amber-50">
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
