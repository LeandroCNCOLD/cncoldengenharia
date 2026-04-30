/**
 * Aba Compressor — seleciona compressor da Biblioteca Técnica e simula
 * (Tevap, Tcond) usando vapcyc + fallback ARI.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Play, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { LibraryComponentPicker } from "@/components/coldpro/library-component-picker";
import { PendingFeatureDrawer } from "@/components/coldpro/pending-feature-drawer";
import {
  addEquipmentComponentLink,
  listEquipmentComponentLinks,
  removeEquipmentComponentLink,
} from "@/lib/coldpro/equipment-component-links";
import {
  simulateLibraryCompressor,
  type CompressorSimulationOutput,
} from "@/lib/coldpro/compressor-simulator";

interface Props {
  equipmentProjectId: string;
}

export function CompressorTab({ equipmentProjectId }: Props) {
  const qc = useQueryClient();
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(45);
  const [result, setResult] = useState<CompressorSimulationOutput | null>(null);

  const { data: links } = useQuery({
    queryKey: ["equip-component-links", equipmentProjectId],
    queryFn: () => listEquipmentComponentLinks(equipmentProjectId),
  });

  const compressorLink = useMemo(
    () => links?.find((l) => l.role === "compressor"),
    [links],
  );

  const linkMut = useMutation({
    mutationFn: (technicalComponentId: string) =>
      addEquipmentComponentLink({
        equipmentProjectId,
        technicalComponentId,
        role: "compressor",
      }),
    onSuccess: () => {
      toast.success("Compressor vinculado");
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: removeEquipmentComponentLink,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] });
      setResult(null);
    },
  });

  const simulateMut = useMutation({
    mutationFn: () => {
      if (!compressorLink?.component) {
        throw new Error("Selecione um compressor primeiro.");
      }
      return simulateLibraryCompressor({
        component: compressorLink.component,
        evaporatingTempC: te,
        condensingTempC: tc,
      });
    },
    onSuccess: (r) => {
      setResult(r);
      if (r.kind === "no_data") toast.warning("Sem dados de performance — veja alertas");
      else toast.success("Simulação concluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const c = compressorLink?.component;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Compressor selecionado</span>
            {!c ? (
              <LibraryComponentPicker
                entityTypes={["compressor"]}
                onSelect={(comp) => linkMut.mutate(comp.id)}
                triggerLabel="Selecionar compressor"
                title="Compressores da Biblioteca Técnica"
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeMut.mutate(compressorLink.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Trocar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!c ? (
            <p className="text-sm text-muted-foreground">
              Nenhum compressor vinculado. Use o botão acima para escolher um da Biblioteca Técnica.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Fabricante / Modelo">{c.manufacturer ?? "—"} · {c.model ?? c.code ?? "—"}</Info>
              <Info label="Refrigerante(s)">
                {c.compatible_refrigerants_json?.join(", ") || "—"}
              </Info>
              <Info label="Origem">
                <Badge variant="secondary">{c.source ?? "—"}</Badge>{" "}
                <Badge variant="outline">{c.context}</Badge>
              </Info>
              <Info label="Família / Aplicação">{c.family ?? "—"} · {c.application ?? "—"}</Info>
            </div>
          )}
        </CardContent>
      </Card>

      {c && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulação Tevap / Tcond</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tevap (°C)</Label>
                <Input
                  type="number"
                  value={te}
                  onChange={(e) => setTe(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tcond (°C)</Label>
                <Input
                  type="number"
                  value={tc}
                  onChange={(e) => setTc(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => simulateMut.mutate()}
                  disabled={simulateMut.isPending}
                  className="w-full"
                >
                  <Play className="mr-1 h-4 w-4" />
                  {simulateMut.isPending ? "Simulando…" : "Simular"}
                </Button>
              </div>
            </div>

            {result && <CompressorResultPanel out={result} />}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <PendingFeatureDrawer
            triggerLabel="Comparar com outro modelo"
            title="Comparativo de compressores"
            description="Permitir comparar 2+ compressores no mesmo ponto."
            nextSteps={[
              "Adicionar tabela equipment_compressor_candidates",
              "Loop sobre simulateLibraryCompressor para cada candidato",
              "Tabela comparativa COP/Capacidade/Potência",
            ]}
          />
          <PendingFeatureDrawer
            triggerLabel="Mapa de performance"
            title="Mapa de performance do compressor"
            description="Gerar grade Te × Tc com capacidade/COP."
            nextSteps={[
              "Reaproveitar coil_performance_maps com novo tipo 'compressor'",
              "Server function que itera evaluateCompressor numa grade",
              "Gráfico 2D com isolinhas",
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CompressorResultPanel({ out }: { out: CompressorSimulationOutput }) {
  if (out.kind === "no_data") {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sem dados de performance</AlertTitle>
        <AlertDescription>
          <ul className="ml-4 mt-1 list-disc space-y-1 text-sm">
            {out.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  if (out.kind === "vapcyc") {
    const r = out.result;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600">
            <CheckCircle2 className="mr-1 h-3 w-3" /> VAPCYC
          </Badge>
          {r.inEnvelope ? (
            <Badge variant="outline">No envelope</Badge>
          ) : (
            <Badge variant="destructive">Fora do envelope</Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Capacidade" value={`${(r.capacityW / 1000).toFixed(2)} kW`} />
          <Metric label="Potência" value={`${(r.powerW / 1000).toFixed(2)} kW`} />
          <Metric label="Corrente" value={`${r.currentA.toFixed(2)} A`} />
          <Metric label="COP" value={r.copCooling.toFixed(2)} />
          <Metric label="Vazão massa" value={`${r.massFlowKgh.toFixed(1)} kg/h`} />
          <Metric label="Tevap" value={`${r.evaporatingTempC.toFixed(1)} °C`} />
          <Metric label="Tcond" value={`${r.condensingTempC.toFixed(1)} °C`} />
          <Metric label="Unidades" value={r.unitSystem} />
        </div>
        {(r.warnings.length > 0 || r.envelopeWarnings.length > 0) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Alertas</AlertTitle>
            <AlertDescription>
              <ul className="ml-4 mt-1 list-disc space-y-1 text-sm">
                {[...r.warnings, ...r.envelopeWarnings].map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // ARI
  const r = out.result;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">ARI clássico (fallback)</Badge>
        {r.inEnvelope ? (
          <Badge variant="outline">No envelope</Badge>
        ) : (
          <Badge variant="destructive">Fora do envelope</Badge>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Capacidade" value={`${(r.qCompW / 1000).toFixed(2)} kW`} />
        <Metric label="Potência" value={`${(r.powerW / 1000).toFixed(2)} kW`} />
        <Metric label="COP" value={(r.qCompW / Math.max(1, r.powerW)).toFixed(2)} />
        <Metric label="Vazão massa" value={`${r.massFlowKgh.toFixed(1)} kg/h`} />
      </div>
      {r.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="ml-4 mt-1 list-disc space-y-1 text-sm">
              {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
