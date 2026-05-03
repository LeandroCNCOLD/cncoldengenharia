import { useMemo, useState } from "react";
import { CatalogFilters } from "../components/CatalogFilters";
import { EquipmentTable } from "../components/EquipmentTable";
import { CatalogSimulationPanel, type SimulationParams } from "../components/CatalogSimulationPanel";
import { CatalogComparisonPanel } from "../components/CatalogComparisonPanel";
import { useEquipmentCatalog } from "../hooks/useEquipmentCatalog";
import { useCycleSimulation } from "@/modules/cn_coils/hooks/useCycleSimulation";
import { buildCycleConfigFromCatalog } from "../utils/buildCycleConfigFromCatalog";
import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { CycleSystemConfig } from "@/modules/cn_coils/engines/cycle/cycleTypes";

export default function ComponentSelectorPage() {
  const { rows, filter, setFilter, total, filteredTotal } = useEquipmentCatalog();
  const [selected, setSelected] = useState<CatalogEquipmentRow | null>(null);
  const [config, setConfig] = useState<CycleSystemConfig | null>(null);
  const [hasSimulated, setHasSimulated] = useState(false);
  const [activeRefrigerant, setActiveRefrigerant] = useState("R404A");

  const simState = useCycleSimulation(config);
  const isRunning = simState.status === "running";
  const errorMessage = simState.status === "error" ? simState.message : null;
  const result = simState.status === "success" ? simState.result : null;

  const selectedIds = useMemo(
    () => (selected ? [selected.id] : []),
    [selected],
  );

  function handleSelect(row: CatalogEquipmentRow) {
    setSelected(row);
    setConfig(null);
    setHasSimulated(false);
  }

  function handleSimulate(params: SimulationParams) {
    if (!selected) return;
    setActiveRefrigerant(params.refrigerantId);
    setHasSimulated(true);
    setConfig(
      buildCycleConfigFromCatalog({
        row: selected,
        refrigerantId: params.refrigerantId,
        Te_C: params.Te_C,
        Tc_C: params.Tc_C,
        superheatK: params.superheatK,
        subcoolingK: params.subcoolingK,
      }),
    );
  }

  function handleReset() {
    setConfig(null);
    setHasSimulated(false);
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">
          Validação de Catálogo CN Cold
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione um equipamento, ajuste as condições e compare os resultados
          do motor CycleEngine V2 com os dados oficiais do catálogo.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        {/* ZONA A — Catálogo */}
        <div className="space-y-3">
          <CatalogFilters
            filter={filter}
            onChange={setFilter}
            total={total}
            filteredTotal={filteredTotal}
          />
          <div className="max-h-[70vh] overflow-auto">
            <EquipmentTable
              rows={rows}
              onSelect={handleSelect}
              selectedIds={selectedIds}
            />
          </div>
        </div>

        {/* ZONA B — Simulação */}
        <CatalogSimulationPanel
          equipment={selected}
          isRunning={isRunning}
          errorMessage={errorMessage}
          onSimulate={handleSimulate}
        />

        {/* ZONA C — Comparação */}
        <CatalogComparisonPanel
          equipment={selected}
          result={result}
          refrigerantId={activeRefrigerant}
          isRunning={isRunning}
          hasSimulated={hasSimulated}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
