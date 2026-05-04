/**
 * DrawingTab
 * ----------
 * Aba "Desenho" do workspace do Evaporador DX.
 * Integra:
 *  - Prancha técnica estilo CN COLD (5 vistas SVG com cotas e callouts)
 *  - Relatório de transmissão térmica detalhado (U, h_i, h_o, NTU, ε)
 *  - Visualizador 3D da serpentina (React Three Fiber)
 *  - Diagrama 3D do ciclo de refrigeração
 *  - Desenho técnico 2D com cotas (SVG legado)
 *  - Exportação DXF (AutoCAD/SolidWorks) e PDF prancha A3
 */

import { useState } from "react";
import { CoilViewer3D } from "./CoilViewer3D";
import { CycleCircuitDiagram3D } from "./CycleCircuitDiagram3D";
import { CoilTechnicalDrawing2D } from "./CoilTechnicalDrawing2D";
import { TechnicalDrawingSheet } from "./TechnicalDrawingSheet";
import { ThermalTransferReport } from "./ThermalTransferReport";
import { exportToDXF, exportToPDF } from "../../utils/drawingExport";
import type { CycleResult } from "../../engines/cycle/cycleTypes";
import type { SimulationV2Result } from "../../engine_v2/simulatorCoreV2";
import type { IterativeSolverV2Result } from "../../engine_v2/iterativeSolverV2";
import { useCnCoilsSimulationStore } from "../../store/useCnCoilsSimulationStore";

interface DrawingTabProps {
  // Geometria da serpentina
  heightMm: number;
  widthMm: number;
  depthMm: number;
  rows: number;
  tubesPerRow: number;
  tubeOuterDiamMm: number;
  finPitchMm: number;
  circuits: number;
  refrigerantId: string;
  // Resultado do ciclo
  cycleResult?: CycleResult | null;
  // Resultado V2 (motor ASHRAE — mais detalhado)
  v2Result?: SimulationV2Result | null;
  solverResult?: IterativeSolverV2Result | null;
  projectName?: string;
  componentType?: "evaporator_dx" | "condenser" | "heater" | "cooler";
}

type ViewMode = "prancha" | "thermal" | "split" | "3d-coil" | "3d-cycle" | "2d-drawing";

const VIEW_MODES: { id: ViewMode; label: string; icon: string; desc: string }[] = [
  { id: "prancha", label: "Prancha A3", icon: "📐", desc: "Prancha técnica 5 vistas" },
  { id: "thermal", label: "Transmissão Térmica", icon: "🌡", desc: "Relatório U, h_i, h_o, NTU" },
  { id: "split", label: "Split 3D+2D", icon: "⊞", desc: "3D + Desenho 2D" },
  { id: "3d-coil", label: "3D Serpentina", icon: "🧊", desc: "Visualizador 3D interativo" },
  { id: "3d-cycle", label: "Ciclo P-h", icon: "🔄", desc: "Diagrama do ciclo" },
  { id: "2d-drawing", label: "2D Técnico", icon: "📏", desc: "Desenho com cotas" },
];

