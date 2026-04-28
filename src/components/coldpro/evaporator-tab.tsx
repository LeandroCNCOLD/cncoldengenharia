import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Play, FileText, Plus, Trash2 } from "lucide-react";
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
        items.map((c) => <EvaporatorCard key={c.id} componentId={c.id} status={c.status} />)
      )}
    </div>
  );
}

function EvaporatorCard({
  componentId,
  status,
}: {
  componentId: string;
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

  // Form state — campos do form
  const [form, setForm] = useState({
    code: "",
    manufacturer: "",
    model: "",
    refrigerant: "",
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
      await upsertEvaporatorCoilModel({
        component_item_id: componentId,
        nominal_capacity_w: f.totalCapacityW ?? null,
        nominal_sensible_w: f.sensibleCapacityW ?? null,
        nominal_latent_w: f.latentCapacityW ?? null,
        nominal_air_temp_in_c: f.airTempInC ?? null,
        nominal_air_temp_out_c: f.airTempOutC ?? null,
        nominal_evap_temp_c: f.evapTempC ?? null,
        nominal_airflow_m3h: f.airflowM3h ?? null,
        refrigerant: f.refrigerant ?? null,
        rows: f.rows ?? null,
        tubes_per_row: f.tubesPerRow ?? null,
        circuits: f.circuits ?? null,
        length_mm: f.lengthMm ?? null,
        fin_pitch_mm: f.finPitchMm ?? null,
        tube_od_mm: f.tubeOdMm ?? null,
        tube_id_mm: f.tubeIdMm ?? null,
        surface_area_m2: f.surfaceAreaM2 ?? null,
        internal_volume_l: f.internalVolumeL ?? null,
        raw_fields: f as never,
      });
      await updateComponent(componentId, {
        status: "imported",
        manufacturer: form.manufacturer || "Unilab",
        raw_fields: f as never,
      });
      toast.success("Datasheet importado", {
        description: result.warnings.length
          ? `${result.warnings.length} aviso(s)`
          : "Todos os campos principais identificados",
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Evaporador
          <Badge className={`ml-2 ${COMPONENT_STATUS_COLORS[status]}`} variant="secondary">
            {COMPONENT_STATUS_LABELS[status]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SmallField label="Código">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </SmallField>
          <SmallField label="Fabricante">
            <Input
              value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
            />
          </SmallField>
          <SmallField label="Modelo">
            <Input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </SmallField>
          <SmallField label="Fluido">
            <Input
              value={form.refrigerant}
              onChange={(e) => setForm({ ...form, refrigerant: e.target.value })}
            />
          </SmallField>
        </div>

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
        </div>

        {model && (
          <NominalDisplay
            data={{
              "Capacidade total": fmtW(model.nominal_capacity_w),
              "Vazão de ar": fmtNum(model.nominal_airflow_m3h, "m³/h"),
              "Tar entrada": fmtNum(model.nominal_air_temp_in_c, "°C"),
              "T evaporação": fmtNum(model.nominal_evap_temp_c, "°C"),
              "Área de troca": fmtNum(model.surface_area_m2, "m²"),
              Fileiras: fmtNum(model.rows),
              "Tubos/fileira": fmtNum(model.tubes_per_row),
              Circuitos: fmtNum(model.circuits),
              Fluido: model.refrigerant ?? "—",
            }}
          />
        )}

        {model?.nominal_capacity_w && model.nominal_evap_temp_c != null && model.nominal_air_temp_in_c != null && model.nominal_airflow_m3h ? (
          <SimulateBlock componentId={componentId} model={model} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Importe um datasheet para habilitar a simulação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SimulateBlock({
  componentId,
  model,
}: {
  componentId: string;
  model: NonNullable<Awaited<ReturnType<typeof getEvaporatorCoilModel>>>;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [inputs, setInputs] = useState({
    airTempInC: String(model.nominal_air_temp_in_c ?? ""),
    evapTempC: String(model.nominal_evap_temp_c ?? ""),
    airflowM3h: String(model.nominal_airflow_m3h ?? ""),
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
    }).catch(() => undefined);
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SmallField label="Tar entrada (°C)">
          <Input
            value={inputs.airTempInC}
            onChange={(e) => setInputs({ ...inputs, airTempInC: e.target.value })}
          />
        </SmallField>
        <SmallField label="T evap (°C)">
          <Input
            value={inputs.evapTempC}
            onChange={(e) => setInputs({ ...inputs, evapTempC: e.target.value })}
          />
        </SmallField>
        <SmallField label="Vazão ar (m³/h)">
          <Input
            value={inputs.airflowM3h}
            onChange={(e) => setInputs({ ...inputs, airflowM3h: e.target.value })}
          />
        </SmallField>
        <SmallField label="Fator gelo">
          <Input
            value={inputs.frostFactor}
            onChange={(e) => setInputs({ ...inputs, frostFactor: e.target.value })}
          />
        </SmallField>
        <SmallField label="Fator sujeira">
          <Input
            value={inputs.foulingFactor}
            onChange={(e) => setInputs({ ...inputs, foulingFactor: e.target.value })}
          />
        </SmallField>
      </div>
      {result && (
        <div className="space-y-2">
          <NominalDisplay
            data={{
              "Capacidade total": fmtW(result.totalCapacityW),
              Sensível: fmtW(result.sensibleCapacityW),
              Latente: fmtW(result.latentCapacityW),
              "DT real": `${result.dtRealK.toFixed(1)} K`,
              "DT nominal": `${result.dtNominalK.toFixed(1)} K`,
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

function NominalDisplay({ data }: { data: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-3 text-xs sm:grid-cols-3">
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
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
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
