import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import { useCatalogSessionStore } from "../store/useCatalogSessionStore";

export function useComponentSelection() {
  const {
    selectedCompressor,
    selectedCondenser,
    setCompressor,
    setCondenser,
    clearSelection,
  } = useCatalogSessionStore();

  function selectEquipment(item: CatalogEquipmentRow) {
    switch (item.family) {
      case "compressor":
        setCompressor(item);
        break;
      case "condenser":
      case "condensing_unit":
        setCondenser(item);
        break;
      case "plugin":
      case "split":
        setCompressor(item);
        setCondenser(item);
        break;
      default:
        console.warn(`[CatalogSelection] Família não selecionável: ${item.family}`);
    }
  }

  return {
    selectedCompressor,
    selectedCondenser,
    selectEquipment,
    clearSelection,
    hasSelection: !!(selectedCompressor || selectedCondenser),
  };
}