export function DrawingTab({
  heightMm, widthMm, depthMm,
  rows, tubesPerRow, tubeOuterDiamMm, finPitchMm,
  circuits, refrigerantId,
  cycleResult,
  v2Result: v2ResultProp,
  solverResult,
  projectName = "Evaporador DX",
  componentType = "evaporator_dx",
}: DrawingTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("prancha");
  const [exporting, setExporting] = useState(false);

  // Lê o result V2 do store (mais atualizado que o prop)
  const storeResult = useCnCoilsSimulationStore((s) => s.result);
  const v2Result = v2ResultProp ?? (storeResult as SimulationV2Result | undefined) ?? null;

  const geometry = {
    heightMm, widthMm, depthMm,
    rows, tubesPerRow, tubeOuterDiamMm,
    finPitchMm, finThicknessMm: 0.1,
    circuits, staggered: true,
    refrigerantId,
    componentType,
    projectName,
    drawingNumber: `CN-${componentType.toUpperCase().replace("_", "")}-${Date.now().toString(36).toUpperCase().slice(-4)}`,
    scale: "1:16",
  };

  const exportInputs = { ...geometry, projectName };

  async function handleExportPDF() {
    setExporting(true);
    try {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
      await exportToPDF(exportInputs, cycleResult, canvas);
    } finally {
      setExporting(false);
    }
  }

  function handleExportDXF() {
    exportToDXF(exportInputs, cycleResult);
  }

  const hasGeometry = rows > 0 && tubesPerRow > 0 && heightMm > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Barra de controles */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Seletor de modo */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {VIEW_MODES.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                viewMode === id
                  ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Botões de exportação */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportDXF}
            disabled={!hasGeometry}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-medium rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            DXF
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!hasGeometry || exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-medium rounded-md transition-colors"
          >
            {exporting ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
            {exporting ? "Gerando..." : "Prancha PDF"}
          </button>
        </div>
      </div>

      {/* Aviso sem geometria */}
      {!hasGeometry && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <svg className="w-5 h-5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Configure a geometria na barra lateral e clique em <strong>Calcular</strong> para gerar os desenhos e relatórios.</span>
        </div>
      )}

      {/* ── Prancha técnica A3 ── */}
      {viewMode === "prancha" && (
        <TechnicalDrawingSheet
          geometry={geometry}
          cycleResult={cycleResult}
        />
      )}

      {/* ── Relatório de transmissão térmica ── */}
      {viewMode === "thermal" && (
        <div className="grid grid-cols-1 gap-4">
          <ThermalTransferReport
            cycleResult={cycleResult}
            v2Result={v2Result}
            solverResult={solverResult}
            refrigerantId={refrigerantId}
            componentType={componentType}
          />
        </div>
      )}

      {/* ── Split 3D + 2D ── */}
      {viewMode === "split" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <CoilViewer3D
            geometry={geometry}
            cycleResult={cycleResult}
            refrigerantId={refrigerantId}
            showThermalZones
            showFlow
          />
          <CoilTechnicalDrawing2D
            inputs={geometry}
            cycleResult={cycleResult}
            showDimensions
            showCircuits
            showThermalZones
          />
        </div>
      )}

      {/* ── 3D Serpentina ── */}
      {viewMode === "3d-coil" && (
        <CoilViewer3D
          geometry={geometry}
          cycleResult={cycleResult}
          refrigerantId={refrigerantId}
          showThermalZones
          showFlow
          className="w-full"
        />
      )}

      {/* ── 3D Ciclo / P-h ── */}
      {viewMode === "3d-cycle" && (
        <CycleCircuitDiagram3D
          cycleResult={cycleResult}
          refrigerantId={refrigerantId}
          className="w-full"
        />
      )}

      {/* ── 2D Técnico ── */}
      {viewMode === "2d-drawing" && (
        <CoilTechnicalDrawing2D
          inputs={geometry}
          cycleResult={cycleResult}
          showDimensions
          showCircuits
          showThermalZones
          className="w-full"
        />
      )}

      {/* Cards informativos (apenas quando há geometria e não está em modo prancha/thermal) */}
      {hasGeometry && !["prancha", "thermal"].includes(viewMode) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-400 transition-colors"
            onClick={() => setViewMode("prancha")}>
            <div className="w-8 h-8 bg-blue-700 rounded flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-800">Prancha Técnica A3</p>
              <p className="text-xs text-slate-500 mt-0.5">5 vistas com cotas, callouts, bloco de título CN COLD.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-400 transition-colors"
            onClick={() => setViewMode("thermal")}>
            <div className="w-8 h-8 bg-emerald-700 rounded flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-800">Transmissão Térmica</p>
              <p className="text-xs text-slate-500 mt-0.5">U, h_i, h_o, NTU, ε, regime, balanço de calor.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Exportar DXF / PDF</p>
              <p className="text-xs text-slate-500 mt-0.5">AutoCAD, SolidWorks ou prancha A3 completa.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
