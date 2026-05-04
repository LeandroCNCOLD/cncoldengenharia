import { create } from "zustand";

export type CapacityUnit = "kW" | "kcal/h" | "BTU/h" | "TR";

interface UnitStore {
  capacityUnit: CapacityUnit;
  setCapacityUnit: (unit: CapacityUnit) => void;
}

export const useUnitStore = create<UnitStore>((set) => ({
  capacityUnit: "kW",
  setCapacityUnit: (capacityUnit) => set({ capacityUnit }),
}));

/**
 * Converte capacidade a partir de kW para a unidade selecionada.
 */
export function convertCapacity(valueKw: number, unit: CapacityUnit): number {
  switch (unit) {
    case "kcal/h":
      return valueKw * 860;
    case "BTU/h":
      return valueKw * 3412.142;
    case "TR":
      return valueKw / 3.517;
    case "kW":
    default:
      return valueKw;
  }
}
