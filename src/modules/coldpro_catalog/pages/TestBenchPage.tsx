import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Fan, Loader2, Play, Snowflake, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnvelopeStatusCard } from "@/modules/cn_coils/components/EnvelopeStatusCard";
import { SystemEquilibriumChart } from "@/modules/cn_coils/components/SystemEquilibriumChart";
import { SystemEquilibriumResultsTab } from "@/modules/cn_coils/components/SystemEquilibriumResultsTab";
import { coilEnvelopeToEquilibriumPoints, useSystemEquilibrium } from "@/modules/cn_coils/hooks/useSystemEquilibrium";
import { useCoilEnvelopeStore } from "@/modules/cn_coils/store/useCoilEnvelopeStore";
import { catalogRepository } from "../services/catalogRepository";
import { useCatalogPreloadStore } from "../store/useCatalogPreloadStore";
import { useCatalogSessionStore } from "../store/useCatalogSessionStore";

function fmt(v: number | undefined | null, d = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: d });
}

export default function TestBenchPage() {
  const { equipmentId } = useParams({ from: "/_app/coldpro/test-bench/$equipmentId" });
  const navigate = useNavigate();
  const equipment = useMemo(() => catalogRepository.getById(equipmentId), [equipmentId]);
  const evaporatorEnvelope = useCoilEnvelopeStore((s) => s.envelopes.evaporator_dx);
  const condenserEnvelope = useCoilEnvelopeStore((s) => s.envelopes.condenser_air ?? s.condenserEnvelope);
  const compressorEnvelope = useCoilEnvelopeStore((s) => s.compressorEnvelope);
  const compressorModel = useCoilEnvelopeStore((s) => s.compressorModel);
  const { selectedEvaporator, selectedCondenser, selectedCompressor } = useCatalogSessionStore();
  const { setPendingEvaporator, setPendingCondenser, setPendingCompressor } =
    useCatalogPreloadStore();

  const [benchInputs, setBenchInputs] = useState({
    Tamb_C: 35,
    Tsuperheating_K: 7,
    Tsubcooling_K: 5,
  });
  const { result, isCalculating, error, run } = useSystemEquilibrium();

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

  const canRunTest = Boolean(evaporatorEnvelope && condenserEnvelope && compressorEnvelope);

  const runIntegratedTest = () => {
    if (!evaporatorEnvelope || !condenserEnvelope || !compressorEnvelope) return;
    run({
      ...benchInputs,
      evaporatorEnvelope: coilEnvelopeToEquilibriumPoints(evaporatorEnvelope),
      condenserEnvelope: Array.isArray(condenserEnvelope) ? condenserEnvelope : [],
      compressorEnvelope,
    });
  };

  const goWorkspace = (type: "evaporator_dx" | "condenser_air" | "compressor") => {
    if (type === "evaporator_dx") {
      setPendingEvaporator(selectedEvaporator ?? equipment);
    }
    if (type === "condenser_air") {
      setPendingCondenser(selectedCondenser ?? equipment);
    }
    if (type === "compressor") {
      setPendingCompressor(selectedCompressor ?? equipment);
    }
    navigate({
      to: "/coldpro/cncoils/workspace",
      search: { type } as never,
    });
  };

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
        <Button onClick={runIntegratedTest} disabled={isCalculating || !canRunTest}>
          {isCalculating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando equilíbrio…</>
          ) : (
            <><Play className="mr-2 h-4 w-4" /> Executar Teste Integrado</>
          )}
        </Button>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">📋 Configuração</TabsTrigger>
          <TabsTrigger value="results" disabled={!result}>📊 Resultados</TabsTrigger>
          <TabsTrigger value="chart" disabled={!result}>📈 Gráfico Q×Te</TabsTrigger>
          <TabsTrigger value="convergence" disabled={!result}>🔄 Convergência</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <EnvelopeStatusCard
              label="Evaporador"
              icon={<Snowflake className="h-4 w-4" />}
              saved={Boolean(evaporatorEnvelope)}
              model={evaporatorEnvelope?.geometryId ?? evaporatorEnvelope?.equipmentId}
              pointCount={evaporatorEnvelope?.envelope.length}
              onReconfigure={() => goWorkspace("evaporator_dx")}
            />
            <EnvelopeStatusCard
              label="Condensador"
              icon={<Fan className="h-4 w-4" />}
              saved={Boolean(condenserEnvelope)}
              model="condenser_air"
              pointCount={Array.isArray(condenserEnvelope) ? condenserEnvelope.length : undefined}
              onReconfigure={() => goWorkspace("condenser_air")}
            />
            <EnvelopeStatusCard
              label="Compressor"
              icon={<Zap className="h-4 w-4" />}
              saved={Boolean(compressorEnvelope)}
              model={compressorModel}
              pointCount={compressorEnvelope?.length}
              onReconfigure={() => goWorkspace("compressor")}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inputs da bancada integrada</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <NumberField
                label="Temperatura ambiente (°C)"
                value={benchInputs.Tamb_C}
                onChange={(Tamb_C) => setBenchInputs((s) => ({ ...s, Tamb_C }))}
              />
              <NumberField
                label="Superaquecimento (K)"
                value={benchInputs.Tsuperheating_K}
                onChange={(Tsuperheating_K) => setBenchInputs((s) => ({ ...s, Tsuperheating_K }))}
              />
              <NumberField
                label="Subresfriamento (K)"
                value={benchInputs.Tsubcooling_K}
                onChange={(Tsubcooling_K) => setBenchInputs((s) => ({ ...s, Tsubcooling_K }))}
              />
            </CardContent>
          </Card>

          {!canRunTest && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-3 text-sm text-amber-900">
                Salve os envelopes de evaporador, condensador e compressor para habilitar o teste integrado.
              </CardContent>
            </Card>
          )}
          {error && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results">
          {result ? (
            <SystemEquilibriumResultsTab result={result} />
          ) : (
            <EmptyState message="Execute o teste integrado para visualizar os resultados." />
          )}
        </TabsContent>

        <TabsContent value="chart">
          {result && evaporatorEnvelope && compressorEnvelope ? (
            <SystemEquilibriumChart
              evaporatorEnvelope={coilEnvelopeToEquilibriumPoints(evaporatorEnvelope)}
              compressorEnvelope={compressorEnvelope}
              result={result}
              nominalTc_C={result.Tc_eq_C}
            />
          ) : (
            <EmptyState message="Gráfico disponível após executar o teste integrado." />
          )}
        </TabsContent>

        <TabsContent value="convergence">
          {result ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trajetória de convergência</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2">Iteração</th>
                      <th className="py-2">Te (°C)</th>
                      <th className="py-2">Tc (°C)</th>
                      <th className="py-2">Resíduo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.convergencePath.map((point) => (
                      <tr key={point.iteration} className="border-b">
                        <td className="py-2">{point.iteration}</td>
                        <td className="py-2">{fmt(point.Te_C)}</td>
                        <td className="py-2">{fmt(point.Tc_C)}</td>
                        <td className="py-2">{fmt(point.residual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <EmptyState message="Convergência disponível após executar o teste integrado." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}
