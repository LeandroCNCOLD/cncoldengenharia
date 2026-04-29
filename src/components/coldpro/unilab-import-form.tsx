import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, FileText, Trash2, CheckCircle2, ShieldCheck, Sparkles, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  deleteComponentFile,
  listComponentFiles,
  recordUnilabExtraction,
  updateComponent,
  uploadComponentFile,
} from "@/lib/coldpro/component-items";
import { useAuth } from "@/lib/auth";
import { sniffUnilabCoilType, type UnilabCoilType } from "@/modules/coldpro/unilab/unilabSniffer";
import { parseUnilabEvaporator } from "@/modules/coldpro/unilab/unilabEvaporatorParser";
import { parseUnilabCondenser } from "@/modules/coldpro/unilab/unilabCondenserParser";
import {
  buildEvaporatorPatch,
  buildCondenserPatch,
  type FieldSource,
  type ValidationReport,
} from "@/lib/coldpro/unilab-import";
import { COMPONENT_STATUS_COLORS, COMPONENT_STATUS_LABELS } from "@/lib/coldpro/labels";
// (Database type imported on demand by callers)

type ExpectedKind = "evaporator" | "condenser";

interface Props {
  componentId: string;
  expectedKind: ExpectedKind;
  componentCode: string | null;
  componentStatus: keyof typeof COMPONENT_STATUS_LABELS;
  /** Função que carrega o "row" atual (evap ou cond) — devolve null se não existe */
  fetchRow: () => Promise<Record<string, unknown> | null>;
  /** Faz upsert do patch no DB, retornando o row atualizado */
  upsertRow: (patch: Record<string, unknown> & { component_item_id: string }) => Promise<Record<string, unknown>>;
  /** Chave única pro react-query, ex.: ["evap-model", id] */
  queryKey: readonly unknown[];
}

/**
 * Formulário compartilhado entre evaporador e condensador, com:
 * - upload + sniff de tipo + parse Unilab
 * - preenchimento automático com badge "Unilab"
 * - edição manual campo a campo
 * - validação técnica e workflow imported → needs_review → validated → approved
 */
