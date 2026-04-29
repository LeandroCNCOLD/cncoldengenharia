import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Search } from "lucide-react";

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
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>
                Modo manual: defina geometria completa (tubos, aletas, circuitos)
                diretamente nas abas <strong>Evaporador</strong> ou{" "}
                <strong>Condensador</strong> e use o <em>Coil Simulator</em> para
                rodar o motor híbrido com seus parâmetros.
              </p>
              <p>
                O modo manual reaproveita o mesmo motor de cálculo (geometria → área
                → correlação → U → Q → ΔP → calibração).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
