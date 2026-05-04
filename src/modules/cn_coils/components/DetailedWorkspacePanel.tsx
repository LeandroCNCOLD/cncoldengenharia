import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { useCnCoilsCatalogs } from "../hooks/useCnCoilsCatalogs";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import type { StructuredWarning } from "../types/warnings";
import { fmtBR } from "../utils/unitConversions";

type AlertLike = {
  code?: string;
  title?: string;
  message?: string | null;
  severity?: "warning" | "error";
};

function dedupeAlerts<T extends AlertLike>(items: T[]): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    const key = [
      item.code ?? "",
      item.title ?? "",
      item.message ?? "",
    ].join("|");

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

function formatNumber(value: number | undefined | null, digits = 2): string {
  return Number.isFinite(value) ? fmtBR(value ?? 0, digits) : "---";
}

function formatMaybe(value: string | number | undefined | null, suffix = ""): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${fmtBR(value, 2)}${suffix}` : "---";
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return `${value}${suffix}`;
  }
  return "—";
}

function rawString(raw: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function rawNumber(raw: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-mono text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

function AlertList({ alerts }: { alerts: StructuredWarning[] }) {
  const visibleAlerts = dedupeAlerts(alerts ?? []);
  const errorCount = visibleAlerts.filter((alert) => alert.severity === "error").length;
  const warningCount = visibleAlerts.filter((alert) => alert.severity === "warning").length;

  if (visibleAlerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        Nenhum aviso ou alarme ativo.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-amber-900">
        <span>Avisos e Alarmes</span>
        <span>
          {errorCount} erros · {warningCount} avisos
        </span>
      </div>
      <ul className="space-y-1 text-sm">
        {visibleAlerts.map((alert, index) => {
          const isError = alert.severity === "error";
          const Icon = isError ? AlertCircle : AlertTriangle;
          return (
            <li
              key={`${alert.code ?? "alert"}-${index}`}
              className={isError ? "flex gap-2 text-red-800" : "flex gap-2 text-amber-800"}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {alert.message ?? alert.code ?? "Alarme sem mensagem"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DetailedWorkspacePanel() {
  const catalogs = useCnCoilsCatalogs();
  const selectedGeometry = useCnCoilsSimulationStore((s) => s.selectedGeometry);
  const physicalInputs = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const result = useCnCoilsSimulationStore((s) => s.result);
  const warnings = useCnCoilsSimulationStore((s) => s.warnings);
  const calcMode = useCnCoilsSimulationStore((s) => s.calcMode);
  const engineVersion = useCnCoilsSimulationStore((s) => s.engineVersion);
  const airFlow_m3h = useCnCoilsSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useCnCoilsSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useCnCoilsSimulationStore((s) => s.rhIn_pct);
  const selectedFanId = useCnCoilsSimulationStore((s) => s.selectedFanId);
  const fanCount = useCnCoilsSimulationStore((s) => s.fanCount);
  const fanRole = useCnCoilsSimulationStore((s) => s.fanRole);
  const errorFactorPercent = useCnCoilsSimulationStore((s) => s.errorFactorPercent);
  const fluidId = useCnCoilsSimulationStore((s) => s.fluid);
  const tempSat_C = useCnCoilsSimulationStore((s) => s.fluidOperatingTemp_C);
  const fluidTempReference = useCnCoilsSimulationStore((s) => s.fluidTempReference);
  const superheat_K = useCnCoilsSimulationStore((s) => s.superheat_K);
  const subcooling_K = useCnCoilsSimulationStore((s) => s.subcooling_K);
  const massFlow_kgh = useCnCoilsSimulationStore((s) => s.fluidMassFlow_kg_h);
  const foulingFactorAir = useCnCoilsSimulationStore((s) => s.foulingFactorAir);
  const foulingFactorFluid = useCnCoilsSimulationStore((s) => s.foulingFactorFluid);

  if (import.meta.env.DEV) {
    console.debug("[Detalhado] render", {
      selectedGeometry,
      airFlow_m3h,
      fluidId,
      tempSat_C,
    });
  }

  const raw = selectedGeometry?.raw;
  const tubeThicknessMm =
    physicalInputs.tubeOuterDiameterMm !== undefined &&
    physicalInputs.tubeInnerDiameterMm !== undefined
      ? (physicalInputs.tubeOuterDiameterMm - physicalInputs.tubeInnerDiameterMm) / 2
      : undefined;
  const finCorrectionFactor =
    result?.finCorrectionFactor ??
    rawNumber(raw, ["FatCorAl", "fin_correction_factor", "finCorrectionFactor"]);
  const airFrictionFactor =
    result?.airFrictionFactor ??
    rawNumber(raw, ["FattoreAttrAria", "air_friction_factor", "airFrictionFactor"]);
  const surfaceRatio =
    result?.surface_ratio ??
    rawNumber(raw, ["RapportoSuperficiInterne", "surface_ratio", "surfaceRatio"]);
  const geometryCode =
    rawString(raw, ["codigo", "code", "Codice", "GeometryCode"]) ??
    selectedGeometry?.id;
  const geometryType =
    rawString(raw, ["tipo_serpentina", "coil_type", "type", "TipoSerpentina"]) ??
    physicalInputs.componentType;
  const geometryDescription =
    rawString(raw, ["descricao", "description", "Descrizione"]) ??
    selectedGeometry?.name;
  const geometryInitials =
    rawString(raw, ["sigla", "shortCode", "Sigla"]) ??
    selectedGeometry?.name;
  const datasetStatus = catalogs.loading
    ? "Carregando catálogos…"
    : catalogs.ready
      ? "Todos os datasets obrigatórios carregados"
      : `Pendências: ${(catalogs.missing ?? []).join(", ") || "—"}`;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <div>
            <h2 className="text-sm font-semibold text-red-800">
              Fonte da Verdade — Detalhado
            </h2>
            <p className="mt-1 text-xs text-red-700">
              Dados lidos diretamente da store do simulador CN Coils e dos
              datasets carregados, independentemente da execução do cálculo.
            </p>
          </div>
        </div>
      </div>

      <AlertList alerts={warnings ?? []} />

      {!selectedGeometry && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Selecione uma geometria para carregar os parâmetros detalhados.
        </div>
      )}

      <DetailSection title="Geometria do Aletado">
        <Field label="Código" value={geometryCode ?? "—"} />
        <Field label="Sigla" value={geometryInitials ?? "—"} />
        <Field label="Descrição" value={geometryDescription ?? "—"} />
        <Field label="Tipo de serpentina" value={geometryType ?? "—"} />
        <Field
          label="Passo tubos / fileiras"
          value={`${formatNumber(physicalInputs.tubePitchTransverseMm)} × ${formatNumber(physicalInputs.tubePitchLongitudinalMm)} mm / ${formatMaybe(physicalInputs.rows)}`}
        />
        <Field label="Diâmetro externo" value={`${formatNumber(physicalInputs.tubeOuterDiameterMm)} mm`} />
        <Field label="Diâmetro interno" value={`${formatNumber(physicalInputs.tubeInnerDiameterMm)} mm`} />
        <Field label="Espessura tubo" value={`${formatNumber(tubeThicknessMm)} mm`} />
        <Field label="Espessura aleta" value={`${formatNumber(physicalInputs.finThicknessMm, 3)} mm`} />
        <Field label="Fator correção aleta" value={formatNumber(finCorrectionFactor, 4)} />
        <Field label="Fator atrito ar" value={formatNumber(airFrictionFactor, 4)} />
        <Field label="Razão superfícies internas" value={formatNumber(surfaceRatio, 4)} />
      </DetailSection>

      <DetailSection title="Lado Ventilação">
        <Field label="Vazão de ar" value={`${formatNumber(airFlow_m3h, 0)} m³/h`} />
        <Field label="Temperatura entrada DB" value={`${formatNumber(tempInDB_C, 1)} °C`} />
        <Field label="Umidade relativa entrada" value={`${formatNumber(rhIn_pct, 1)} %`} />
        <Field label="Ventilador selecionado" value={selectedFanId ?? "—"} />
        <Field label="Quantidade / função ventilador" value={`${fanCount} × ${fanRole}`} />
        <Field label="Velocidade frontal" value={result ? `${formatNumber(result.faceVelocityMs, 2)} m/s` : "---"} />
        <Field label="Pressão estática" value={result ? `${formatNumber(result.airPressureDropPa, 0)} Pa` : "---"} />
        <Field label="Fator de segurança / erro" value={`${formatNumber(errorFactorPercent, 1)} %`} />
        <Field label="Fouling lado ar" value={formatNumber(foulingFactorAir, 4)} />
      </DetailSection>

      <DetailSection title="Lado Fluido / Refrigerante">
        <Field label="Fluido" value={fluidId ?? "—"} />
        <Field label="Temperatura de evaporação/condensação" value={`${formatNumber(tempSat_C, 1)} °C`} />
        <Field label="Referência da temperatura" value={fluidTempReference} />
        <Field label="Sobreaquecimento" value={`${formatNumber(superheat_K, 1)} K`} />
        <Field label="Subresfriamento" value={`${formatNumber(subcooling_K, 1)} K`} />
        <Field
          label="Vazão mássica"
          value={
            result?.fluidMassFlowKgH
              ? `${formatNumber(result.fluidMassFlowKgH, 2)} kg/h`
              : `${formatNumber(massFlow_kgh, 2)} kg/h`
          }
        />
        <Field label="Queda de pressão" value={result ? `${formatNumber(result.fluidPressureDropKpa, 2)} kPa` : "---"} />
        <Field label="Fouling lado fluido" value={formatNumber(foulingFactorFluid, 4)} />
      </DetailSection>

      <DetailSection title="Condições Operacionais">
        <Field label="Frequência" value="60 Hz" />
        <Field label="Modo de cálculo" value={calcMode === "verify" ? "Verificar" : "Desenho"} />
        <Field label="Método do motor selecionado" value={engineVersion === "v2" ? "V2 ASHRAE" : "V1 NTU-ε"} />
        <Field label="Status dos datasets" value={datasetStatus} />
      </DetailSection>

      <DetailSection title="Parâmetros Avançados">
        <Field label="Comprimento aletado" value={`${formatNumber(physicalInputs.finnedLengthMm, 0)} mm`} />
        <Field label="Altura aletada" value={`${formatNumber(physicalInputs.finnedHeightMm, 0)} mm`} />
        <Field label="Tubos por fila" value={formatMaybe(physicalInputs.tubesPerRow)} />
        <Field label="Circuitos" value={formatMaybe(physicalInputs.circuits)} />
        <Field label="Material do tubo" value={physicalInputs.tubeMaterialId ?? "—"} />
        <Field label="Passo de aleta" value={`${formatNumber(physicalInputs.finPitchMm, 2)} mm`} />
      </DetailSection>
    </div>
  );
}
