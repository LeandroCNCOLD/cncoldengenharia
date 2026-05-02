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
  // O catálogo atual não traz campos específicos de reaquecimento.
  // Mantemos esta função como ponto único de extensão futura.
  const raw = row.raw ?? {};
  return Boolean(
    (raw as Record<string, unknown>).reheat_q_w ||
      (raw as Record<string, unknown>).reaquecimentoKw,
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
