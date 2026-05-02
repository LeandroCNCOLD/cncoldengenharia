import { useNavigate } from "@tanstack/react-router";
import { CatalogFilters } from "../components/CatalogFilters";
import { EquipmentTable } from "../components/EquipmentTable";
import { SelectedComponentsPanel } from "../components/SelectedComponentsPanel";
import { useEquipmentCatalog } from "../hooks/useEquipmentCatalog";
import { useComponentSelection } from "../hooks/useComponentSelection";

export default function ComponentSelectorPage() {
  const navigate = useNavigate();
  const { rows, filter, setFilter, total, filteredTotal } = useEquipmentCatalog();
  const {
    selectedCompressor,
    selectedCondenser,
    selectedEvaporator,
    selectedReheatCoil,
    selectEquipment,
    clearSelection,
  } = useComponentSelection();

  const selectedIds = [
    selectedCompressor?.id,
    selectedCondenser?.id,
    selectedEvaporator?.id,
    selectedReheatCoil?.id,
  ].filter(Boolean) as string[];

  function handleProceed() {
    navigate({ to: "/coldpro/simulation" });
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Catálogo CN COLD</h1>
        <p className="mt-1 text-sm text-gray-600">
          Selecione os componentes do catálogo real para usar na simulação. O motor
          ColdPro V2 usará os dados técnicos reais do equipamento selecionado.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <CatalogFilters
            filter={filter}
            onChange={setFilter}
            total={total}
            filteredTotal={filteredTotal}
          />
          <EquipmentTable rows={rows} onSelect={selectEquipment} selectedIds={selectedIds} />
        </div>

        <SelectedComponentsPanel
          selectedCompressor={selectedCompressor}
          selectedCondenser={selectedCondenser}
          selectedEvaporator={selectedEvaporator}
          selectedReheatCoil={selectedReheatCoil}
          onClear={clearSelection}
          onProceed={handleProceed}
        />
      </div>
    </div>
  );
}
