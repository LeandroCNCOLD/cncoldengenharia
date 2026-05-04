import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Play, Loader2 } from "lucide-react";
import { catalogRepository } from "../services/catalogRepository";
import { buildMotorComponentsFromCatalog } from "../adapters/sessionToMotorInputAdapter";
import { runEquilibrium } from "@/modules/coldpro/services/coldproEngineService";
import type { SystemEquilibriumResult, SystemComponentsInput } from "@/modules/coldpro_v2";

const KCALH_PER_W = 1 / 1.163;

function fmt(v: number | undefined, d = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: d });
}

function bottleneckLabel(codes: string[]): string {
  if (codes.length === 0) return "Nenhum";
  const c = codes[0];
  if (c.includes("compressor")) return "compressor";
  if (c.includes("condenser")) return "condensador";
  if (c.includes("evaporator")) return "evaporador";
  if (c.includes("expansion")) return "válvula de expansão";
  if (c.includes("fan")) return "ventilador";
  return c;
}

export default function TestBenchPage() {
  const { equipmentId } = useParams({ from: "/_app/coldpro/test-bench/$equipmentId" });
  const navigate = useNavigate();
  const equipment = useMemo(
    () => catalogRepository.getById(equipmentId),
    [equipmentId],
  );

  const [result, setResult] = useState<SystemEquilibriumResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [adapterWarnings, setAdapterWarnings] = useState<string[]>([]);

  if (!equipment) {
    return (
      <div className="space-y-3 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/coldpro/catalog" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Catálogo
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Equipamento não encontrado: <code className="font-mono">{equipmentId}</code>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRun = () => {
    setRunning(true);
    setError(null);
    try {
      const motor = buildMotorComponentsFromCatalog({
        compressor: equipment,
        condenser: equipment,
        evaporator: equipment,
      });
      setAdapterWarnings(motor.warnings);

      if (!motor.compressor || !motor.condenser || !motor.evaporator) {
        const missing: string[] = [];
        if (!motor.compressor) missing.push("compressor");
        if (!motor.condenser) missing.push("condensador");
        if (!motor.evaporator) missing.push("evaporador");
        setError(
          `Dados insuficientes para simular sistema DX. Bloco(s) incompleto(s): ${missing.join(", ")}.`,
        );
        setResult(null);
        return;
      }

      const input: SystemComponentsInput = {
        compressor: motor.compressor,
        condenser: motor.condenser,
        evaporator: motor.evaporator,
        evaporator_fan: motor.evaporator_fan,
        condenser_fan: motor.condenser_fan,
        system_conditions: {
          ambient_temp_c: equipment.tempAmbienteC ?? 32,
          required_airflow_m3_h:
            equipment.vazaoArEvaporadorM3H ?? 5000,
        },
      };

      const out = runEquilibrium(input);
      if (!out.success) {
        setError(out.error);
        setResult(null);
      } else {
        setResult(out.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const cop =
    result && result.thermal_balance.compressor_power_w > 0
      ? result.thermal_balance.q_evap_w / result.thermal_balance.compressor_power_w
      : undefined;

  const allAlerts = result
    ? [
        ...result.bottlenecks.map((b) => ({ kind: "bottleneck" as const, msg: b })),
        ...result.warnings.map((w) => ({ kind: "warning" as const, msg: w })),
        ...result.recommendations.map((r) => ({ kind: "info" as const, msg: r })),
        ...adapterWarnings.map((w) => ({ kind: "adapter" as const, msg: w })),
      ]
    : adapterWarnings.map((w) => ({ kind: "adapter" as const, msg: w }));

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/coldpro/catalog"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Catálogo
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            Bancada de Testes — {equipment.modeloBaseReferencia ?? equipment.modelo}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="font-mono">{equipment.modelo}</Badge>
            {equipment.compressorModelo && (
              <Badge variant="outline" className="font-mono">{equipment.compressorModelo}</Badge>
            )}
            <Badge variant="outline">{equipment.refrigerante}</Badge>
            <Badge variant="outline">{equipment.application}</Badge>
          </div>
        </div>
        <Button onClick={handleRun} disabled={running}>
          {running ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando…</>
          ) : (
            <><Play className="mr-2 h-4 w-4" /> Executar testes</>
          )}
        </Button>
      </div>

      <Tabs defaultValue="dx" className="w-full">
        <TabsList>
          <TabsTrigger value="dx">Sistema DX</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertas {allAlerts.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">
                {allAlerts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dx" className="space-y-4">
          {!result && !error && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Clique em <strong>Executar testes</strong> para calcular o equilíbrio do sistema DX.
              </CardContent>
            </Card>
          )}
          {error && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}
          {result && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs uppercase text-muted-foreground">Status</CardTitle></CardHeader>
                  <CardContent className="pt-1">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      {result.status === "approved" && <><CheckCircle2 className="h-5 w-5 text-emerald-600"/> Aprovado</>}
                      {result.status === "warning" && <><AlertTriangle className="h-5 w-5 text-amber-600"/> Atenção</>}
                      {result.status === "rejected" && <><XCircle className="h-5 w-5 text-destructive"/> Rejeitado</>}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs uppercase text-muted-foreground">Gargalo</CardTitle></CardHeader>
                  <CardContent className="pt-1 text-lg font-semibold capitalize">
                    {bottleneckLabel(result.bottleneck_codes)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs uppercase text-muted-foreground">COP real</CardTitle></CardHeader>
                  <CardContent className="pt-1 text-lg font-semibold">
                    {fmt(cop, 2)}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Balanço térmico</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Q evap</p>
                    <p className="font-mono">{fmt(result.thermal_balance.q_evap_w, 0)} W</p>
                    <p className="text-xs text-muted-foreground">{fmt(result.thermal_balance.q_evap_w * KCALH_PER_W, 0)} kcal/h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Q cond requerido</p>
                    <p className="font-mono">{fmt(result.thermal_balance.q_cond_required_w, 0)} W</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Q cond disponível</p>
                    <p className="font-mono">{fmt(result.thermal_balance.q_cond_available_w, 0)} W</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pot. compressor</p>
                    <p className="font-mono">{fmt(result.thermal_balance.compressor_power_w, 0)} W</p>
                  </div>
                  <div className="md:col-span-4">
                    <p className="text-xs text-muted-foreground">Erro de balanço</p>
                    <p className="font-mono">{fmt(result.thermal_balance.balance_error_pct, 2)} %</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Utilização dos componentes</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Compressor</p>
                    <p className="font-mono">{fmt(result.utilization.compressor_pct, 1)} %</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Evaporador</p>
                    <p className="font-mono">{fmt(result.utilization.evaporator_pct, 1)} %</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Condensador</p>
                    <p className="font-mono">{fmt(result.utilization.condenser_pct, 1)} %</p>
                  </div>
                  {result.utilization.expansion_valve_pct !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Válvula de expansão</p>
                      <p className="font-mono">{fmt(result.utilization.expansion_valve_pct, 1)} %</p>
                    </div>
                  )}
                  {result.utilization.evaporator_fan_pct !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Vent. evaporador</p>
                      <p className="font-mono">{fmt(result.utilization.evaporator_fan_pct, 1)} %</p>
                    </div>
                  )}
                  {result.utilization.condenser_fan_pct !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Vent. condensador</p>
                      <p className="font-mono">{fmt(result.utilization.condenser_fan_pct, 1)} %</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader><CardTitle className="text-base">Alertas consolidados</CardTitle></CardHeader>
            <CardContent>
              {allAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum alerta. Execute os testes para listar gargalos, avisos e recomendações.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {allAlerts.map((a, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 rounded-md border p-2 ${
                        a.kind === "bottleneck"
                          ? "border-destructive/40 bg-destructive/5"
                          : a.kind === "warning"
                            ? "border-amber-300 bg-amber-50"
                            : a.kind === "adapter"
                              ? "border-slate-300 bg-slate-50"
                              : "border-sky-300 bg-sky-50"
                      }`}
                    >
                      <span className="mt-0.5 text-xs font-semibold uppercase">
                        {a.kind === "bottleneck" && "Gargalo"}
                        {a.kind === "warning" && "Aviso"}
                        {a.kind === "info" && "Recom."}
                        {a.kind === "adapter" && "Dados"}
                      </span>
                      <span>{a.msg}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
