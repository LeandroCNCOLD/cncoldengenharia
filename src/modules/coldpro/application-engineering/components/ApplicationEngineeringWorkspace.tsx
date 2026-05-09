/**
 * ApplicationEngineeringWorkspace.tsx
 *
 * Orquestrador principal do módulo Application Engineering.
 * Layout em grid 2x2 com os 4 painéis + botão de cálculo.
 */
import { Play, RotateCcw, Loader2 } from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { CompressorSelectionPanel } from "./CompressorSelectionPanel";
import { EvaporatorDetailPanel } from "./EvaporatorDetailPanel";
import { CondenserDetailPanel } from "./CondenserDetailPanel";
import { SystemValidationPanel } from "./SystemValidationPanel";
import { useApplicationEngineering } from "../hooks/useApplicationEngineering";

export function ApplicationEngineeringWorkspace() {
  const { isCalculating, lastError, runCalculation, reset } =
    useApplicationEngineering();

  return (
    <PageContainer
      title="Engenharia de Aplicação"
      subtitle="Dimensionamento integrado: compressor → evaporador → condensador → validação do sistema"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={isCalculating}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar
          </button>
          <button
            type="button"
            onClick={() => void runCalculation()}
            disabled={isCalculating}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isCalculating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isCalculating ? "Calculando..." : "Calcular Sistema"}
          </button>
        </div>
      }
    >
      {/* Erro global */}
      {lastError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <strong>Erro:</strong> {lastError}
        </div>
      )}

      {/* Grid 2x2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CompressorSelectionPanel />
        <EvaporatorDetailPanel />
        <CondenserDetailPanel />
        <SystemValidationPanel />
      </div>
    </PageContainer>
  );
}
