import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Search, Wand2, BookOpen, ExternalLink, Calculator } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { listApprovedComponents } from "@/lib/coldpro/technical-library";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { EquipmentProject } from "@/lib/coldpro/equipment-projects";

interface Props {
  project: EquipmentProject;
}

interface Candidate {
  id: string;
  geometry_code: string;
  description: string | null;
  rows: number | null;
  fin_pitch_mm: number | null;
  tube_outer_diameter_mm: number | null;
  circuits: number | null;
  mode: string;
  /** estimated capacity (heuristic) in W */
  estimated_capacity_w: number;
  /** 0..1 fit score */
  score: number;
  reason: string;
}

const MODE_OPTIONS = [
  { value: "cooling", label: "Cooling (evaporador)" },
  { value: "condensing", label: "Condensing (condensador)" },
  { value: "direct_expansion", label: "Direct expansion" },
  { value: "pump_evaporator", label: "Pump evaporator" },
  { value: "heating", label: "Heating" },
];

export function SizingTab({ project }: Props) {
  const [mode, setMode] = useState<string>("cooling");
  const [targetCapW, setTargetCapW] = useState(
    project.target_capacity ? String(project.target_capacity) : "5000",
  );
  const [airTempIn, setAirTempIn] = useState("0");
  const [evapTemp, setEvapTemp] = useState(
    project.target_temperature != null ? String(project.target_temperature - 8) : "-8",
  );
  const [airflow, setAirflow] = useState("3000");
  const [search, setSearch] = useState(false);

  const { data: candidates, isFetching } = useQuery<Candidate[]>({
    enabled: search,
    queryKey: ["sizing-auto", mode, targetCapW, airTempIn, evapTemp, airflow],
    queryFn: async () => {
      const target = Number(targetCapW);
      const dt = Math.max(2, Number(airTempIn) - Number(evapTemp));
      const airflowM3h = Number(airflow);

      // Heurística: top 50 geometrias do modo, ranking por proximidade de
      // capacidade estimada (grossa) e penalização por circuitos extremos.
      const { data, error } = await supabase
        .from("unilab_geometries")
        .select(
          "id, geometry_code, description, rows, fin_pitch_mm, tube_outer_diameter_mm, circuits, mode",
        )
        .eq("mode", mode)
        .limit(200);
      if (error) throw error;

      const ranked: Candidate[] = (data ?? [])
        .map((g) => {
          // capacidade estimada grosseira: U_assumed × área_proxy × DTML
          // área_proxy ≈ rows * (1/fin_pitch_mm) * 0.3 m² por linha-tubo
          const rows = g.rows ?? 2;
          const finPitch = g.fin_pitch_mm ?? 2.1;
          const tubeOd = g.tube_outer_diameter_mm ?? 9.52;
          const areaProxy = rows * (1 / finPitch) * 0.35 * (tubeOd / 9.52);
          const U = 35; // W/m²K assumido
          const estimated = U * areaProxy * dt * (airflowM3h / 3000);

          const ratio = estimated / target;
          // score quanto mais próximo de 1, melhor
          const proximity = 1 - Math.min(1, Math.abs(1 - ratio));
          const circuitsPen = g.circuits && (g.circuits < 2 || g.circuits > 16) ? 0.85 : 1;
          const score = Math.max(0, Math.min(1, proximity * circuitsPen));

          let reason = "ok";
          if (ratio < 0.8) reason = "subdimensionado (~" + Math.round(ratio * 100) + "%)";
          else if (ratio > 1.3) reason = "superdimensionado (~" + Math.round(ratio * 100) + "%)";
          else reason = "fit ~" + Math.round(ratio * 100) + "%";

          return {
            id: g.id,
            geometry_code: g.geometry_code,
            description: g.description,
            rows: g.rows,
            fin_pitch_mm: g.fin_pitch_mm,
            tube_outer_diameter_mm: g.tube_outer_diameter_mm,
            circuits: g.circuits,
            mode: g.mode,
            estimated_capacity_w: Math.round(estimated),
            score,
            reason,
          } satisfies Candidate;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

      return ranked;
    },
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="auto">
        <TabsList>
          <TabsTrigger value="auto">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Modo automático
          </TabsTrigger>
          <TabsTrigger value="manual">Modo manual</TabsTrigger>
        </TabsList>

        <TabsContent value="auto" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inputs do dimensionamento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Modo Unilab
                </Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Capacidade alvo (W)
                </Label>
                <Input
                  type="number"
                  value={targetCapW}
                  onChange={(e) => setTargetCapW(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Vazão de ar (m³/h)
                </Label>
                <Input
                  type="number"
                  value={airflow}
                  onChange={(e) => setAirflow(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  T. ar entrada (°C)
                </Label>
                <Input
                  type="number"
                  value={airTempIn}
                  onChange={(e) => setAirTempIn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  T. evap/cond (°C)
                </Label>
                <Input
                  type="number"
                  value={evapTemp}
                  onChange={(e) => setEvapTemp(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={() => setSearch(true)}
                  disabled={isFetching}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {isFetching ? "Buscando…" : "Dimensionar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {search && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Geometrias candidatas (top 15)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isFetching ? (
                  <p className="text-sm text-muted-foreground">Calculando ranking…</p>
                ) : !candidates || candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma geometria compatível encontrada para o modo{" "}
                    <strong>{mode}</strong>. Verifique se o banco Unilab está
                    importado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {candidates.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <p className="truncate text-sm font-medium">
                              {c.geometry_code}
                            </p>
                            <Badge
                              variant={c.score >= 0.7 ? "default" : "secondary"}
                            >
                              {Math.round(c.score * 100)}%
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {c.rows ?? "?"} fileiras · pitch {c.fin_pitch_mm ?? "?"} mm
                            · {c.circuits ?? "?"} circuitos · {c.reason}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            ~{(c.estimated_capacity_w / 1000).toFixed(1)} kW
                          </p>
                          <p className="text-xs text-muted-foreground">estimado</p>
                        </div>
                      </div>
                    ))}
                    <p className="pt-2 text-xs text-muted-foreground">
                      Ranking heurístico. Para validação real abra a aba
                      Evaporador/Condensador e simule a geometria escolhida com o
                      motor híbrido.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <ManualCoilDesignSection projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ManualCoilDesignSectionProps {
  projectId: string;
}

function ManualCoilDesignSection({ projectId }: ManualCoilDesignSectionProps) {
  const navigate = useNavigate();
  const [coilType, setCoilType] = useState<"evaporator" | "condenser">("evaporator");
  const [selectedLib, setSelectedLib] = useState<string>("");

  const { data: libraryComponents = [] } = useQuery({
    queryKey: ["library-coils", coilType],
    queryFn: () =>
      listApprovedComponents({
        entityType: coilType === "evaporator" ? "evaporator_coil" : "condenser_coil",
        limit: 100,
      }),
  });

  const openSimulator = (tab: "unilab" | "perfmap" | "save" = "unilab") => {
    localStorage.setItem(`coilsim:tab:${projectId}`, tab);
    navigate({
      to: "/coldpro/equipamentos/$id/coil-simulator",
      params: { id: projectId },
    });
  };

  const handleOpenWithLibrary = () => {
    if (!selectedLib) {
      toast.error("Selecione um componente da Biblioteca primeiro.");
      return;
    }
    const c = libraryComponents.find((x) => x.id === selectedLib);
    if (!c) return;
    const norm = (c.normalized_json ?? {}) as Record<string, unknown>;
    const num = (k: string): number | undefined => {
      const v = norm[k];
      if (v == null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const payload = {
      coilType,
      label: `${c.manufacturer ?? ""} ${c.model ?? c.code ?? ""}`.trim(),
      componentItemId: undefined,
      refrigerant: (norm.refrigerant as string) ?? undefined,
      geometry: {
        rows: num("rows"),
        tubesPerRow: num("tubes_per_row"),
        circuits: num("circuits"),
        coilLengthMm: num("length_mm"),
        finPitchMm: num("fin_pitch_mm"),
        tubeOdMm: num("tube_od_mm"),
        tubeIdMm: num("tube_id_mm"),
      },
    };
    localStorage.setItem(`coilsim:prefill:${projectId}`, JSON.stringify(payload));
    openSimulator("unilab");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4" /> Dimensionamento Manual de Aletado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Crie um aletado do zero ou parta de um componente já existente na Biblioteca.
          Toda a simulação é executada pelo motor <strong>thermalcalc</strong> (geometria → U → Q → ΔP).
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="text-xs">Tipo de aletado</Label>
            <Select value={coilType} onValueChange={(v) => { setSelectedLib(""); setCoilType(v as "evaporator" | "condenser"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="evaporator">Evaporador (DX)</SelectItem>
                <SelectItem value="condenser">Condensador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Selecionar da Biblioteca</Label>
            <Select value={selectedLib} onValueChange={setSelectedLib}>
              <SelectTrigger>
                <BookOpen className="mr-1 h-3.5 w-3.5" />
                <SelectValue placeholder={`Escolher ${coilType === "evaporator" ? "evaporador" : "condensador"} aprovado…`} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {libraryComponents.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">Nenhum item na biblioteca para este tipo.</div>
                ) : (
                  libraryComponents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {(c.manufacturer ?? "—")} · {c.model ?? c.code ?? c.id.slice(0, 8)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={() => openSimulator("unilab")}>
            <Wand2 className="mr-1 h-4 w-4" /> Novo aletado manual
          </Button>
          <Button variant="secondary" onClick={handleOpenWithLibrary} disabled={!selectedLib}>
            <BookOpen className="mr-1 h-4 w-4" /> Carregar selecionado e abrir
          </Button>
          <Button variant="outline" onClick={() => openSimulator("unilab")}>
            <Calculator className="mr-1 h-4 w-4" /> Abrir Coil Simulator
          </Button>
          <Button variant="ghost" onClick={() => openSimulator("perfmap")}>
            <ExternalLink className="mr-1 h-4 w-4" /> Simular / Salvar / Mapa de desempenho
          </Button>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Fluxo recomendado</p>
          <ol className="mt-1 list-decimal pl-5 space-y-0.5">
            <li>Escolha o tipo (evap/cond) e — opcional — um item da Biblioteca.</li>
            <li>No <em>Coil Simulator</em>, ajuste geometria, ar, refrigerante e clique <strong>Calcular</strong>.</li>
            <li>Use a aba <strong>Salvar componente</strong> para gravar (e opcionalmente publicar na Biblioteca).</li>
            <li>Depois, na aba <strong>Mapa de desempenho</strong>, gere o grid completo.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
