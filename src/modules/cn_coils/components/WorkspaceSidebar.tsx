import { Calculator, Printer, RotateCcw, Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import { getApplicationConfig } from "../config/applicationConfig";
import { formatBRL } from "../engine/costCalculator";
import { generateReportPdf, type ReportSnapshot } from "../engine/reportGenerator";
import { MaterialCostConfigModal } from "./MaterialCostConfigModal";
import { GeometryPickerModal } from "./GeometryPickerModal";
import {
  TubeModal,
  FinModal,
  DistributorModal,
} from "./GeometryDerivedModals";
import { GeometryEditorModal } from "./GeometryEditorModal";
import type { CnCoilsComponentType } from "../types/cncoils.types";
import {
  calcCoilDerivedDimensions,
  calcCoilDimensions,
  calcCoilWeight,
  validateFanFit,
  type FinMaterial,
  type TubeMaterial,
} from "../utils/coilDerivedMetrics";
import { fmtBR } from "../utils/unitConversions";
import {
  loadCnCoilsCoefficients,
  listUsableAxialFans,
  type AxialFanRecord,
} from "../services/cncoilsCoefficientsService";

type ModalKey = "geometry" | "tube" | "fin" | "distributor" | null;

const MODAL_BUTTONS: Array<{ id: Exclude<ModalKey, null>; label: string }> = [
  { id: "geometry", label: "Geometria…" },
  { id: "tube", label: "Tubo…" },
  { id: "fin", label: "Aleta…" },
  { id: "distributor", label: "Distribuidor…" },
];

const MATERIAL_SHORT: Record<TubeMaterial | FinMaterial, string> = {
  copper: "(Cu)",
  aluminum: "(Al)",
  steel: "(Fe)",
};

// Mantido para compatibilidade externa: hoje só "ventilacao" é usado (fixo no centro).
export type WorkspaceSection = "ventilacao";

interface WorkspaceSidebarProps {
  componentType: CnCoilsComponentType;
  onSimulate: () => void;
  onReset: () => void;
  canSimulate: boolean;
  isSimulating: boolean;
  faceAreaM2?: number;
  onOpenSchematic?: () => void;
  disabledReason?: string;
}

export function WorkspaceSidebar({
  componentType,
  onSimulate,
  onReset,
  canSimulate,
  isSimulating,
  faceAreaM2,
  onOpenSchematic,
  disabledReason,
}: WorkspaceSidebarProps) {
  const cfg = getApplicationConfig(componentType);
  const calcMode = useCnCoilsSimulationStore((s) => s.calcMode);
  const setCalcMode = useCnCoilsSimulationStore((s) => s.setCalcMode);
  const engineVersion = useCnCoilsSimulationStore((s) => s.engineVersion);
  const setEngineVersion = useCnCoilsSimulationStore((s) => s.setEngineVersion);
  const calculatedCost = useCnCoilsSimulationStore((s) => s.calculatedCost);
  const result = useCnCoilsSimulationStore((s) => s.result);
  const warnings = useCnCoilsSimulationStore((s) => s.warnings);
  const physicalInputs = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const selectedGeometry = useCnCoilsSimulationStore((s) => s.selectedGeometry);
  const airFlow_m3h = useCnCoilsSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useCnCoilsSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useCnCoilsSimulationStore((s) => s.rhIn_pct);
  const foulingFactorAir = useCnCoilsSimulationStore((s) => s.foulingFactorAir);
  const fanCount = useCnCoilsSimulationStore((s) => s.fanCount);
  const fanRole = useCnCoilsSimulationStore((s) => s.fanRole);
  const selectedFanId = useCnCoilsSimulationStore((s) => s.selectedFanId);
  const fluid = useCnCoilsSimulationStore((s) => s.fluid);
  const fluidMassFlow_kg_h = useCnCoilsSimulationStore((s) => s.fluidMassFlow_kg_h);
  const fluidOperatingTemp_C = useCnCoilsSimulationStore((s) => s.fluidOperatingTemp_C);
  const superheat_K = useCnCoilsSimulationStore((s) => s.superheat_K);
  const subcooling_K = useCnCoilsSimulationStore((s) => s.subcooling_K);
  const foulingFactorFluid = useCnCoilsSimulationStore((s) => s.foulingFactorFluid);
  const pairedTempC = useCnCoilsSimulationStore((s) => s.pairedTempC);
  const dischargeSuperheatK = useCnCoilsSimulationStore((s) => s.dischargeSuperheatK);
  const compressorCount = useCnCoilsSimulationStore((s) => s.compressorCount);
  const selectedCompressorId = useCnCoilsSimulationStore((s) => s.selectedCompressorId);

  const [costModalOpen, setCostModalOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [geomEditorOpen, setGeomEditorOpen] = useState(false);
  const [fans, setFans] = useState<Array<{ id: string; diameter_mm?: number; axial?: AxialFanRecord }>>([]);
  const [tubeWeightMaterial, setTubeWeightMaterial] = useState<TubeMaterial>("copper");
  const [finWeightMaterial, setFinWeightMaterial] = useState<FinMaterial>("aluminum");

  useEffect(() => {
    let cancelled = false;
    loadCnCoilsCoefficients()
      .then((bundle) => {
        if (cancelled) return;
        setFans(
          listUsableAxialFans(bundle).map((fan) => ({
            id: `axial-${fan.fanType}-${fan.idFanModel}-${fan.source}`,
            axial: fan,
            diameter_mm: inferFanDiameterMm(fan.model),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setFans([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nTubesPerRow =
    physicalInputs.tubesPerRow ??
    (physicalInputs.finnedHeightMm && physicalInputs.tubePitchTransverseMm
      ? Math.round(physicalInputs.finnedHeightMm / physicalInputs.tubePitchTransverseMm)
      : 0);
  const derived = calcCoilDerivedDimensions({
    nTubesPerRow,
    tubePitchTransverse_mm: physicalInputs.tubePitchTransverseMm ?? 0,
    nRows: physicalInputs.rows ?? 0,
    tubePitchLongitudinal_mm: physicalInputs.tubePitchLongitudinalMm ?? 0,
    lengthMm: physicalInputs.finnedLengthMm ?? 0,
    refrigerant: fluid,
    T_evap_C: fluidOperatingTemp_C,
    tubeID_m: (physicalInputs.tubeInnerDiameterMm ?? 0) / 1000,
    tubeOD_m: (physicalInputs.tubeOuterDiameterMm ?? 0) / 1000,
    nCircuits: physicalInputs.circuits ?? 0,
    finThickness_m: (physicalInputs.finThicknessMm ?? 0.13) / 1000,
    finPitch_m: (physicalInputs.finPitchMm ?? 2.5) / 1000,
    tubeMaterial: tubeWeightMaterial,
    finMaterial: finWeightMaterial,
  });
  const selectedFan = fans.find((f) => f.id === selectedFanId);
  const fanDiameterMm = selectedFan?.diameter_mm ?? 0;
  const fanFit = validateFanFit({
    fanD: fanDiameterMm,
    altura_mm: derived.altura_mm,
    largura_mm: derived.largura_mm,
    nFans: fanCount,
  });
  const hasFanError = fanFit.fanWarnings.some((w) => w.level === "error");

  const buildSnapshot = (): ReportSnapshot => ({
    componentLabel: cfg.shortLabel,
    geometryName: selectedGeometry?.name,
    physical: physicalInputs,
    air: {
      flowM3h: airFlow_m3h,
      tempInC: tempInDB_C,
      rhInPct: rhIn_pct,
      foulingFactor: foulingFactorAir,
      fanCount,
      fanRole,
    },
    fluid: {
      refrigerant: fluid,
      massFlowKgH: fluidMassFlow_kg_h,
      operatingTempC: fluidOperatingTemp_C,
      superheatK: superheat_K,
      subcoolingK: subcooling_K,
      foulingFactor: foulingFactorFluid,
      pairedTempC,
      dischargeSuperheatK,
      compressorCount,
      compressorId: selectedCompressorId,
    },
    cost: calculatedCost,
    result,
    warnings,
    meta: {
      project: "-",
      client: "",
      contact: "",
      code: "",
      description: `BATERIA ${cfg.shortLabel} — ${selectedGeometry?.name ?? ""}`,
      date: new Date().toLocaleDateString("pt-BR"),
    },
  });

  const handlePrint = () => {
    if (!result) {
      alert("Calcule a simulação antes de imprimir.");
      return;
    }
    const doc = generateReportPdf(buildSnapshot());
    const filename = `relatorio_cncold_${(selectedGeometry?.id ?? "bateria").replace(/[^a-z0-9_-]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  const handleSave = () => {
    const name = window.prompt("Nome para salvar este projeto:", `Projeto ${new Date().toLocaleDateString("pt-BR")}`);
    if (!name) return;
    try {
      const key = "cncoils.savedProjects";
      const raw = localStorage.getItem(key);
      const list: Array<{ name: string; savedAt: string; snapshot: ReportSnapshot }> =
        raw ? JSON.parse(raw) : [];
      list.push({ name, savedAt: new Date().toISOString(), snapshot: buildSnapshot() });
      localStorage.setItem(key, JSON.stringify(list));
      alert(`Projeto "${name}" salvo com sucesso (${list.length} no histórico).`);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar o projeto. Veja o console.");
    }
  };


  return (
    <aside className="flex h-full w-full min-w-[220px] flex-col gap-2 rounded border border-border bg-slate-50 p-2 text-[10px] shadow-sm">
      {/* Cabeçalho com a aplicação */}
      <div className="rounded bg-[#1E6FD9] px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white">
        {cfg.shortLabel}
      </div>

      {/* Modo de Cálculo */}
      <div className="rounded border border-slate-300 bg-white">
        <div className="border-b border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
          Modo de Cálculo
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 p-1.5">
          <label className="flex items-center gap-1 text-[10px] text-slate-700">
            <input
              type="radio"
              name="calcMode"
              checked={calcMode === "verify"}
              onChange={() => setCalcMode("verify")}
              className="h-3 w-3 accent-[#1E6FD9]"
            />
            Verificar
          </label>
          <label className="flex items-center gap-1 text-[10px] text-slate-700">
            <input
              type="radio"
              name="calcMode"
              checked={calcMode === "design"}
              onChange={() => {
                setCalcMode("design");
                onOpenSchematic?.();
              }}
              className="h-3 w-3 accent-[#1E6FD9]"
            />
            Desenho
          </label>
        </div>
      </div>

      {/* Motor termodinâmico */}
      <div className="rounded border border-slate-300 bg-white">
        <div className="border-b border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
          Motor
        </div>
        <div className="space-y-0.5 p-1.5">
          <label className="flex items-center gap-1 text-[10px] text-slate-700">
            <input
              type="radio"
              name="engineVersion"
              checked={engineVersion === "v1"}
              onChange={() => setEngineVersion("v1")}
              className="h-3 w-3 accent-[#1E6FD9]"
            />
            V1 NTU-ε
          </label>
          <label className="flex items-center gap-1 text-[10px] text-slate-700">
            <input
              type="radio"
              name="engineVersion"
              checked={engineVersion === "v2"}
              onChange={() => setEngineVersion("v2")}
              className="h-3 w-3 accent-[#1E6FD9]"
            />
            V2 ASHRAE
          </label>
        </div>
      </div>

      {/* Configuradores (abrem em modal) */}
      <nav className="rounded border border-slate-300 bg-white">
        <div className="border-b border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
          Configurar
        </div>
        <ul>
          {MODAL_BUTTONS.map((m) => {
            const geoLabel = m.id === "geometry" && selectedGeometry
              ? `Geometria: ${(selectedGeometry as unknown as { codigo?: string }).codigo ?? selectedGeometry.id}`
              : m.label;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setActiveModal(m.id)}
                  className="block w-full border-b border-slate-100 px-2 py-1 text-left text-[10px] text-slate-700 last:border-b-0 hover:bg-slate-100"
                >
                  {geoLabel}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setGeomEditorOpen(true)}
              className="block w-full border-b border-slate-100 px-2 py-1 text-left text-[10px] font-semibold text-emerald-700 last:border-b-0 hover:bg-emerald-50"
            >
              + Novo Aletado…
            </button>
          </li>
        </ul>
      </nav>

      {/* Superfície de Troca */}
      <div className="rounded border border-slate-300 bg-white">
        <div className="border-b border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
          Superfície de Troca
        </div>
        <div className="grid grid-cols-[40px_1fr] items-center gap-1 p-1.5">
          <div className="rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-[10px] text-slate-600">
            m²
          </div>
          <input
            type="text"
            value={
              faceAreaM2 !== undefined && Number.isFinite(faceAreaM2)
                ? fmtBR(faceAreaM2, 4)
                : "---"
            }
            readOnly
            className="w-full cursor-not-allowed rounded border border-slate-300 bg-emerald-50 px-1.5 py-0.5 text-right font-mono text-[10px] text-slate-800"
          />
        </div>
        <div className="px-1.5 pb-1.5">
          <div className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
            ✓ Sem Avisos
          </div>
        </div>
      </div>

      <SidebarInfoCard title="Dimensões do Aletado">
        <SidebarMetricLine label="Altura" value={`${fmtBR(derived.altura_mm, 0)} mm`} />
        <SidebarMetricLine label="Largura" value={`${fmtBR(derived.largura_mm, 0)} mm`} />
        <SidebarMetricLine label="Profund." value={`${fmtBR(derived.prof_mm, 0)} mm`} />
      </SidebarInfoCard>

      <SidebarInfoCard title="Volume e Carga">
        <SidebarMetricLine label="Volume interno" value={`${fmtBR(derived.volumeInterno_L, 2)} L`} />
        <SidebarMetricLine label="Carga refrig." value={`${fmtBR(derived.cargaRefrigerante_kg, 2)} kg`} />
      </SidebarInfoCard>

      <SidebarInfoCard title="Peso do Aletado">
        <MaterialSelectRow
          label="Material do tubo"
          value={tubeWeightMaterial}
          onChange={(value) => setTubeWeightMaterial(value as TubeMaterial)}
          options={[
            { value: "copper", label: "Cobre (Cu)" },
            { value: "aluminum", label: "Alumínio (Al)" },
            { value: "steel", label: "Aço (Fe)" },
          ]}
        />
        <MaterialSelectRow
          label="Material da aleta"
          value={finWeightMaterial}
          onChange={(value) => setFinWeightMaterial(value as FinMaterial)}
          options={[
            { value: "aluminum", label: "Alumínio (Al)" },
            { value: "copper", label: "Cobre (Cu)" },
          ]}
        />
        <div className="my-1 border-t border-slate-200" />
        <SidebarMetricLine
          label={`Tubos ${MATERIAL_SHORT[tubeWeightMaterial]}`}
          value={`${fmtBR(derived.pesoTubos_kg, 2)} kg`}
        />
        <SidebarMetricLine
          label={`Aletas ${MATERIAL_SHORT[finWeightMaterial]}`}
          value={`${fmtBR(derived.pesoAletas_kg, 2)} kg`}
        />
        <div className="my-1 border-t border-slate-200" />
        <SidebarMetricLine label="Peso seco" value={`${fmtBR(derived.pesoSeco_kg, 2)} kg`} />
        <SidebarMetricLine label="Peso c/ fluido" value={`${fmtBR(derived.pesoComFluido_kg, 2)} kg`} />
        {tubeWeightMaterial !== "copper" && (
          <div
            className="rounded border border-amber-300 bg-amber-50 px-1.5 py-1 text-[9px] font-semibold text-amber-800"
            title="A resistência da parede de Al é 4.7×10⁻⁶ m²K/W vs 2.5×10⁻⁶ para Cu. Ambos são desprezíveis — Q_total não é afetado."
          >
            ⚠️ Impacto térmico desprezível
          </div>
        )}
        {tubeWeightMaterial === "steel" && (
          <div className="rounded border border-red-300 bg-red-50 px-1.5 py-1 text-[9px] font-semibold text-red-800">
            ⚠️ Verificar compatibilidade com refrigerante
          </div>
        )}
      </SidebarInfoCard>

      <div
        className={`rounded border bg-white border-l-2 ${
          hasFanError
            ? "border-red-300 border-l-red-500"
            : "border-emerald-300 border-l-emerald-500"
        }`}
      >
        <div className="border-b border-border bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Gabinete
        </div>
        <div className="space-y-1 p-3 text-[10px] text-slate-700">
          <div className="rounded bg-white/70 px-1.5 py-1 text-center font-mono text-sm font-semibold text-foreground">
            {fmtBR(derived.gabinete_largura_mm, 0)} × {fmtBR(derived.gabinete_altura_mm, 0)} × {fmtBR(derived.gabinete_prof_mm, 0)} mm
          </div>
          {fanFit.fanWarnings.map((w, i) => (
            <div
              key={`${w.level}-${i}`}
              className={`rounded px-1.5 py-1 ${w.level === "error" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
            >
              {w.level === "error" ? "⚠️ " : "✅ "}
              {w.msg}
            </div>
          ))}
        </div>
      </div>

      {/* Custo da bateria (Etapa 3.6) */}
      <div className="rounded border border-slate-300 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-1.5 py-0.5">
          <span className="text-[10px] font-semibold text-slate-700">
            Custo da bateria
          </span>
          <button
            type="button"
            onClick={() => setCostModalOpen(true)}
            className="rounded p-0.5 text-slate-600 hover:bg-slate-200 hover:text-[#1E6FD9]"
            title="Configurar preços de materiais"
            aria-label="Configurar preços"
          >
            <Settings2 className="h-3 w-3" />
          </button>
        </div>
        <div className="p-1.5">
          <div className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-right font-mono text-[10px] font-bold text-emerald-900">
            {calculatedCost > 0 ? formatBRL(calculatedCost) : "R$ ---"}
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="mt-auto flex flex-col gap-1">
        <button
          type="button"
          onClick={onSimulate}
          disabled={!canSimulate}
          title={!canSimulate && disabledReason ? disabledReason : undefined}
          className="inline-flex items-center justify-center gap-1 rounded bg-[#1E6FD9] px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Calculator className="h-3 w-3" />
          {isSimulating ? "Calculando…" : "Calcular"}
        </button>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!result}
            title={result ? "Gerar relatório PDF" : "Calcule primeiro"}
            className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-1 py-1 text-[10px] text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <Printer className="h-3 w-3" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1 py-1 text-[10px] text-emerald-800 shadow-sm hover:bg-emerald-100"
          >
            <Save className="h-3 w-3" />
            Salvar
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-1 py-1 text-[10px] text-slate-700 shadow-sm hover:bg-slate-100"
          >
            <RotateCcw className="h-3 w-3" />
            Limpar
          </button>
        </div>
      </div>

      <MaterialCostConfigModal
        open={costModalOpen}
        onClose={() => setCostModalOpen(false)}
      />
      <GeometryPickerModal
        open={activeModal === "geometry"}
        onClose={() => setActiveModal(null)}
        componentType={componentType}
      />
      <TubeModal
        open={activeModal === "tube"}
        onClose={() => setActiveModal(null)}
      />
      <FinModal
        open={activeModal === "fin"}
        onClose={() => setActiveModal(null)}
      />
      <DistributorModal
        open={activeModal === "distributor"}
        onClose={() => setActiveModal(null)}
      />
      <GeometryEditorModal
        open={geomEditorOpen}
        onClose={() => setGeomEditorOpen(false)}
        baseGeometry={null}
        mode="create"
        onSaved={() => setGeomEditorOpen(false)}
      />
    </aside>
  );
}

function SidebarInfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-white">
      <div className="border-b border-border bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1 p-3 text-[11px] text-foreground">
        {children}
      </div>
    </div>
  );
}

function SidebarMetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function MaterialSelectRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="grid grid-cols-[1fr_105px] items-center gap-2">
      <span className="text-slate-500">{label}</span>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger className="h-7 rounded border-slate-300 px-2 py-1 text-[10px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function inferFanDiameterMm(model: string): number | undefined {
  const match = model.match(/(?:^|[^0-9])(\d{3,4})(?:[^0-9]|$)/);
  if (!match) return undefined;
  const diameter = Number(match[1]);
  return Number.isFinite(diameter) && diameter >= 200 ? diameter : undefined;
}
