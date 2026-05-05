/**
 * Hook do FanPicker do CN Coils.
 *
 * Após a reinstalação do catálogo Ziehl-Abegg, esta camada serve
 * EXCLUSIVAMENTE os 9 modelos do FAN_CATALOG (com curvas Q×ΔP reais
 * extraídas dos datasheets oficiais).
 *
 * Mantém a assinatura { items, loading, error } esperada pelos consumidores
 * (AirSidePanel, EvaporatorUnifiedWorkspacePage, CondenserWorkspacePage).
 */
import { useFanCatalogPickerItems } from "./useFanCatalogPickerItems";
import type { FanPickerItem } from "../components/FanPickerModal";

export interface UseEnrichedFanPickerItemsResult {
  items: FanPickerItem[];
  loading: boolean;
  error: string | null;
}

export function useEnrichedFanPickerItems(): UseEnrichedFanPickerItemsResult {
  return useFanCatalogPickerItems();
}
