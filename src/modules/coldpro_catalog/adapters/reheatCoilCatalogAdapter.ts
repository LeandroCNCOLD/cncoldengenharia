import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { ReheatCoilSizingInput } from "@/modules/coldpro_v2";

export interface ReheatAdapterResult {
  input: ReheatCoilSizingInput | null;
  warnings: string[];
}

/**
 * O catálogo CN COLD atual não traz dados específicos de serpentina de
 * reaquecimento (Q alvo, T_air_in/out, pitches, vazão mássica de ar
 * dedicada à reaquecida etc.). Este adapter mantém a interface pronta
 * mas sempre retorna `input: null` enquanto o catálogo não expuser
 * esses campos. NÃO inventar valores.
 */
export function catalogToReheatCoilInput(_row: CatalogEquipmentRow): ReheatAdapterResult {
  return {
    input: null,
    warnings: [
      "Catálogo não fornece parâmetros de reaquecimento (Q_alvo, T_in/T_out, geometria). Configure manualmente em Componentes.",
    ],
  };
}
