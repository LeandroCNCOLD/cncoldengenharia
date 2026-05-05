/**
 * DESATIVADO. O catálogo de ventiladores do CN Coils agora vem do
 * arquivo TypeScript src/modules/cn_coils/data/fanCatalog.ts (FAN_CATALOG).
 *
 * Este hook foi mantido apenas para preservar a interface pública e evitar
 * quebras em qualquer importador legado. Sempre retorna lista vazia.
 */
import type { FanFunction } from "../services/cncoilsCoefficientsService";
import type { FanPickerItem } from "../components/FanPickerModal";

export type { FanFunction };

export interface UseZiehlAbeggFanPickerItemsResult {
  items: FanPickerItem[];
  loading: boolean;
  error: string | null;
}

export function useZiehlAbeggFanPickerItems(): UseZiehlAbeggFanPickerItemsResult {
  return { items: [], loading: false, error: null };
}
