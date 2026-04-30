import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calculator, Snowflake, ThermometerSun, Wind } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  equipmentProjectId: string;
  refrigerant: string | null;
}

type CompItem = {
  id: string;
  kind: string;
  manufacturer: string | null;
  model: string | null;
  raw_fields: Record<string, unknown> | null;
};

type CoilRow = {
  rows: number | null;
  tubes_per_row: number | null;
  circuits: number | null;
  fin_pitch_mm: number | null;
  nominal_airflow_m3h: number | null;
  nominal_capacity_w: number | null;
  nominal_evap_temp_c?: number | null;
  nominal_cond_temp_c?: number | null;
};

async function loadOrigin(equipmentProjectId: string) {
  const { data: items } = await supabase
    .from("component_items")
    .select("id,kind,manufacturer,model,raw_fields")
    .eq("equipment_project_id", equipmentProjectId);
  const list = (items ?? []) as CompItem[];
  const fromCatalog = list.filter(
    (i) =>
      ((i.raw_fields as { source?: string } | null)?.source ?? "") === "cn_equipment_master",
  );
  if (fromCatalog.length === 0) return null;

  const evap = fromCatalog.find((i) => i.kind === "evaporador") ?? null;
  const cond = fromCatalog.find((i) => i.kind === "condensador") ?? null;
  const comp = fromCatalog.find((i) => i.kind === "compressor") ?? null;
  const catalogModel =
    ((evap ?? cond ?? comp)?.raw_fields as { catalog_model?: string } | null)?.catalog_model ??
    null;

  let evapModel: CoilRow | null = null;
  let condModel: CoilRow | null = null;
  if (evap) {
    const { data } = await supabase
      .from("evaporator_coil_models")
      .select(
        "rows,tubes_per_row,circuits,fin_pitch_mm,nominal_airflow_m3h,nominal_capacity_w,nominal_evap_temp_c",
      )
      .eq("component_item_id", evap.id)
      .maybeSingle();
    evapModel = (data as CoilRow | null) ?? null;
  }
  if (cond) {
    const { data } = await supabase
      .from("condenser_coil_models")
      .select(
        "rows,tubes_per_row,circuits,fin_pitch_mm,nominal_airflow_m3h,nominal_capacity_w,nominal_cond_temp_c",
      )
      .eq("component_item_id", cond.id)
      .maybeSingle();
    condModel = (data as CoilRow | null) ?? null;
  }

  return {
    catalogModel,
    evap,
    cond,
    comp,
    evapModel,
    condModel,
  };
}

function fmt(n: number | null | undefined, suffix = "", digits = 0) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}
function fmtKw(w: number | null | undefined) {
  if (w == null || !Number.isFinite(w)) return "—";
  return Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${w.toFixed(0)} W`;
}

export function Cn480OriginCard({ equipmentProjectId, refrigerant }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["cn480-origin", equipmentProjectId],
    queryFn: () => loadOrigin(equipmentProjectId),
    staleTime: 30_000,
  });

  if (isLoading || !data) return null;

  const { catalogModel, evap, cond, comp, evapModel, condModel } = data;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="gap-1 bg-primary text-primary-foreground">
                <BookOpen className="h-3 w-3" /> Origem: Catálogo 480
              </Badge>
              {refrigerant && <Badge variant="outline">{refrigerant}</Badge>}
            </div>
            <p className="mt-1.5 font-mono text-xs text-muted-foreground break-all">
              {catalogModel ?? "—"}
            </p>
          </div>
          <Button asChild size="sm">
            <Link
              to="/coldpro/equipamentos/$id/coil-simulator"
              params={{ id: equipmentProjectId }}
            >
              <Calculator className="mr-1 h-4 w-4" /> Abrir no Coil Simulator
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <OriginBlock
            icon={Snowflake}
            title="Evaporador"
            present={!!evap}
            lines={
              evapModel
                ? [
                    `${evapModel.rows ?? "?"}×${evapModel.tubes_per_row ?? "?"} · ${evapModel.circuits ?? "?"} circ.`,
                    `Aleta ${fmt(evapModel.fin_pitch_mm, " mm", 1)}`,
                    `Vazão ${fmt(evapModel.nominal_airflow_m3h, " m³/h")}`,
                    `Tevap ${fmt(evapModel.nominal_evap_temp_c, " °C", 1)} · ${fmtKw(evapModel.nominal_capacity_w)}`,
                  ]
                : []
            }
          />
          <OriginBlock
            icon={ThermometerSun}
            title="Condensador"
            present={!!cond}
            lines={
              condModel
                ? [
                    `${condModel.rows ?? "?"}×${condModel.tubes_per_row ?? "?"} · ${condModel.circuits ?? "?"} circ.`,
                    `Aleta ${fmt(condModel.fin_pitch_mm, " mm", 1)}`,
                    `Vazão ${fmt(condModel.nominal_airflow_m3h, " m³/h")}`,
                    `Tcond ${fmt(condModel.nominal_cond_temp_c, " °C", 1)} · ${fmtKw(condModel.nominal_capacity_w)}`,
                  ]
                : []
            }
          />
          <OriginBlock
            icon={Wind}
            title="Compressor"
            present={!!comp}
            lines={
              comp
                ? [`${comp.manufacturer ?? "—"} ${comp.model ?? ""}`.trim()]
                : []
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function OriginBlock({
  icon: Icon,
  title,
  present,
  lines,
}: {
  icon: typeof Snowflake;
  title: string;
  present: boolean;
  lines: string[];
}) {
  return (
    <div className="rounded border bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {title}
        {present ? (
          <Badge variant="outline" className="ml-auto h-5 border-emerald-500/40 px-1.5 text-[10px] text-emerald-700">
            Preenchido
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto h-5 px-1.5 text-[10px] text-muted-foreground">
            —
          </Badge>
        )}
      </div>
      <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        {lines.length === 0 ? (
          <li>Sem dados.</li>
        ) : (
          lines.map((l, i) => <li key={i}>{l}</li>)
        )}
      </ul>
    </div>
  );
}
