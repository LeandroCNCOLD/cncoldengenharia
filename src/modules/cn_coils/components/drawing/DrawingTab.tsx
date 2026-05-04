/**
 * DrawingTab
 * ----------
 * Aba "Desenho" do workspace do Evaporador DX.
 * Integra:
 *  - Visualizador 3D da serpentina (React Three Fiber)
 *  - Diagrama 3D do ciclo de refrigeração
 *  - Desenho técnico 2D com cotas (SVG)
 *  - Exportação DXF (AutoCAD/SolidWorks) e PDF prancha A3
 *  - Seletor de modo de visualização
 */

import { useState, useRef } from "react";
import { CoilViewer3D } from "./CoilViewer3D";
import { CycleCircuitDiagram3D } from "./CycleCircuitDiagram3D";
import { CoilTechnicalDrawing2D } from "./CoilTechnicalDrawing2D";
import { exportToDXF, exportToPDF } from "../../utils/drawingExport";
import type { CycleResult } from "../../engines/cycle/cycleTypes";

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
  projectName?: string;
}

type ViewMode = "3d-coil" | "3d-cycle" | "2d-drawing" | "split";

export function DrawingTab({
  heightMm, widthMm, depthMm,
  rows, tubesPerRow, tubeOuterDiamMm, finPitchMm,
  circuits, refrigerantId,
  cycleResult,
  projectName = "Evaporador DX",
}: DrawingTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const geometry = {
    heightMm, widthMm, depthMm,
    rows, tubesPerRow, tubeOuterDiamMm,
    finPitchMm, finThicknessMm: 0.1,
    circuits, staggered: true,
    refrigerantId,
  };

  const exportInputs = {
    ...geometry,
    projectName,
  };

  async function handleExportPDF() {
    setExporting(true);
    try {
      // Tenta capturar o canvas WebGL se disponível
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
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {([
            { id: "split", label: "⊞ Split", desc: "3D + 2D" },
            { id: "3d-coil", label: "🧊 3D Serpentina", desc: "Visualizador 3D" },
            { id: "3d-cycle", label: "🔄 3D Ciclo", desc: "Diagrama do ciclo" },
            { id: "2d-drawing", label: "📐 2D Técnico", desc: "Desenho com cotas" },
          ] as { id: ViewMode; label: string; desc: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === id
                  ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
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
            Exportar DXF
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
            {exporting ? "Gerando PDF..." : "Prancha A3 (PDF)"}
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
          <span>Configure a geometria na barra lateral e clique em <strong>Calcular</strong> para gerar os desenhos 3D e 2D.</span>
        </div>
      )}

      {/* Conteúdo por modo */}
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

      {viewMode === "3d-cycle" && (
        <CycleCircuitDiagram3D
          cycleResult={cycleResult}
          refrigerantId={refrigerantId}
          className="w-full"
        />
      )}

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

      {/* Informações de exportação */}
      {hasGeometry && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">DXF — AutoCAD / SolidWorks</p>
              <p className="text-xs text-slate-500 mt-0.5">Vista frontal e lateral com cotas, tubos, aletas e circuitos. Importável em qualquer software CAD.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-8 h-8 bg-blue-700 rounded flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-800">PDF — Prancha Técnica A3</p>
              <p className="text-xs text-blue-600 mt-0.5">Prancha completa com vistas 2D, tabela de dados técnicos, carimbo e resultados do ciclo.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="w-8 h-8 bg-purple-700 rounded flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-800">3D Interativo</p>
              <p className="text-xs text-purple-600 mt-0.5">Modelo 3D com zonas térmicas, fluxo animado de refrigerante e diagrama do ciclo. Rotacione e explore.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
