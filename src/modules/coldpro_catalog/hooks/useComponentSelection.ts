import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import { useCatalogSessionStore } from "../store/useCatalogSessionStore";

function hasEvaporatorData(row: CatalogEquipmentRow): boolean {
  return Boolean(
    row.evaporadorRows ||
      row.evaporadorTubesPorRow ||
      row.evaporadorFinSpacingMm ||
      row.evaporadorLengthMm ||
      row.evaporadorTuboDiametroMm ||
      row.vazaoArEvaporadorM3H,
  );
}

function hasReheatData(row: CatalogEquipmentRow): boolean {
  return Boolean(
    row.reheatQTargetW ||
      row.reheatTAirInC !== undefined ||
      row.reheatCoilLengthM,
  );
}

export function useComponentSelection() {
  const {
    selectedCompressor,
    selectedCondenser,
    selectedEvaporator,
    selectedReheatCoil,
    setCompressor,
    setCondenser,
    setEvaporator,
    setReheatCoil,
    clearSelection,
  } = useCatalogSessionStore();

  function selectEquipment(item: CatalogEquipmentRow) {
    switch (item.family) {
      case "compressor":
        setCompressor(item);
        break;
      case "condenser":
        setCondenser(item);
        break;
      case "condensing_unit":
        setCompressor(item);
        setCondenser(item);
        if (hasEvaporatorData(item)) setEvaporator(item);
        if (hasReheatData(item)) setReheatCoil(item);
        break;
      case "plugin":
      case "split":
        // Unidade completa: define compressor, condensador e (se houver) evaporador/reaquecimento.
        setCompressor(item);
        setCondenser(item);
        if (hasEvaporatorData(item)) setEvaporator(item);
        if (hasReheatData(item)) setReheatCoil(item);
        break;
      default:
        console.warn(`[CatalogSelection] Família não selecionável: ${item.family}`);
    }
  }

  return {
    selectedCompressor,
    selectedCondenser,
    selectedEvaporator,
    selectedReheatCoil,
    selectEquipment,
    clearSelection,
    hasSelection: !!(
      selectedCompressor ||
      selectedCondenser ||
      selectedEvaporator ||
      selectedReheatCoil
    ),
  };
}