export function UnilabImportForm({
  componentId,
  expectedKind,
  componentCode,
  componentStatus,
  fetchRow,
  upsertRow,
  queryKey,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideMismatch, setOverrideMismatch] = useState(false);

  const { data: row, isLoading } = useQuery({
    queryKey,
    queryFn: fetchRow,
  });
  const { data: files = [] } = useQuery({
    queryKey: ["component-files", componentId],
    queryFn: () => listComponentFiles(componentId),
  });

  const sources = (row?.field_sources as Record<string, FieldSource>) || {};
  const report = (row?.validation_report as unknown as ValidationReport | undefined) ?? null;

  async function handleImport() {
    if (!file || !user) return;
    setBusy(true);
    try {
      // 1. Sniff
      const sniff = await sniffUnilabCoilType(file);
      if (
        sniff.type !== "unknown" &&
        sniff.type !== expectedKind &&
        !overrideMismatch
      ) {
        toast.error(
          `Datasheet detectado como ${sniff.type === "evaporator" ? "evaporador" : "condensador"}, mas a aba é de ${expectedKind === "evaporator" ? "evaporador" : "condensador"}.`,
          {
            description: "Marque a opção 'Importar mesmo assim' para forçar.",
          },
        );
        setBusy(false);
        return;
      }

      // 2. Upload original
      const uploaded = await uploadComponentFile({
        componentItemId: componentId,
        file,
        userId: user.id,
      });

      // 3. Parse correto
      let patchResult;
      let parserName: string;
      let warnings: string[];
      let confidenceScore: number;
      let missingFields: string[];
      let rawPreview: string;
      let rawFields: Record<string, unknown>;
      if (expectedKind === "evaporator") {
        const r = await parseUnilabEvaporator(file);
        parserName = "unilabEvaporator";
        warnings = r.warnings;
        confidenceScore = r.confidenceScore;
        missingFields = r.missingFields;
        rawPreview = r.rawPreview;
        rawFields = r.fields as Record<string, unknown>;
        patchResult = buildEvaporatorPatch({ fields: r.fields, existingRow: row ?? null });
      } else {
        const r = await parseUnilabCondenser(file);
        parserName = "unilabCondenser";
        warnings = r.warnings;
        confidenceScore = r.confidenceScore;
        missingFields = r.missingFields;
        rawPreview = r.rawPreview;
        rawFields = r.fields as Record<string, unknown>;
        patchResult = buildCondenserPatch({ fields: r.fields, existingRow: row ?? null });
      }

      // 4. Persiste row + extração
      await upsertRow({
        component_item_id: componentId,
        ...patchResult.patch,
        confidence_score: confidenceScore,
        missing_fields: missingFields as never,
        raw_fields: rawFields as never,
      });
      await recordUnilabExtraction({
        componentItemId: componentId,
        componentFileId: uploaded.id,
        parser: parserName,
        extractedFields: rawFields,
        warnings,
        rawPreview,
        success: warnings.length < 3,
        userId: user.id,
      });

      // 5. Status do componente
      // Se há campos mínimos completos → validated; caso contrário → needs_review.
      // imported é apenas marcador inicial.
      await updateComponent(componentId, {
        status: patchResult.report.ok ? "validated" : "needs_review",
        raw_fields: rawFields as never,
      });

      toast.success("Datasheet importado", {
        description: `${sniff.reason}. Confiança ${(confidenceScore * 100).toFixed(0)}% · ${
          patchResult.report.missingRequired.length
        } campo(s) obrigatórios faltando`,
      });
      setFile(null);
      setOverrideMismatch(false);
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["component-files", componentId] });
      qc.invalidateQueries({ queryKey: ["components"] });
    } catch (e) {
      toast.error("Falha ao importar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  const approve = useMutation({
    mutationFn: async () => {
      if (!report?.ok) throw new Error("Componente ainda não foi validado.");
      return updateComponent(componentId, { status: "approved" });
    },
    onSuccess: () => {
      toast.success("Componente aprovado");
      qc.invalidateQueries({ queryKey: ["components"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          {expectedKind === "evaporator" ? "Evaporador" : "Condensador"}
          {componentCode ? <span className="ml-2 text-xs text-muted-foreground">{componentCode}</span> : null}
          <Badge className={`ml-2 ${COMPONENT_STATUS_COLORS[componentStatus]}`} variant="secondary">
            {COMPONENT_STATUS_LABELS[componentStatus]}
          </Badge>
          {row?.confidence_score != null && (
            <Badge variant="outline" className="ml-2 text-xs">
              Confiança {(Number(row.confidence_score) * 100).toFixed(0)}%
            </Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => approve.mutate()}
          disabled={!report?.ok || componentStatus === "approved" || approve.isPending}
        >
          <ShieldCheck className="mr-1 h-4 w-4" />
          {componentStatus === "approved" ? "Aprovado" : "Aprovar componente"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Importação */}
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm font-medium">Importar datasheet Unilab</Label>
            <span className="text-xs text-muted-foreground">PDF, XLS ou XLSX</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="file"
              accept=".pdf,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
            <Button onClick={handleImport} disabled={!file || busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar
            </Button>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={overrideMismatch}
              onChange={(e) => setOverrideMismatch(e.target.checked)}
            />
            Importar mesmo se o tipo detectado for diferente
          </label>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {f.file_name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={async () => {
                      await deleteComponentFile(f.id, f.storage_path);
                      qc.invalidateQueries({ queryKey: ["component-files", componentId] });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Validação */}
        {report && (report.ok !== undefined || (report.issues?.length ?? 0) > 0) && (
          <div
            className={`rounded-md border p-3 text-xs ${
              report.ok
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
          >
            <div className="mb-1 flex items-center gap-2 font-semibold">
              {report.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Validado — campos mínimos preenchidos
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 text-amber-600" />
                  Necessita revisão
                </>
              )}
            </div>
            {(report.issues?.length ?? 0) > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {report.issues!.map((i, idx) => (
                  <li key={idx} className={i.level === "error" ? "text-rose-600" : "text-amber-600"}>
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(report.computed ?? {}).length > 0 && (
              <p className="mt-1 text-muted-foreground">
                Calculado:{" "}
                {Object.entries(report.computed)
                  .map(([k, v]) => `${k} = ${Number(v).toFixed(2)}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* Editor de campos com origem */}
        {row ? (
          <FieldEditor
            row={row}
            sources={sources}
            kind={expectedKind}
            onSave={async (patch) => {
              await upsertRow({ component_item_id: componentId, ...patch });
              qc.invalidateQueries({ queryKey });
              toast.success("Campo atualizado");
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Importe um datasheet Unilab para preencher os campos técnicos automaticamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// FieldEditor — exibe todos os campos agrupados, com badge da origem.
// =============================================================================

const EVAP_GROUPS: Array<{ title: string; fields: Array<[string, string, string]> }> = [
  {
    title: "Capacidades & desempenho",
    fields: [
      ["nominal_capacity_w", "Capacidade total", "W"],
      ["nominal_sensible_w", "Capacidade sensível", "W"],
      ["nominal_latent_w", "Capacidade latente", "W"],
      ["sensible_ratio", "Razão sensível/total", ""],
      ["water_production_kgh", "Água produzida", "kg/h"],
      ["surface_area_m2", "Área de troca", "m²"],
      ["global_coeff_w", "Coef. global", "W·kg/(m²·kJ)"],
      ["delta_h_log_kjkg", "ΔH médio log", "kJ/kg"],
      ["nominal_delta_t_k", "DT nominal", "K"],
      ["frontal_area_m2", "Área frontal estimada", "m²"],
    ],
  },
  {
    title: "Lado do ar",
    fields: [
      ["nominal_airflow_m3h", "Vazão volumétrica", "m³/h"],
      ["nominal_air_mass_flow_kgh", "Vazão mássica", "kg/h"],
      ["face_velocity_ms", "Velocidade frontal", "m/s"],
      ["air_density_in_kg_m3", "Densidade do ar", "kg/m³"],
      ["nominal_air_temp_in_c", "Tar entrada", "°C"],
      ["rh_in_pct", "UR entrada", "%"],
      ["spec_hum_in_g_kg", "Umid. esp. entrada", "g/kg"],
      ["enthalpy_in_kjkg", "Entalpia entrada", "kJ/kg"],
      ["nominal_air_temp_out_c", "Tar saída", "°C"],
      ["rh_out_pct", "UR saída", "%"],
      ["spec_hum_out_g_kg", "Umid. esp. saída", "g/kg"],
      ["enthalpy_out_kjkg", "Entalpia saída", "kJ/kg"],
      ["air_pressure_drop_pa", "ΔP ar", "Pa"],
      ["atm_pressure_bar", "Pressão atm.", "bar"],
      ["altitude_m", "Altitude", "m"],
    ],
  },
  {
    title: "Lado refrigerante",
    fields: [
      ["refrigerant", "Fluido", ""],
      ["refrigerant_mass_flow_kgh", "Fluxo de massa", "kg/h"],
      ["mass_velocity_kg_m2s", "Velocidade de massa", "kg/m²s"],
      ["vapour_velocity_ms", "Veloc. fase gasosa", "m/s"],
      ["liquid_velocity_ms", "Veloc. fase líquida", "m/s"],
      ["nominal_evap_temp_c", "T evaporação", "°C"],
      ["superheat_k", "Superaquecimento", "K"],
      ["subcooling_k", "Subresfriamento", "K"],
      ["refrigerant_pressure_drop_kpa", "ΔP fluido", "kPa"],
      ["manifold_pressure_drop_kpa", "ΔP coletor", "kPa"],
      ["total_ref_pressure_drop_kpa", "ΔP total fluido", "kPa"],
    ],
  },
  {
    title: "Geometria & materiais",
    fields: [
      ["rows", "Nº fileiras", ""],
      ["tubes_per_row", "Tubos por fileira", ""],
      ["circuits", "Nº circuitos", ""],
      ["length_mm", "Comprimento bateria", "mm"],
      ["fin_pitch_mm", "Passo das aletas", "mm"],
      ["fin_thickness_mm", "Espessura aletas", "mm"],
      ["tube_shape", "Formato tubo", ""],
      ["tube_od_mm", "Ø externo tubos", "mm"],
      ["tube_id_mm", "Ø interno tubos", "mm"],
      ["fin_material", "Material aletas", ""],
      ["tube_material", "Material tubos", ""],
      ["internal_volume_l", "Volume interno", "L"],
    ],
  },
];

const COND_GROUPS: Array<{ title: string; fields: Array<[string, string, string]> }> = [
  {
    title: "Capacidades & desempenho",
    fields: [
      ["nominal_capacity_w", "Capacidade total", "W"],
      ["surface_area_m2", "Área de troca", "m²"],
      ["global_coeff_w", "Coef. global", "W/(m²·K)"],
      ["delta_t_log_k", "ΔT médio log", "K"],
      ["nominal_delta_t_k", "DT nominal", "K"],
      ["frontal_area_m2", "Área frontal estimada", "m²"],
    ],
  },
  {
    title: "Lado do ar",
    fields: [
      ["nominal_airflow_m3h", "Vazão volumétrica", "m³/h"],
      ["air_mass_flow_kgh", "Vazão mássica", "kg/h"],
      ["face_velocity_ms", "Velocidade frontal", "m/s"],
      ["air_density_in_kg_m3", "Densidade do ar", "kg/m³"],
      ["nominal_air_temp_in_c", "Tar entrada", "°C"],
      ["rh_in_pct", "UR entrada", "%"],
      ["spec_hum_in_g_kg", "Umid. esp. entrada", "g/kg"],
      ["enthalpy_in_kjkg", "Entalpia entrada", "kJ/kg"],
      ["nominal_air_temp_out_c", "Tar saída", "°C"],
      ["rh_out_pct", "UR saída", "%"],
      ["spec_hum_out_g_kg", "Umid. esp. saída", "g/kg"],
      ["enthalpy_out_kjkg", "Entalpia saída", "kJ/kg"],
      ["air_pressure_drop_pa", "ΔP ar", "Pa"],
      ["atm_pressure_bar", "Pressão atm.", "bar"],
      ["altitude_m", "Altitude", "m"],
    ],
  },
  {
    title: "Lado refrigerante",
    fields: [
      ["refrigerant", "Fluido", ""],
      ["refrigerant_mass_flow_kgh", "Fluxo de massa", "kg/h"],
      ["mass_velocity_kg_m2s", "Velocidade de massa", "kg/m²s"],
      ["vapour_velocity_ms", "Veloc. fase gasosa", "m/s"],
      ["liquid_velocity_ms", "Veloc. fase líquida", "m/s"],
      ["nominal_cond_temp_c", "T condensação", "°C"],
      ["subcooling_k", "Subresfriamento", "K"],
      ["desuperheat_k", "Dessuperaquecimento", "K"],
      ["refrigerant_pressure_drop_kpa", "ΔP fluido", "kPa"],
      ["manifold_pressure_drop_kpa", "ΔP coletor", "kPa"],
      ["total_ref_pressure_drop_kpa", "ΔP total fluido", "kPa"],
    ],
  },
  {
    title: "Geometria & materiais",
    fields: [
      ["rows", "Nº fileiras", ""],
      ["tubes_per_row", "Tubos por fileira", ""],
      ["circuits", "Nº circuitos", ""],
      ["length_mm", "Comprimento bateria", "mm"],
      ["fin_pitch_mm", "Passo das aletas", "mm"],
      ["fin_thickness_mm", "Espessura aletas", "mm"],
      ["tube_shape", "Formato tubo", ""],
      ["tube_od_mm", "Ø externo tubos", "mm"],
      ["tube_id_mm", "Ø interno tubos", "mm"],
      ["fin_material", "Material aletas", ""],
      ["tube_material", "Material tubos", ""],
      ["internal_volume_l", "Volume interno", "L"],
    ],
  },
];

const TEXT_FIELDS = new Set(["refrigerant", "fin_material", "tube_material", "tube_shape"]);

function FieldEditor({
  row,
  sources,
  kind,
  onSave,
}: {
  row: Record<string, unknown>;
  sources: Record<string, FieldSource>;
  kind: ExpectedKind;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const groups = useMemo(() => (kind === "evaporator" ? EVAP_GROUPS : COND_GROUPS), [kind]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function commit(field: string) {
    setBusy(true);
    try {
      const overrides = { ...((row.manual_overrides as Record<string, boolean>) || {}) };
      overrides[field] = true;
      const newSources = { ...sources, [field]: "manual" as FieldSource };
      const value: unknown =
        draft === "" ? null : TEXT_FIELDS.has(field) ? draft : Number(draft);
      await onSave({
        [field]: value,
        manual_overrides: overrides as never,
        field_sources: newSources as never,
      });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.title} className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
            {g.title}
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {g.fields.map(([f, label, unit]) => {
              const v = row[f];
              const src = sources[f];
              const isEditing = editing === f;
              return (
                <div key={f} className="bg-background p-2.5 text-xs">
                  <div className="mb-0.5 flex items-center justify-between gap-1">
                    <span className="text-muted-foreground">{label}</span>
                    <SourceBadge source={src} />
                  </div>
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Button size="sm" className="h-7 px-2" onClick={() => commit(f)} disabled={busy}>
                        OK
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditing(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between text-left"
                      onClick={() => {
                        setDraft(v == null ? "" : String(v));
                        setEditing(f);
                      }}
                    >
                      <span className={`font-medium ${v == null ? "text-muted-foreground" : ""}`}>
                        {v == null
                          ? "—"
                          : typeof v === "number"
                            ? `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}${unit ? " " + unit : ""}`
                            : String(v)}
                      </span>
                      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceBadge({ source }: { source?: FieldSource }) {
  if (!source) return null;
  if (source === "unilab")
    return (
      <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[9px]">
        <Sparkles className="h-2.5 w-2.5" /> Unilab
      </Badge>
    );
  if (source === "calculated")
    return (
      <Badge variant="outline" className="h-4 px-1 text-[9px]">
        Calculado
      </Badge>
    );
  return (
    <Badge variant="outline" className="h-4 px-1 text-[9px]">
      Manual
    </Badge>
  );
}

