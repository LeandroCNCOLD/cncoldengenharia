import { Calculator, Printer, RotateCcw, Settings2 } from "lucide-react";
import { useState } from "react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import { getApplicationConfig } from "../config/applicationConfig";
import { formatBRL } from "../engine/costCalculator";
import { MaterialCostConfigModal } from "./MaterialCostConfigModal";
import { GeometryPickerModal } from "./GeometryPickerModal";
import {
  TubeModal,
  FinModal,
  DistributorModal,
} from "./GeometryDerivedModals";
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
}

export function WorkspaceSidebar({
  componentType,
  onSimulate,
  onReset,
  canSimulate,
  isSimulating,
  faceAreaM2,
}: WorkspaceSidebarProps) {
  const cfg = getApplicationConfig(componentType);
  const calcMode = useUnilabSimulationStore((s) => s.calcMode);
  const setCalcMode = useUnilabSimulationStore((s) => s.setCalcMode);
  const engineVersion = useUnilabSimulationStore((s) => s.engineVersion);
  const setEngineVersion = useUnilabSimulationStore((s) => s.setEngineVersion);
  const calculatedCost = useUnilabSimulationStore((s) => s.calculatedCost);

  const [costModalOpen, setCostModalOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKey>(null);

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
              onChange={() => setCalcMode("design")}
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

      {/* Seções (navegação do painel central) */}
      <nav className="rounded border border-slate-300 bg-white">
        <ul>
          {SECTIONS.map((s) => {
            const active = s.id === activeSection;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSectionChange(s.id)}
                  className={`block w-full border-b border-slate-100 px-2 py-1 text-left text-[10px] last:border-b-0 ${
                    active
                      ? "bg-[#1E6FD9] font-semibold text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {s.label}
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
          className="inline-flex items-center justify-center gap-1 rounded bg-[#1E6FD9] px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Calculator className="h-3 w-3" />
          {isSimulating ? "Calculando…" : "Calcular"}
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-1 py-1 text-[10px] text-slate-500 shadow-sm disabled:cursor-not-allowed"
          >
            <Printer className="h-3 w-3" />
            Imprimir
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
    </aside>
  );
}
