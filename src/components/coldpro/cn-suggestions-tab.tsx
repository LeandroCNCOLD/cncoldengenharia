/**
 * Aba "Sugestões CN" no detalhe do equipamento.
 *
 * Fluxo: usuário escolhe um modelo CN (autocomplete via curvas) → clica
 * "Sugerir componentes" → sistema gera/usa cache → mostra ranking por tipo.
 * Cada linha tem botão Aceitar/Rejeitar. No final, botão "Criar equipamento
 * a partir das sugestões aceitas" + botão "Diagnóstico IA".
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Stethoscope,
  Loader2,
  Search,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { searchPerformanceCurves, type CatalogCurve } from "@/lib/coldpro/catalog-curves";
import {
  generateAndCacheCnSuggestions,
  setSuggestionStatus,
  diagnoseCatalogVsSimulation,
} from "@/server/cnCatalogSuggestions.functions";

interface SuggestionRow {
  id: string;
  catalog_model_id: string;
  component_type: "compressor" | "fan" | "coil" | "valve";
  suggested_table: string;
  suggested_component_id: string;
  score: number;
  ranking: number;
  tier: "ideal" | "bom" | "aceitavel" | "rejeitado";
  reason_json: Record<string, unknown>;
  simulated_values_json: Record<string, unknown>;
  status: "suggested" | "accepted" | "rejected" | "outdated";
}

const TIER_VARIANT: Record<SuggestionRow["tier"], "default" | "secondary" | "outline" | "destructive"> = {
  ideal: "default",
  bom: "secondary",
  aceitavel: "outline",
  rejeitado: "destructive",
};

const TIER_LABEL: Record<SuggestionRow["tier"], string> = {
  ideal: "Ideal",
  bom: "Bom",
  aceitavel: "Aceitável",
  rejeitado: "Rejeitado",
};

const TYPE_LABEL: Record<SuggestionRow["component_type"], string> = {
  compressor: "Compressor",
  fan: "Ventilador",
  coil: "Serpentina",
  valve: "Válvula",
};

const STATUS_VARIANT: Record<SuggestionRow["status"], "default" | "secondary" | "outline" | "destructive"> = {
  suggested: "outline",
  accepted: "default",
  rejected: "destructive",
  outdated: "secondary",
};

export function CnSuggestionsTab(_props: { equipmentProjectId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCurve, setSelectedCurve] = useState<CatalogCurve | null>(null);
  const [fanCount, setFanCount] = useState<number>(2);
  const [airflow, setAirflow] = useState<string>("");
  const [pressure, setPressure] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<string | null>(null);

  // Busca de modelos CN
  const searchQuery = useQuery({
    queryKey: ["cn-search", search],
    queryFn: () => searchPerformanceCurves(search),
    enabled: search.trim().length >= 2,
  });

  // Sugestões salvas para o modelo selecionado
  const cacheQuery = useQuery({
    queryKey: ["cn-suggestions", selectedCurve?.id],
    queryFn: async (): Promise<SuggestionRow[]> => {
      if (!selectedCurve) return [];
      const { data, error } = await supabase
        .from("cn_catalog_component_suggestions")
        .select("*")
        .eq("catalog_model_id", selectedCurve.id)
        .order("component_type", { ascending: true })
        .order("ranking", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SuggestionRow[];
    },
    enabled: !!selectedCurve,
  });

  const generateFn = useServerFn(generateAndCacheCnSuggestions);
  const setStatusFn = useServerFn(setSuggestionStatus);
  const diagnoseFn = useServerFn(diagnoseCatalogVsSimulation);

  const generateMut = useMutation({
    mutationFn: async (forceRefresh: boolean) => {
      if (!selectedCurve) throw new Error("Selecione um modelo CN.");
      return generateFn({
        data: {
          catalogModelId: selectedCurve.id,
          fanCount,
          airflowM3h: airflow ? Number(airflow) : undefined,
          pressurePa: pressure ? Number(pressure) : undefined,
          forceRefresh,
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["cn-suggestions", selectedCurve?.id] });
      const fromCache = (res as { fromCache?: boolean }).fromCache;
      const warnings = ((res as { warnings?: string[] }).warnings ?? []) as string[];
      toast.success(fromCache ? "Sugestões carregadas do cache." : "Sugestões geradas com sucesso.");
      warnings.forEach((w) => toast.warning(w));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: SuggestionRow["status"] }) =>
      setStatusFn({ data: { suggestionId: vars.id, status: vars.status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cn-suggestions", selectedCurve?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const diagnoseMut = useMutation({
    mutationFn: async () => {
      if (!selectedCurve) throw new Error("Selecione um modelo CN.");
      const accepted = (cacheQuery.data ?? []).filter((s) => s.status === "accepted");
      return diagnoseFn({
        data: {
          catalogModelId: selectedCurve.id,
          simulationSummary: {
            accepted_components: accepted.map((s) => ({
              type: s.component_type,
              ranking: s.ranking,
              tier: s.tier,
              reason: s.reason_json,
              values: s.simulated_values_json,
            })),
          },
        },
      });
    },
    onSuccess: (res) => {
      const r = res as { diagnosis: string | null; error: string | null };
      if (r.error) toast.error(r.error);
      setDiagnosis(r.diagnosis);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const list = cacheQuery.data ?? [];
    return {
      compressor: list.filter((s) => s.component_type === "compressor"),
      fan: list.filter((s) => s.component_type === "fan"),
      coil: list.filter((s) => s.component_type === "coil"),
      valve: list.filter((s) => s.component_type === "valve"),
    };
  }, [cacheQuery.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Sugestões a partir do Catálogo CN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Buscar modelo CN</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex: UCR, MCS-90…"
                className="pl-8"
              />
            </div>
            {searchQuery.data && search.length >= 2 && (
              <ScrollArea className="mt-2 h-40 rounded border">
                {searchQuery.data.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">Nada encontrado.</p>
                ) : (
                  <ul className="divide-y">
                    {searchQuery.data.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCurve(c);
                            setSearch("");
                          }}
                          className="flex w-full items-center justify-between p-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-mono">{c.modelo}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.refrigerante ?? "—"} · {c.hp ?? "—"} HP · {c.linha ?? "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            )}
          </div>

          {selectedCurve && (
            <>
              <div className="flex items-center justify-between rounded border bg-muted/50 p-3 text-sm">
                <div>
                  <p className="font-mono">{selectedCurve.modelo}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCurve.refrigerante ?? "—"} · {selectedCurve.hp ?? "—"} HP ·{" "}
                    {selectedCurve.total_pontos ?? selectedCurve.curva_json?.length ?? 0} pontos
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCurve(null)}>
                  Trocar
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Qtd. ventiladores</Label>
                  <Input type="number" min={1} value={fanCount} onChange={(e) => setFanCount(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Vazão total (m³/h)</Label>
                  <Input type="number" value={airflow} onChange={(e) => setAirflow(e.target.value)} placeholder="opcional" />
                </div>
                <div>
                  <Label className="text-xs">Pressão req. (Pa)</Label>
                  <Input type="number" value={pressure} onChange={(e) => setPressure(e.target.value)} placeholder="opcional" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => generateMut.mutate(false)} disabled={generateMut.isPending}>
                  {generateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Sugerir componentes
                </Button>
                <Button variant="outline" onClick={() => generateMut.mutate(true)} disabled={generateMut.isPending}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Recalcular
                </Button>
                <Button
                  variant="outline"
                  onClick={() => diagnoseMut.mutate()}
                  disabled={diagnoseMut.isPending || !cacheQuery.data?.some((s) => s.status === "accepted")}
                >
                  {diagnoseMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
                  Diagnóstico IA
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedCurve && (cacheQuery.data?.length ?? 0) > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="compressor">
              <TabsList>
                <TabsTrigger value="compressor">Compressor ({grouped.compressor.length})</TabsTrigger>
                <TabsTrigger value="fan">Ventilador ({grouped.fan.length})</TabsTrigger>
                <TabsTrigger value="coil">Serpentina ({grouped.coil.length})</TabsTrigger>
                <TabsTrigger value="valve">Válvula ({grouped.valve.length})</TabsTrigger>
              </TabsList>
              {(["compressor", "fan", "coil", "valve"] as const).map((t) => (
                <TabsContent key={t} value={t} className="mt-4">
                  <SuggestionList
                    items={grouped[t]}
                    onAccept={(id) => statusMut.mutate({ id, status: "accepted" })}
                    onReject={(id) => statusMut.mutate({ id, status: "rejected" })}
                    onReset={(id) => statusMut.mutate({ id, status: "suggested" })}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {diagnosis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diagnóstico técnico (IA)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm">{diagnosis}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuggestionList({
  items,
  onAccept,
  onReject,
  onReset,
}: {
  items: SuggestionRow[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onReset: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma sugestão para este tipo.</p>;
  }
  return (
    <ul className="divide-y">
      {items.map((s) => {
        const reason = s.reason_json as { label?: string; manufacturer?: string; model?: string; motivo?: string[] };
        const motivos = Array.isArray(reason.motivo) ? reason.motivo : [];
        return (
          <li key={s.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">#{s.ranking}</Badge>
                <Badge variant={TIER_VARIANT[s.tier]}>{TIER_LABEL[s.tier]}</Badge>
                <Badge variant={STATUS_VARIANT[s.status]} className="capitalize">{s.status}</Badge>
                <span className="text-sm font-medium">{reason.label ?? `${reason.manufacturer ?? "—"} ${reason.model ?? ""}`}</span>
                <span className="text-xs text-muted-foreground">score {(s.score * 100).toFixed(0)}%</span>
              </div>
              {motivos.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {motivos.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {s.status !== "accepted" && (
                <Button size="sm" variant="default" onClick={() => onAccept(s.id)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Aceitar
                </Button>
              )}
              {s.status !== "rejected" && (
                <Button size="sm" variant="ghost" onClick={() => onReject(s.id)}>
                  <XCircle className="mr-1 h-4 w-4" /> Rejeitar
                </Button>
              )}
              {s.status !== "suggested" && (
                <Button size="sm" variant="ghost" onClick={() => onReset(s.id)}>
                  Reset
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
