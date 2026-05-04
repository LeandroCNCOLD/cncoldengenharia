import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Play, Loader2 } from "lucide-react";
import { catalogRepository } from "../services/catalogRepository";
import { buildCycleConfigFromCatalog } from "../utils/buildCycleConfigFromCatalog";
import { useCycleSimulation } from "@/modules/cn_coils/hooks/useCycleSimulation";
import { buildMotorComponentsFromCatalog } from "../adapters/sessionToMotorInputAdapter";
import type { CycleSystemConfig } from "@/modules/cn_coils/engines/cycle/cycleTypes";

const KCALH_PER_W = 1 / 1.163;

function fmt(v: number | undefined | null, d = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: d });
}

type BottleneckKind = "balanced" | "evaporator" | "compressor" | "condenser";

function bottleneckLabel(kind: BottleneckKind): string {
  switch (kind) {
    case "balanced": return "Sistema balanceado";
    case "evaporator": return "Evaporador";
    case "compressor": return "Compressor";
    case "condenser": return "Condensador";
  }
}

export default function TestBenchPage() {
  const { equipmentId } = useParams({ from: "/_app/coldpro/test-bench/$equipmentId" });
  const navigate = useNavigate();
  const equipment = useMemo(
    () => catalogRepository.getById(equipmentId),
    [equipmentId],
  );

  const [config, setConfig] = useState<CycleSystemConfig | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [adapterWarnings, setAdapterWarnings] = useState<string[]>([]);

  const sim = useCycleSimulation(config, { mode: "auto" });
  const running = sim.status === "running";
  const error = sim.status === "error" ? sim.message : null;
  const result = sim.status === "success" ? sim.result : null;

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

  const refrigerantId = equipment.refrigerante !== "unknown" ? equipment.refrigerante : "R404A";
  const Te_C = equipment.tempEvaporacaoC ?? -10;
  const Tc_C = equipment.tempCondensacaoC ?? 45;
  const Q_catalog_W = equipment.capacidadeFrigorificaKcalH
    ? equipment.capacidadeFrigorificaKcalH / KCALH_PER_W * 1 // kcal/h -> W via /0.86
    : undefined;
  const W_catalog_W = (equipment.potenciaCompressorKw ?? equipment.potenciaEletricaKw)
    ? (equipment.potenciaCompressorKw ?? equipment.potenciaEletricaKw)! * 1000
    : undefined;
  const COP_catalog =
    equipment.cop ??
    (Q_catalog_W && W_catalog_W && W_catalog_W > 0 ? Q_catalog_W / W_catalog_W : undefined);

  // Capture adapter warnings (non-blocking — only used to populate the Alerts tab).
  const collectAdapterWarnings = () => {
    try {
      const motor = buildMotorComponentsFromCatalog({
        compressor: equipment,
        condenser: equipment,
        evaporator: equipment,
      });
      setAdapterWarnings(motor.warnings ?? []);
    } catch {
      setAdapterWarnings([]);
    }
  };

  const handleRun = () => {
    setHasRun(true);
    collectAdapterWarnings();
    setConfig(
      buildCycleConfigFromCatalog({
        row: equipment,
        refrigerantId,
        Te_C,
        Tc_C,
        superheatK: 5,
        subcoolingK: 5,
      }),
    );
  };

  // Bottleneck heuristic by motor vs catalog comparison.
  let bottleneck: BottleneckKind = "balanced";
  if (result) {
    const Q_motor = result.Q_evap_W;
    const COP_motor = result.COP;
    if (Q_catalog_W && Q_motor < Q_catalog_W * 0.9) bottleneck = "evaporator";
    else if (COP_catalog && COP_motor < COP_catalog * 0.85) bottleneck = "compressor";
  }

  const allAlerts = [
    ...(result?.warnings ?? []).map((w) => ({ kind: "warning" as const, msg: w })),
    ...adapterWarnings.map((w) => ({ kind: "adapter" as const, msg: w })),
  ];

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
            <Badge variant="outline">{refrigerantId}</Badge>
            <Badge variant="outline">{equipment.application}</Badge>
            <Badge variant="outline">Te {fmt(Te_C, 1)} °C</Badge>
            <Badge variant="outline">Tc {fmt(Tc_C, 1)} °C</Badge>
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
          {!hasRun && !error && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Clique em <strong>Executar testes</strong> para calcular o ciclo termodinâmico (CycleEngine V2)
                a partir das condições nominais do catálogo.
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
                      {bottleneck === "balanced" && <><CheckCircle2 className="h-5 w-5 text-emerald-600"/> Balanceado</>}
                      {bottleneck !== "balanced" && bottleneck !== "condenser" && <><AlertTriangle className="h-5 w-5 text-amber-600"/> Atenção</>}
                      {bottleneck === "condenser" && <><XCircle className="h-5 w-5 text-destructive"/> Rejeitado</>}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs uppercase text-muted-foreground">Gargalo</CardTitle></CardHeader>
                  <CardContent className="pt-1 text-lg font-semibold">
                    {bottleneckLabel(bottleneck)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs uppercase text-muted-foreground">COP real</CardTitle></CardHeader>
                  <CardContent className="pt-1 text-lg font-semibold">
                    {fmt(result.COP, 2)}
                    {COP_catalog !== undefined && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        catálogo {fmt(COP_catalog, 2)}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Resultado do ciclo</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Q evap (motor)</p>
                    <p className="font-mono">{fmt(result.Q_evap_W, 0)} W</p>
                    <p className="text-xs text-muted-foreground">{fmt(result.Q_evap_W * KCALH_PER_W, 0)} kcal/h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Q evap (catálogo)</p>
                    <p className="font-mono">{Q_catalog_W ? `${fmt(Q_catalog_W, 0)} W` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">W compressor</p>
                    <p className="font-mono">{fmt(result.W_comp_W, 0)} W</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Q cond</p>
                    <p className="font-mono">{fmt(result.Q_cond_W, 0)} W</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Te equilíbrio</p>
                    <p className="font-mono">{fmt(result.Te_C, 2)} °C</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tc equilíbrio</p>
                    <p className="font-mono">{fmt(result.Tc_C, 2)} °C</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Convergência</p>
                    <p className="font-mono">
                      {result.converged ? "OK" : "Não"} ({result.iterations} it.)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">EER</p>
                    <p className="font-mono">{fmt(result.EER, 2)}</p>
                  </div>
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
                  Nenhum alerta. Execute os testes para listar avisos do motor e do mapeamento de dados.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {allAlerts.map((a, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 rounded-md border p-2 ${
                        a.kind === "warning"
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-300 bg-slate-50"
                      }`}
                    >
                      <span className="mt-0.5 text-xs font-semibold uppercase">
                        {a.kind === "warning" ? "Aviso" : "Dados"}
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
