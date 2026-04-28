import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Upload, Loader2, Play, FileText, Plus, Trash2, CheckCircle2, History, Calculator } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createComponent,
  getEvaporatorCoilModel,
  listComponentFiles,
  listComponentsByKind,
  listCoilSimulations,
  recordCoilSimulation,
  recordUnilabExtraction,
  updateComponent,
  uploadComponentFile,
  upsertEvaporatorCoilModel,
  deleteComponentFile,
} from "@/lib/coldpro/component-items";
import { useAuth } from "@/lib/auth";
import { parseUnilabEvaporator } from "@/modules/coldpro/unilab/unilabEvaporatorParser";
import {
  simulateEvaporator,
  type EvaporatorSimulationResult,
} from "@/modules/coldpro/coil/evaporatorCoilSimulator";
import { COMPONENT_STATUS_COLORS, COMPONENT_STATUS_LABELS } from "@/lib/coldpro/labels";

interface Props {
  equipmentProjectId: string;
}

export function EvaporatorTab({ equipmentProjectId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: items = [] } = useQuery({
    queryKey: ["components", equipmentProjectId, "evaporador"],
    queryFn: () => listComponentsByKind(equipmentProjectId, "evaporador"),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      return createComponent({
        equipment_project_id: equipmentProjectId,
        kind: "evaporador",
        created_by: user.id,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["components", equipmentProjectId, "evaporador"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Evaporadores</h2>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar evaporador
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum evaporador cadastrado.
          </CardContent>
        </Card>
      ) : (
        items.map((c) => (
          <EvaporatorCard
            key={c.id}
            componentId={c.id}
            equipmentProjectId={equipmentProjectId}
            code={c.code}
            status={c.status}
          />
        ))
      )}
    </div>
  );
}

function EvaporatorCard({
  componentId,
  equipmentProjectId,
  code,
  status,
}: {
  componentId: string;
  equipmentProjectId: string;
  code: string | null;
  status: keyof typeof COMPONENT_STATUS_LABELS;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: model } = useQuery({
    queryKey: ["evap-model", componentId],
    queryFn: () => getEvaporatorCoilModel(componentId),
  });
  const { data: files = [] } = useQuery({
    queryKey: ["component-files", componentId],
    queryFn: () => listComponentFiles(componentId),
  });

  async function handleImport() {
    if (!file || !user) return;
    setBusy(true);
    try {
      const uploaded = await uploadComponentFile({
        componentItemId: componentId,
        file,
        userId: user.id,
      });
      const result = await parseUnilabEvaporator(file);
      await recordUnilabExtraction({
        componentItemId: componentId,
        componentFileId: uploaded.id,
        parser: "unilabEvaporator",
        extractedFields: result.fields as Record<string, unknown>,
        warnings: result.warnings,
        rawPreview: result.rawPreview,
        success: result.warnings.length < 3,
        userId: user.id,
      });

      const f = result.fields;
      const overrides = (model?.manual_overrides as Record<string, boolean>) || {};
      const skipped: string[] = [];
      // Helper: aplica valor do parser apenas se não foi editado manualmente
      const pick = <T,>(key: string, value: T | undefined | null): T | null => {
        if (overrides[key]) {
          if (value != null) skipped.push(key);
          return (model?.[key as keyof typeof model] as T) ?? null;
        }
        return (value ?? null) as T | null;
      };

      const dtNom =
        f.airTempInC != null && f.evapTempC != null ? f.airTempInC - f.evapTempC : null;

      await upsertEvaporatorCoilModel({
        component_item_id: componentId,
        nominal_capacity_w: pick("nominal_capacity_w", f.totalCapacityW),
        nominal_sensible_w: pick("nominal_sensible_w", f.sensibleCapacityW),
        nominal_latent_w: pick("nominal_latent_w", f.latentCapacityW),
        nominal_air_temp_in_c: pick("nominal_air_temp_in_c", f.airTempInC),
        nominal_air_temp_out_c: pick("nominal_air_temp_out_c", f.airTempOutC),
        nominal_evap_temp_c: pick("nominal_evap_temp_c", f.evapTempC),
        nominal_airflow_m3h: pick("nominal_airflow_m3h", f.airflowM3h),
        nominal_air_mass_flow_kgh: pick("nominal_air_mass_flow_kgh", f.airMassFlowKgh),
        nominal_delta_t_k: pick("nominal_delta_t_k", dtNom),
        face_velocity_ms: pick("face_velocity_ms", f.frontalVelocityMs),
        air_pressure_drop_pa: pick("air_pressure_drop_pa", f.airPressureDropPa),
        refrigerant_pressure_drop_kpa: pick(
          "refrigerant_pressure_drop_kpa",
          f.refrigerantPressureDropKpa,
        ),
        superheat_k: pick("superheat_k", f.superheatK),
        subcooling_k: pick("subcooling_k", f.subcoolingK),
        refrigerant: pick("refrigerant", f.refrigerant),
        rows: pick("rows", f.rows),
        tubes_per_row: pick("tubes_per_row", f.tubesPerRow),
        circuits: pick("circuits", f.circuits),
        length_mm: pick("length_mm", f.lengthMm),
        fin_pitch_mm: pick("fin_pitch_mm", f.finPitchMm),
        tube_od_mm: pick("tube_od_mm", f.tubeOdMm),
        tube_id_mm: pick("tube_id_mm", f.tubeIdMm),
        fin_material: pick("fin_material", f.finMaterial),
        tube_material: pick("tube_material", f.tubeMaterial),
        surface_area_m2: pick("surface_area_m2", f.surfaceAreaM2),
        internal_volume_l: pick("internal_volume_l", f.internalVolumeL),
        confidence_score: result.confidenceScore,
        missing_fields: result.missingFields as never,
        manual_overrides: overrides as never,
        raw_fields: f as never,
      });
      await updateComponent(componentId, {
        status: "imported",
        raw_fields: f as never,
      });
      toast.success("Datasheet importado", {
        description: `Confiança ${(result.confidenceScore * 100).toFixed(0)}% · ${
          result.missingFields.length
        } campo(s) ausentes${skipped.length ? ` · ${skipped.length} preservados manualmente` : ""}`,
      });
      setFile(null);
      qc.invalidateQueries({ queryKey: ["evap-model", componentId] });
      qc.invalidateQueries({ queryKey: ["component-files", componentId] });
    } catch (e) {
      toast.error("Falha ao importar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          Evaporador
          <Badge className={`ml-2 ${COMPONENT_STATUS_COLORS[status]}`} variant="secondary">
            {COMPONENT_STATUS_LABELS[status]}
          </Badge>
          {model?.confidence_score != null && (
            <Badge variant="outline" className="ml-2 text-xs">
              Confiança {(Number(model.confidence_score) * 100).toFixed(0)}%
            </Badge>
          )}
        </CardTitle>
        <Button
          asChild
          variant="outline"
          size="sm"
          onClick={() => {
            if (model?.nominal_capacity_w) {
              localStorage.setItem(
                `coilsim:prefill:${equipmentProjectId}`,
                JSON.stringify({
                  coilType: "evaporator",
                  componentItemId: componentId,
                  label: `Evap ${code ?? componentId.slice(0, 6)}`,
                  nominal: {
                    capacityW: Number(model.nominal_capacity_w),
                    airTempInC: Number(model.nominal_air_temp_in_c ?? 0),
                    refTempC: Number(model.nominal_evap_temp_c ?? 0),
                    airflowM3h: Number(model.nominal_airflow_m3h ?? 0),
                  },
                  refrigerant: model.refrigerant ?? undefined,
                  geometry: {
                    rows: model.rows,
                    tubesPerRow: model.tubes_per_row,
                    circuits: model.circuits,
                    coilLengthMm: model.length_mm,
                    finPitchMm: model.fin_pitch_mm,
                    tubeOdMm: model.tube_od_mm,
                    tubeIdMm: model.tube_id_mm,
                  },
                }),
              );
            }
          }}
        >
          <Link
            to="/coldpro/equipamentos/$id/coil-simulator"
            params={{ id: equipmentProjectId }}
          >
            <Calculator className="mr-1 h-4 w-4" /> Coil Simulator
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
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
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Importar
            </Button>
          </div>
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
          {model?.missing_fields &&
            Array.isArray(model.missing_fields) &&
            model.missing_fields.length > 0 && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Campos ausentes: {(model.missing_fields as string[]).join(", ")}
              </p>
            )}
        </div>

        {model && <NominalEditor componentId={componentId} model={model} />}

        {model?.nominal_capacity_w &&
        model.nominal_evap_temp_c != null &&
        model.nominal_air_temp_in_c != null &&
        model.nominal_airflow_m3h ? (
          <>
            <ValidateBlock componentId={componentId} model={model} />
            <SimulateBlock componentId={componentId} model={model} />
            <SimulationHistory componentId={componentId} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Importe um datasheet ou preencha os campos nominais para habilitar a simulação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type EvapModel = NonNullable<Awaited<ReturnType<typeof getEvaporatorCoilModel>>>;

function NominalEditor({ componentId, model }: { componentId: string; model: EvapModel }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function start() {
    setForm({
      nominal_capacity_w: String(model.nominal_capacity_w ?? ""),
      nominal_air_temp_in_c: String(model.nominal_air_temp_in_c ?? ""),
      nominal_evap_temp_c: String(model.nominal_evap_temp_c ?? ""),
      nominal_airflow_m3h: String(model.nominal_airflow_m3h ?? ""),
      refrigerant: String(model.refrigerant ?? ""),
      rows: String(model.rows ?? ""),
      tubes_per_row: String(model.tubes_per_row ?? ""),
      circuits: String(model.circuits ?? ""),
      superheat_k: String(model.superheat_k ?? ""),
      subcooling_k: String(model.subcooling_k ?? ""),
      face_velocity_ms: String(model.face_velocity_ms ?? ""),
      air_pressure_drop_pa: String(model.air_pressure_drop_pa ?? ""),
      refrigerant_pressure_drop_kpa: String(model.refrigerant_pressure_drop_kpa ?? ""),
      fin_material: String(model.fin_material ?? ""),
      tube_material: String(model.tube_material ?? ""),
    });
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    try {
      const overrides = { ...((model.manual_overrides as Record<string, boolean>) || {}) };
      const patch: Record<string, unknown> = { component_item_id: componentId };
      for (const [k, v] of Object.entries(form)) {
        if (v === "") continue;
        const isText = ["refrigerant", "fin_material", "tube_material"].includes(k);
        const original = (model as unknown as Record<string, unknown>)[k];
        const newVal: unknown = isText ? v : Number(v);
        if (String(original ?? "") !== String(newVal)) overrides[k] = true;
        patch[k] = newVal;
      }
      patch.manual_overrides = overrides;
      await upsertEvaporatorCoilModel(patch as never);
      toast.success("Dados nominais atualizados");
      qc.invalidateQueries({ queryKey: ["evap-model", componentId] });
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <NominalDisplay
          data={{
            "Capacidade total": fmtW(model.nominal_capacity_w),
            "Vazão de ar": fmtNum(model.nominal_airflow_m3h, "m³/h"),
            "Tar entrada": fmtNum(model.nominal_air_temp_in_c, "°C"),
            "T evaporação": fmtNum(model.nominal_evap_temp_c, "°C"),
            "Veloc. frontal": fmtNum(model.face_velocity_ms, "m/s"),
            "ΔP ar": fmtNum(model.air_pressure_drop_pa, "Pa"),
            "Superaq.": fmtNum(model.superheat_k, "K"),
            "Subresf.": fmtNum(model.subcooling_k, "K"),
            "Área troca": fmtNum(model.surface_area_m2, "m²"),
            Fileiras: fmtNum(model.rows),
            "Tubos/fileira": fmtNum(model.tubes_per_row),
            Circuitos: fmtNum(model.circuits),
            Fluido: model.refrigerant ?? "—",
          }}
        />
        <Button size="sm" variant="outline" onClick={start}>
          Editar dados nominais
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <h4 className="text-sm font-semibold">Editar dados nominais</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(form).map(([k, v]) => (
          <SmallField key={k} label={k.replaceAll("_", " ")}>
            <Input value={v} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </SmallField>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ValidateBlock({ componentId, model }: { componentId: string; model: EvapModel }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    ok: boolean;
    errorPct: number;
    missing: string[];
  } | null>(null);

  async function validate() {
    setBusy(true);
    try {
      const required = [
        "nominal_capacity_w",
        "nominal_air_temp_in_c",
        "nominal_evap_temp_c",
        "nominal_airflow_m3h",
        "refrigerant",
        "rows",
        "tubes_per_row",
        "circuits",
      ];
      const missing = required.filter(
        (k) => (model as unknown as Record<string, unknown>)[k] == null,
      );
      if (missing.length) {
        setReport({ ok: false, errorPct: 0, missing });
        await updateComponent(componentId, { status: "needs_review" });
        toast.error("Campos mínimos ausentes", { description: missing.join(", ") });
        return;
      }
      // Roda no ponto nominal: deve recuperar Qnom (frost=1, fouling=1)
      const r = simulateEvaporator(
        {
          capacityW: Number(model.nominal_capacity_w),
          sensibleW: model.nominal_sensible_w ? Number(model.nominal_sensible_w) : null,
          latentW: model.nominal_latent_w ? Number(model.nominal_latent_w) : null,
          airTempInC: Number(model.nominal_air_temp_in_c),
          evapTempC: Number(model.nominal_evap_temp_c),
          airflowM3h: Number(model.nominal_airflow_m3h),
          exponentN: Number(model.exponent_n),
        },
        {
          airTempInC: Number(model.nominal_air_temp_in_c),
          evapTempC: Number(model.nominal_evap_temp_c),
          airflowM3h: Number(model.nominal_airflow_m3h),
          frostFactor: 1,
          foulingFactor: 1,
        },
      );
      const errorPct = Math.abs(100 - r.comparisonToNominalPercent);
      const ok = errorPct <= 5;
      setReport({ ok, errorPct, missing: [] });
      await updateComponent(componentId, { status: ok ? "validated" : "needs_review" });
      qc.invalidateQueries({ queryKey: ["components"] });
      if (ok) toast.success(`Validado (erro ${errorPct.toFixed(2)}%)`);
      else toast.warning(`Erro ${errorPct.toFixed(2)}% — revisar`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/20 p-3">
      <div className="text-xs">
        {report ? (
          report.missing.length ? (
            <span className="text-rose-600">Faltam: {report.missing.join(", ")}</span>
          ) : (
            <span className={report.ok ? "text-emerald-600" : "text-amber-600"}>
              Erro vs nominal: {report.errorPct.toFixed(2)}% — {report.ok ? "validado" : "revisar"}
            </span>
          )
        ) : (
          <span className="text-muted-foreground">
            Validar simula no ponto nominal e exige erro ≤ 5%.
          </span>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={validate} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-2 h-3 w-3" />}
        Validar evaporador
      </Button>
    </div>
  );
}

function SimulateBlock({ componentId, model }: { componentId: string; model: EvapModel }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [inputs, setInputs] = useState({
    airTempInC: String(model.nominal_air_temp_in_c ?? ""),
    evapTempC: String(model.nominal_evap_temp_c ?? ""),
    airflowM3h: String(model.nominal_airflow_m3h ?? ""),
    rhInPct: "85",
    frostFactor: "0.90",
    foulingFactor: "1.00",
  });
  const [result, setResult] = useState<EvaporatorSimulationResult | null>(null);

  function run() {
    const r = simulateEvaporator(
      {
        capacityW: Number(model.nominal_capacity_w),
        sensibleW: model.nominal_sensible_w ? Number(model.nominal_sensible_w) : null,
        latentW: model.nominal_latent_w ? Number(model.nominal_latent_w) : null,
        airTempInC: Number(model.nominal_air_temp_in_c),
        evapTempC: Number(model.nominal_evap_temp_c),
        airflowM3h: Number(model.nominal_airflow_m3h),
        exponentN: Number(model.exponent_n),
      },
      {
        airTempInC: Number(inputs.airTempInC),
        evapTempC: Number(inputs.evapTempC),
        airflowM3h: Number(inputs.airflowM3h),
        rhInPct: Number(inputs.rhInPct),
        frostFactor: Number(inputs.frostFactor),
        foulingFactor: Number(inputs.foulingFactor),
      },
    );
    setResult(r);
    recordCoilSimulation({
      componentItemId: componentId,
      inputs: inputs as unknown as Record<string, unknown>,
      outputs: r as unknown as Record<string, unknown>,
      warnings: r.warnings,
      userId: user?.id,
    })
      .then(() => qc.invalidateQueries({ queryKey: ["coil-sims", componentId] }))
      .catch(() => undefined);
    updateComponent(componentId, { status: "simulated" }).then(() =>
      qc.invalidateQueries({ queryKey: ["components"] }),
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Simular evaporador</h4>
        <Button size="sm" onClick={run}>
          <Play className="mr-2 h-3 w-3" /> Calcular
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <SmallField label="Tar entrada (°C)">
          <Input value={inputs.airTempInC} onChange={(e) => setInputs({ ...inputs, airTempInC: e.target.value })} />
        </SmallField>
        <SmallField label="T evap (°C)">
          <Input value={inputs.evapTempC} onChange={(e) => setInputs({ ...inputs, evapTempC: e.target.value })} />
        </SmallField>
        <SmallField label="Vazão ar (m³/h)">
          <Input value={inputs.airflowM3h} onChange={(e) => setInputs({ ...inputs, airflowM3h: e.target.value })} />
        </SmallField>
        <SmallField label="UR (%)">
          <Input value={inputs.rhInPct} onChange={(e) => setInputs({ ...inputs, rhInPct: e.target.value })} />
        </SmallField>
        <SmallField label="Fator gelo">
          <Input value={inputs.frostFactor} onChange={(e) => setInputs({ ...inputs, frostFactor: e.target.value })} />
        </SmallField>
        <SmallField label="Fator sujeira">
          <Input value={inputs.foulingFactor} onChange={(e) => setInputs({ ...inputs, foulingFactor: e.target.value })} />
        </SmallField>
      </div>
      {result && (
        <div className="space-y-2">
          <NominalDisplay
            data={{
              "Capacidade total": fmtW(result.totalCapacityW),
              "Em kcal/h": fmtNum(result.totalCapacityKcalh, "kcal/h"),
              Sensível: fmtW(result.sensibleCapacityW),
              Latente: fmtW(result.latentCapacityW),
              "DT real": `${result.dtRealK.toFixed(1)} K`,
              "Fator vazão": result.airflowFactor.toFixed(2),
              "vs nominal": `${result.comparisonToNominalPercent.toFixed(1)}%`,
              Correção: result.correctionFactor.toFixed(3),
            }}
          />
          {result.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
              {result.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SimulationHistory({ componentId }: { componentId: string }) {
  const { data: sims = [] } = useQuery({
    queryKey: ["coil-sims", componentId],
    queryFn: () => listCoilSimulations(componentId),
  });
  if (sims.length === 0) return null;
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4" /> Histórico de simulações ({sims.length})
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left">Data</th>
              <th className="text-right">Q total</th>
              <th className="text-right">DT</th>
              <th className="text-right">vs nom</th>
              <th className="text-right">Avisos</th>
            </tr>
          </thead>
          <tbody>
            {sims.map((s) => {
              const o = s.outputs as Record<string, number>;
              const w = (s.warnings as unknown as string[]) || [];
              return (
                <tr key={s.id} className="border-t">
                  <td className="py-1">{new Date(s.created_at).toLocaleString("pt-BR")}</td>
                  <td className="text-right">{fmtW(o.totalCapacityW)}</td>
                  <td className="text-right">{Number(o.dtRealK ?? 0).toFixed(1)} K</td>
                  <td className="text-right">{Number(o.comparisonToNominalPercent ?? 0).toFixed(0)}%</td>
                  <td className="text-right">{w.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NominalDisplay({ data }: { data: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-3 text-xs sm:grid-cols-4">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <p className="text-muted-foreground">{k}</p>
          <p className="font-medium">{v}</p>
        </div>
      ))}
    </div>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function fmtNum(v: number | null | undefined, unit = ""): string {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? " " + unit : ""}`;
}
function fmtW(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} W`;
}
