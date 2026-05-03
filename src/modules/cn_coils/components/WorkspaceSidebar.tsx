import { Calculator, History, Printer, RotateCcw, Save, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
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
import {
  LAST_INPUTS_STORAGE_KEY,
  hasSavedLastInputs,
  restoreLastInputs,
} from "../utils/lastInputsPersistence";
import type { UnilabComponentType } from "../types/unilab.types";

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
  const calcMode = useUnilabSimulationStore((s) => s.calcMode);
  const setCalcMode = useUnilabSimulationStore((s) => s.setCalcMode);
  const engineVersion = useUnilabSimulationStore((s) => s.engineVersion);
  const setEngineVersion = useUnilabSimulationStore((s) => s.setEngineVersion);
  const calculatedCost = useUnilabSimulationStore((s) => s.calculatedCost);
  const result = useUnilabSimulationStore((s) => s.result);
  const warnings = useUnilabSimulationStore((s) => s.warnings);
  const physicalInputs = useUnilabSimulationStore((s) => s.physicalInputs);
  const selectedGeometry = useUnilabSimulationStore((s) => s.selectedGeometry);
  const airFlow_m3h = useUnilabSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useUnilabSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useUnilabSimulationStore((s) => s.rhIn_pct);
  const foulingFactorAir = useUnilabSimulationStore((s) => s.foulingFactorAir);
  const fanCount = useUnilabSimulationStore((s) => s.fanCount);
  const fanRole = useUnilabSimulationStore((s) => s.fanRole);
  const fluid = useUnilabSimulationStore((s) => s.fluid);
  const fluidMassFlow_kg_h = useUnilabSimulationStore((s) => s.fluidMassFlow_kg_h);
  const fluidOperatingTemp_C = useUnilabSimulationStore((s) => s.fluidOperatingTemp_C);
  const superheat_K = useUnilabSimulationStore((s) => s.superheat_K);
  const subcooling_K = useUnilabSimulationStore((s) => s.subcooling_K);
  const foulingFactorFluid = useUnilabSimulationStore((s) => s.foulingFactorFluid);
  const pairedTempC = useUnilabSimulationStore((s) => s.pairedTempC);
  const dischargeSuperheatK = useUnilabSimulationStore((s) => s.dischargeSuperheatK);
  const compressorCount = useUnilabSimulationStore((s) => s.compressorCount);
  const selectedCompressorId = useUnilabSimulationStore((s) => s.selectedCompressorId);

  const [costModalOpen, setCostModalOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  useEffect(() => {
    setHasSaved(hasSavedLastInputs());
  }, [result]);

  // Avisos não-bloqueantes para campos opcionais.
  const optionalAdvisories = useMemo(() => {
    const list: string[] = [];
    const p = physicalInputs;
    if (!p?.circuits || p.circuits <= 0)
      list.push("Circuitos não informados — usando estimativa automática");
    if (!p?.tubeMaterialId)
      list.push("Material do tubo não selecionado — usando cobre (padrão)");
    if (!p?.tubePitchTransverseMm || p.tubePitchTransverseMm <= 0)
      list.push("Passo transversal não informado — usando valor da geometria");
    if (!p?.tubePitchLongitudinalMm || p.tubePitchLongitudinalMm <= 0)
      list.push("Passo longitudinal não informado — usando valor da geometria");
    if (!p?.finPitchMm || p.finPitchMm <= 0)
      list.push("Passo de aleta não informado — usando 2,5 mm (padrão)");
    if (!p?.finThicknessMm || p.finThicknessMm <= 0)
      list.push("Espessura de aleta não informada — usando 0,12 mm (padrão)");
    if (!selectedGeometry)
      list.push("Geometria não selecionada — usando parâmetros manuais");
    return list;
  }, [physicalInputs, selectedGeometry]);

  const handleRestoreLast = () => {
    if (restoreLastInputs()) {
      setHasSaved(true);
    }
  };

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
    warnings: warnings.map((w) => (typeof w === "string" ? w : w.message ?? w.code)),
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
    <aside className="flex h-full w-full flex-col gap-1.5 rounded border border-slate-300 bg-slate-50 p-1.5 text-[10px] shadow-sm">
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
          {MODAL_BUTTONS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setActiveModal(m.id)}
                className="block w-full border-b border-slate-100 px-2 py-1 text-left text-[10px] text-slate-700 last:border-b-0 hover:bg-slate-100"
              >
                {m.label}
              </button>
            </li>
          ))}
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
