/**
 * TechnicalComponentDetailDrawer
 *
 * Drawer (Sheet) de inspeção técnica de um componente da Biblioteca Técnica
 * Universal. Mostra cabeçalho com identidade + classificação e abas internas:
 *   - Resumo               (descrição técnica conforme entity_type)
 *   - Dados Normalizados   (normalized_json, copiável)
 *   - Dados Brutos         (raw_record + arquivo/tabela/linha de origem)
 *   - Curvas / Polinômios  (busca em compressor_polynomials, fan_curves, refrigerant_polynomials, coil_geometry_factors)
 *   - Aplicação no Motor   (texto explicando como o motor consome o componente)
 *   - Histórico            (created_at / updated_at / approved_at / batch)
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ContextBadge } from "@/components/coldpro/context-badge";
import { supabase } from "@/integrations/supabase/client";
import type { TechnicalComponent } from "@/modules/coldpro/library/types";

// ---------- helpers ----------

const ENGINE_USAGE: Record<string, string> = {
  compressor:
    "Usado por compressorEngine via compressor_polynomials. Entrada: Tevap, Tcond, refrigerante. Saída: capacidade, potência, corrente e COP.",
  fan: "Usado por fanEngine via fan_curves. Entrada: pressão requerida e densidade do ar. Saída: vazão, potência e ponto de operação.",
  evaporator_coil:
    "Usado por thermalcalc/hybridCoilEngine. Entrada: geometria, ar, refrigerante e condições térmicas. Saída: Q, U, h_air, h_ref e ΔP.",
  condenser_coil:
    "Usado por thermalcalc/hybridCoilEngine. Entrada: geometria, ar, refrigerante e condições térmicas. Saída: Q, U, h_air, h_ref e ΔP.",
  refrigerant:
    "Usado por thermalcalc para propriedades termofísicas por temperatura via refrigerant_polynomials.",
  fluid:
    "Usado por thermalcalc como fluido secundário — propriedades termofísicas por temperatura.",
  expansion_valve:
    "Usada por valveEngine para vazão mássica, queda de pressão e compatibilidade com refrigerante.",
  solenoid_valve:
    "Usada como elemento de controle on/off — Kv/Cv e compatibilidade com refrigerante.",
  hot_gas_valve:
    "Usada para gestão de degelo a gás quente — Kv/Cv, faixa de pressão e compatibilidade.",
};

function copyJson(obj: unknown) {
  navigator.clipboard
    .writeText(JSON.stringify(obj, null, 2))
    .then(() => toast.success("JSON copiado."))
    .catch(() => toast.error("Falha ao copiar."));
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function val(obj: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v as string | number;
  }
  return undefined;
}

// ---------- summary by entity_type ----------

function SummaryByEntity({ component }: { component: TechnicalComponent }) {
  const n = component.normalized_json ?? {};
  const e = component.entity_type;

  if (e === "compressor") {
    return (
      <div className="space-y-1">
        <FieldRow label="Tipo de compressor" value={val(n, "compressor_type", "type") as React.ReactNode} />
        <FieldRow label="Refrigerantes compatíveis" value={(component.compatible_refrigerants_json ?? []).join(", ") || "—"} />
        <FieldRow label="Tevap (min/max)" value={`${val(n, "temp_evap_min_c") ?? "—"} / ${val(n, "temp_evap_max_c") ?? "—"} °C`} />
        <FieldRow label="Tcond (min/max)" value={`${val(n, "temp_cond_min_c") ?? "—"} / ${val(n, "temp_cond_max_c") ?? "—"} °C`} />
        <FieldRow label="Capacidade nominal" value={val(n, "nominal_capacity_w", "capacity_w") as React.ReactNode} />
        <FieldRow label="Potência nominal" value={val(n, "nominal_power_w", "power_w") as React.ReactNode} />
        <FieldRow label="Displacement" value={val(n, "displacement", "displacement_cm3") as React.ReactNode} />
      </div>
    );
  }
  if (e === "fan") {
    return (
      <div className="space-y-1">
        <FieldRow label="Tipo de ventilador" value={val(n, "fan_type", "type") as React.ReactNode} />
        <FieldRow label="Vazão nominal (m³/h)" value={val(n, "nominal_airflow_m3h", "airflow_m3h") as React.ReactNode} />
        <FieldRow label="Pressão nominal (Pa)" value={val(n, "nominal_pressure_pa", "pressure_pa") as React.ReactNode} />
        <FieldRow label="Potência (W)" value={val(n, "nominal_power_w", "power_w") as React.ReactNode} />
        <FieldRow label="Diâmetro (mm)" value={val(n, "diameter_mm", "diameter") as React.ReactNode} />
      </div>
    );
  }
  if (e === "evaporator_coil" || e === "condenser_coil") {
    return (
      <div className="space-y-1">
        <FieldRow label="Geometry code" value={val(n, "geometry_code", "code") as React.ReactNode} />
        <FieldRow label="Modo" value={val(n, "mode") as React.ReactNode} />
        <FieldRow label="Tipo de aleta" value={val(n, "fin_type") as React.ReactNode} />
        <FieldRow label="Tipo de tubo" value={val(n, "tube_type") as React.ReactNode} />
        <FieldRow label="Tube OD (mm)" value={val(n, "tube_outer_diameter_mm", "tube_od_mm") as React.ReactNode} />
        <FieldRow label="Fin pitch (mm)" value={val(n, "fin_pitch_mm") as React.ReactNode} />
        <FieldRow label="Rows / Circuits" value={`${val(n, "rows") ?? "—"} / ${val(n, "circuits") ?? "—"}`} />
      </div>
    );
  }
  if (e === "refrigerant" || e === "fluid") {
    return (
      <div className="space-y-1">
        <FieldRow label="Código" value={val(n, "code") as React.ReactNode} />
        <FieldRow label="Nome" value={val(n, "name") as React.ReactNode} />
        <FieldRow label="Família" value={val(n, "family") as React.ReactNode} />
        <FieldRow label="GWP" value={val(n, "gwp") as React.ReactNode} />
        <FieldRow label="ODP" value={val(n, "odp") as React.ReactNode} />
        <FieldRow label="Tipo" value={val(n, "type", "fluid_type") as React.ReactNode} />
      </div>
    );
  }
  if (e === "expansion_valve" || e === "solenoid_valve" || e === "hot_gas_valve") {
    return (
      <div className="space-y-1">
        <FieldRow label="Tipo" value={val(n, "valve_type", "type") as React.ReactNode} />
        <FieldRow label="Kv / Cv" value={`${val(n, "kv") ?? "—"} / ${val(n, "cv") ?? "—"}`} />
        <FieldRow label="Capacidade nominal" value={val(n, "nominal_capacity_w", "capacity_w") as React.ReactNode} />
        <FieldRow label="Faixa de pressão (bar)" value={`${val(n, "pressure_min_bar") ?? "—"} – ${val(n, "pressure_max_bar") ?? "—"}`} />
        <FieldRow label="Refrigerantes compatíveis" value={(component.compatible_refrigerants_json ?? []).join(", ") || "—"} />
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Sem template de resumo para esta entidade. Veja a aba “Dados Normalizados”.
    </p>
  );
}

// ---------- raw record query ----------

function useRawRecord(rawId: string | null) {
  return useQuery({
    enabled: !!rawId,
    queryKey: ["tech-raw", rawId],
    queryFn: async () => {
      if (!rawId) return null;
      const { data } = await supabase
        .from("technical_raw_records")
        .select("*")
        .eq("id", rawId)
        .maybeSingle();
      return data;
    },
  });
}

function useBatch(batchId: string | null) {
  return useQuery({
    enabled: !!batchId,
    queryKey: ["tech-batch", batchId],
    queryFn: async () => {
      if (!batchId) return null;
      const { data } = await supabase
        .from("technical_import_batches")
        .select("*")
        .eq("id", batchId)
        .maybeSingle();
      return data;
    },
  });
}

// ---------- curves / polynomials by entity ----------

function CurvesAndPolynomials({ component }: { component: TechnicalComponent }) {
  const e = component.entity_type;
  const code = component.code ?? component.model ?? "";

  const compPolys = useQuery({
    enabled: e === "compressor",
    queryKey: ["compressor-polys", component.id, code],
    queryFn: async () => {
      // tenta por compressor_id (raro hoje) e por raw_json/code
      const { data } = await supabase
        .from("compressor_polynomials")
        .select("id, curve_type, unit_system, coefficients_json, temp_evap_min_c, temp_evap_max_c, temp_cond_min_c, temp_cond_max_c");
      return (data ?? []).filter((row) => {
        const raw = (row as { raw_json?: unknown }).raw_json as Record<string, unknown> | undefined;
        if (!raw) return false;
        const m = String(raw.model ?? raw.code ?? "").toUpperCase();
        return m && code && m === code.toUpperCase();
      });
    },
  });

  const fanCurves = useQuery({
    enabled: e === "fan",
    queryKey: ["fan-curves", component.id, code],
    queryFn: async () => {
      const { data } = await supabase.from("fan_curves").select("*");
      return (data ?? []).filter((row) => {
        const raw = (row.raw_json ?? {}) as Record<string, unknown>;
        const m = String(raw.model ?? raw.code ?? "").toUpperCase();
        return m && code && m === code.toUpperCase();
      });
    },
  });

  const refPolys = useQuery({
    enabled: e === "refrigerant" || e === "fluid",
    queryKey: ["ref-polys", component.id, code],
    queryFn: async () => {
      const { data } = await supabase
        .from("refrigerant_polynomials")
        .select("id, property_name, phase, temp_min_c, temp_max_c, c0, c1, c2, c3, c4, c5, c6, refrigerant_code")
        .eq("refrigerant_code", code)
        .limit(50);
      return data ?? [];
    },
  });

  const coilFactors = useQuery({
    enabled: e === "evaporator_coil" || e === "condenser_coil",
    queryKey: ["coil-factors", component.id, code],
    queryFn: async () => {
      const { data } = await supabase
        .from("coil_geometry_factors")
        .select("id, geometry_code, mode, fattore_attr_aria, fat_cor_al, fat_coef_lato_tubo, fat_rid_aum_sup, security_factor")
        .eq("geometry_code", code)
        .limit(20);
      return data ?? [];
    },
  });

  const isLoading =
    compPolys.isFetching || fanCurves.isFetching || refPolys.isFetching || coilFactors.isFetching;

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando curvas…
      </p>
    );
  }

  if (e === "compressor") {
    const list = compPolys.data ?? [];
    if (list.length === 0)
      return <p className="text-sm text-muted-foreground">Nenhum polinômio encontrado para “{code}”.</p>;
    return (
      <div className="space-y-3">
        {list.map((p) => (
          <div key={p.id} className="rounded-md border p-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">{p.curve_type}</span>
              <Badge variant="outline">{p.unit_system ?? "—"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Tevap [{p.temp_evap_min_c ?? "—"}, {p.temp_evap_max_c ?? "—"}] · Tcond [
              {p.temp_cond_min_c ?? "—"}, {p.temp_cond_max_c ?? "—"}]
            </p>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
              {JSON.stringify(p.coefficients_json, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    );
  }
  if (e === "fan") {
    const list = fanCurves.data ?? [];
    if (list.length === 0)
      return <p className="text-sm text-muted-foreground">Nenhuma curva encontrada para “{code}”.</p>;
    return (
      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="rounded-md border p-3 text-sm">
            <div className="mb-1 font-medium">{c.curve_type}</div>
            <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
              {JSON.stringify(c.coefficients_json ?? c.table_data_json, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    );
  }
  if (e === "refrigerant" || e === "fluid") {
    const list = refPolys.data ?? [];
    if (list.length === 0)
      return <p className="text-sm text-muted-foreground">Nenhum polinômio encontrado para “{code}”.</p>;
    return (
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className="rounded-md border p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">{p.property_name}</span>
              <Badge variant="outline">{p.phase ?? "—"}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              T [{p.temp_min_c ?? "—"}, {p.temp_max_c ?? "—"}] °C
            </p>
            <p className="mt-1 font-mono">
              c0={p.c0} · c1={p.c1} · c2={p.c2} · c3={p.c3}
            </p>
          </div>
        ))}
      </div>
    );
  }
  if (e === "evaporator_coil" || e === "condenser_coil") {
    const list = coilFactors.data ?? [];
    if (list.length === 0)
      return <p className="text-sm text-muted-foreground">Nenhum fator Unilab encontrado para “{code}”.</p>;
    return (
      <div className="space-y-2">
        {list.map((f) => (
          <div key={f.id} className="rounded-md border p-3 text-xs">
            <div className="font-medium">
              {f.geometry_code} · {f.mode}
            </div>
            <p className="mt-1">
              FattoreAttrAria={f.fattore_attr_aria} · FatCorAl={f.fat_cor_al} · FatCoefTubo=
              {f.fat_coef_lato_tubo} · FatRidAumSup={f.fat_rid_aum_sup} · Security=
              {f.security_factor}
            </p>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">Sem curvas associadas a esta entidade.</p>;
}

// ---------- main drawer ----------

export interface TechnicalComponentDetailDrawerProps {
  component: TechnicalComponent | null;
  onClose: () => void;
}

export function TechnicalComponentDetailDrawer({
  component,
  onClose,
}: TechnicalComponentDetailDrawerProps) {
  const [tab, setTab] = useState("summary");
  const open = component !== null;

  const rawQ = useRawRecord(component?.source_raw_id ?? null);
  const batchQ = useBatch(component?.source_batch_id ?? null);

  const usageText = useMemo(
    () => (component ? ENGINE_USAGE[component.entity_type] ?? "Sem descrição de uso." : ""),
    [component],
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-hidden p-0 sm:max-w-2xl">
        {component && (
          <div className="flex h-full flex-col">
            <SheetHeader className="space-y-2 border-b p-4">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {component.entity_type}
                </Badge>
                <span>{component.manufacturer ?? "—"}</span>
                <span className="text-muted-foreground">·</span>
                <span>{component.model ?? component.code ?? "—"}</span>
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{component.source ?? "—"}</Badge>
                <ContextBadge context={component.context} />
                <Badge variant="outline">{component.status}</Badge>
                {component.code && (
                  <span className="text-muted-foreground">code: {component.code}</span>
                )}
              </div>
            </SheetHeader>

            <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
              <TabsList className="m-3 flex w-auto flex-wrap justify-start">
                <TabsTrigger value="summary">Resumo</TabsTrigger>
                <TabsTrigger value="normalized">Normalizado</TabsTrigger>
                <TabsTrigger value="raw">Bruto</TabsTrigger>
                <TabsTrigger value="curves">Curvas / Polinômios</TabsTrigger>
                <TabsTrigger value="engine">Aplicação no Motor</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <div className="space-y-4 p-4 pt-0">
                  <TabsContent value="summary" className="m-0">
                    <SummaryByEntity component={component} />
                  </TabsContent>

                  <TabsContent value="normalized" className="m-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Visualização somente leitura. A edição por campo será adicionada em uma próxima rodada.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => copyJson(component.normalized_json)}>
                        <Copy className="mr-1 h-3 w-3" /> Copiar JSON
                      </Button>
                    </div>
                    <pre className="max-h-[60vh] overflow-auto rounded border bg-muted p-3 text-[11px]">
                      {JSON.stringify(component.normalized_json ?? {}, null, 2)}
                    </pre>
                  </TabsContent>

                  <TabsContent value="raw" className="m-0 space-y-2">
                    {!component.source_raw_id && (
                      <p className="text-sm text-muted-foreground">
                        Este componente não tem registro raw associado (provavelmente migrado de tabela legada).
                      </p>
                    )}
                    {component.source_raw_id && rawQ.isLoading && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                      </p>
                    )}
                    {rawQ.data && (
                      <>
                        <div className="space-y-1 rounded border p-3 text-xs">
                          <FieldRow label="Arquivo" value={rawQ.data.source_file ?? "—"} />
                          <FieldRow label="Tabela" value={rawQ.data.source_table ?? "—"} />
                          <FieldRow label="Linha" value={rawQ.data.row_index ?? "—"} />
                          <FieldRow
                            label="Importado em"
                            value={new Date(rawQ.data.created_at).toLocaleString()}
                          />
                          <FieldRow label="Batch" value={batchQ.data?.source_name ?? component.source_batch_id ?? "—"} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">raw_json</span>
                          <Button size="sm" variant="outline" onClick={() => copyJson(rawQ.data?.raw_json)}>
                            <Copy className="mr-1 h-3 w-3" /> Copiar
                          </Button>
                        </div>
                        <pre className="max-h-[50vh] overflow-auto rounded border bg-muted p-3 text-[11px]">
                          {JSON.stringify(rawQ.data.raw_json ?? {}, null, 2)}
                        </pre>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="curves" className="m-0">
                    <CurvesAndPolynomials component={component} />
                  </TabsContent>

                  <TabsContent value="engine" className="m-0 space-y-3">
                    <p className="text-sm">{usageText}</p>
                    <Separator />
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Regra de uso:</span>{" "}
                        o motor consome apenas componentes com status <code>approved</code> ou{" "}
                        <code>validated</code> e contexto <code>cn_standard</code> ou{" "}
                        <code>validated</code>.
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Status atual:</span>{" "}
                        {component.status} · <ContextBadge context={component.context} />
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="m-0">
                    <div className="space-y-1 rounded border p-3 text-xs">
                      <FieldRow label="Criado em" value={new Date(component.created_at).toLocaleString()} />
                      <FieldRow label="Atualizado em" value={new Date(component.updated_at).toLocaleString()} />
                      <FieldRow
                        label="Aprovado em"
                        value={component.approved_at ? new Date(component.approved_at).toLocaleString() : "—"}
                      />
                      <FieldRow label="Aprovado por" value={component.approved_by ?? "—"} />
                      <FieldRow label="Batch de origem" value={component.source_batch_id ?? "—"} />
                      <FieldRow label="Mapped de origem" value={component.source_mapped_id ?? "—"} />
                      <FieldRow label="Raw de origem" value={component.source_raw_id ?? "—"} />
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
