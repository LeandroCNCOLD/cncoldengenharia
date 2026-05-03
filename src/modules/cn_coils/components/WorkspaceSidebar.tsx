import { Calculator, Printer, RotateCcw, Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useCnCoilsSimulationStore } from "../store/useUnilabSimulationStore";
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
import type { UnilabComponentType } from "../types/unilab.types";
import {
  calcCoilDerivedDimensions,
  calcCoilDimensions,
  validateFanFit,
} from "../utils/coilDerivedMetrics";
import {
  loadCnCoilsCoefficients,
  listUsableAxialFans,
  type AxialFanRecord,
} from "../services/unilabCoefficientsService";

type ModalKey = "geometry" | "tube" | "fin" | "distributor" | null;

const MODAL_BUTTONS: Array<{ id: Exclude<ModalKey, null>; label: string }> = [
  { id: "geometry", label: "Geometria…" },
  { id: "tube", label: "Tubo…" },
  { id: "fin", label: "Aleta…" },
  { id: "distributor", label: "Distribuidor…" },
];

// Mantido para compatibilidade externa: hoje só "ventilacao" é usado (fixo no centro).
export type WorkspaceSection = "ventilacao";

interface WorkspaceSidebarProps {
  componentType: UnilabComponentType;
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
  const [fans, setFans] = useState<Array<{ id: string; diameter_mm?: number; axial?: AxialFanRecord }>>([]);

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
    nCircuits: physicalInputs.circuits ?? 0,
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
      const key = "unilab.savedProjects";
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
                ? faceAreaM2.toFixed(4)
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
        <SidebarMetricLine label="Altura" value={`${derived.altura_mm.toFixed(0)} mm`} />
        <SidebarMetricLine label="Largura" value={`${derived.largura_mm.toFixed(0)} mm`} />
        <SidebarMetricLine label="Profund." value={`${derived.prof_mm.toFixed(0)} mm`} />
      </SidebarInfoCard>

      <SidebarInfoCard title="Volume e Carga">
        <SidebarMetricLine label="Volume interno" value={`${derived.volumeInterno_L.toFixed(2)} L`} />
        <SidebarMetricLine label="Carga refrig." value={`${derived.cargaRefrigerante_kg.toFixed(2)} kg`} />
      </SidebarInfoCard>

      <div className={`rounded border bg-white ${hasFanError ? "border-red-500 bg-red-50" : "border-emerald-500 bg-emerald-50"}`}>
        <div className="border-b border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
          Gabinete Sanitário
        </div>
        <div className="space-y-1 p-1.5 text-[10px] text-slate-700">
          <div className="rounded bg-white/70 px-1.5 py-1 text-center font-mono font-semibold text-slate-900">
            {derived.gabinete_largura_mm.toFixed(0)} × {derived.gabinete_altura_mm.toFixed(0)} × {derived.gabinete_prof_mm.toFixed(0)} mm
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
    <div className="rounded border border-slate-300 bg-white">
      <div className="border-b border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
        {title}
      </div>
      <div className="space-y-1 p-1.5 text-[10px] text-slate-700">
        {children}
      </div>
    </div>
  );
}

function SidebarMetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function inferFanDiameterMm(model: string): number | undefined {
  const match = model.match(/(?:^|[^0-9])(\d{3,4})(?:[^0-9]|$)/);
  if (!match) return undefined;
  const diameter = Number(match[1]);
  return Number.isFinite(diameter) && diameter >= 200 ? diameter : undefined;
}
