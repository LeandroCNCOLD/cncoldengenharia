import { Calculator, Printer, RotateCcw } from "lucide-react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import { getApplicationConfig } from "../config/applicationConfig";
import type { UnilabComponentType } from "../types/unilab.types";

const SECTIONS = [
  { id: "geometry", label: "Geometria" },
  { id: "tube", label: "Tubo" },
  { id: "fin", label: "Aleta" },
  { id: "fan_details", label: "Detalhes Lado Ventilação" },
  { id: "distributor", label: "Distribuidor" },
  { id: "fluid_details", label: "Detalhes Lado Fluido" },
  { id: "output", label: "Saída" },
] as const;

export type WorkspaceSection = (typeof SECTIONS)[number]["id"];

interface WorkspaceSidebarProps {
  componentType: UnilabComponentType;
  activeSection: WorkspaceSection;
  onSectionChange: (s: WorkspaceSection) => void;
  onSimulate: () => void;
  onReset: () => void;
  canSimulate: boolean;
  isSimulating: boolean;
  faceAreaM2?: number;
}

/**
 * WorkspaceSidebar — replica a coluna esquerda do Unilab Coils 9.0:
 * - Cabeçalho com a aplicação ativa (Condensação / Evaporação / etc.)
 * - Modo de Cálculo (Verificar / Desenho)
 * - Navegação por seções (Geometria, Tubo, Aleta, ...)
 * - Resumo "Superfície de Troca" + descrição do projeto
 * - Botões Calcular / Imprimir
 */
export function WorkspaceSidebar({
  componentType,
  activeSection,
  onSectionChange,
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

  return (
    <aside className="flex h-full w-full flex-col gap-2 rounded border border-slate-300 bg-slate-50 p-2 text-xs shadow-sm">
      {/* Cabeçalho com a aplicação */}
      <div className="rounded bg-[#1E6FD9] px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-white">
        {cfg.shortLabel}
      </div>

      {/* Modo de Cálculo */}
      <div className="rounded border border-slate-300 bg-white">
        <div className="border-b border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
          Modo de Cálculo
        </div>
        <div className="space-y-1 p-2">
          <label className="flex items-center gap-2 text-[11px] text-slate-700">
            <input
              type="radio"
              name="calcMode"
              checked={calcMode === "verify"}
              onChange={() => setCalcMode("verify")}
              className="accent-[#1E6FD9]"
            />
            Verificar
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-700">
            <input
              type="radio"
              name="calcMode"
              checked={calcMode === "design"}
              onChange={() => setCalcMode("design")}
              className="accent-[#1E6FD9]"
            />
            Desenho
          </label>
        </div>
      </div>

      {/* Seções */}
      <nav className="rounded border border-slate-300 bg-white">
        <ul>
          {SECTIONS.map((s) => {
            const active = s.id === activeSection;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSectionChange(s.id)}
                  className={`block w-full border-b border-slate-100 px-3 py-1.5 text-left text-[11px] last:border-b-0 ${
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
        <div className="border-b border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
          Superfície de Troca
        </div>
        <div className="grid grid-cols-[60px_1fr] items-center gap-1 p-2">
          <div className="rounded border border-slate-300 bg-white px-1.5 py-1 text-center text-[11px] text-slate-600">
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
            className="w-full cursor-not-allowed rounded border border-slate-300 bg-emerald-50 px-2 py-1 text-right font-mono text-[11px] text-slate-800"
          />
        </div>
        <div className="px-2 pb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Descrição do Projeto
          </div>
          <input
            type="text"
            placeholder="(opcional)"
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none"
          />
          <div className="mt-1 flex items-center gap-1.5 rounded bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">
            ✓ Sem Avisos
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="mt-auto flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onSimulate}
          disabled={!canSimulate}
          className="inline-flex items-center justify-center gap-1.5 rounded bg-[#1E6FD9] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Calculator className="h-3.5 w-3.5" />
          {isSimulating ? "Calculando…" : "Calcular"}
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm disabled:cursor-not-allowed"
          title="Disponível na Etapa 5"
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm hover:bg-slate-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </button>
      </div>
    </aside>
  );
}
