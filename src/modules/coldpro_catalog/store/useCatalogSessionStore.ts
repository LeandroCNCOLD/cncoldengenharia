import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

interface CatalogSessionState {
  selectedCompressor?: CatalogEquipmentRow;
  selectedCondenser?: CatalogEquipmentRow;
  selectedEvaporator?: CatalogEquipmentRow;
  selectedReheatCoil?: CatalogEquipmentRow;

  setCompressor: (item: CatalogEquipmentRow | undefined) => void;
  setCondenser: (item: CatalogEquipmentRow | undefined) => void;
  setEvaporator: (item: CatalogEquipmentRow | undefined) => void;
  setReheatCoil: (item: CatalogEquipmentRow | undefined) => void;
  clearSelection: () => void;
}

export const useCatalogSessionStore = create<CatalogSessionState>()(
  persist(
    (set) => ({
      selectedCompressor: undefined,
      selectedCondenser: undefined,
      selectedEvaporator: undefined,
      selectedReheatCoil: undefined,
      setCompressor: (item) => set({ selectedCompressor: item }),
      setCondenser: (item) => set({ selectedCondenser: item }),
      setEvaporator: (item) => set({ selectedEvaporator: item }),
      setReheatCoil: (item) => set({ selectedReheatCoil: item }),
      clearSelection: () =>
        set({
          selectedCompressor: undefined,
          selectedCondenser: undefined,
          selectedEvaporator: undefined,
          selectedReheatCoil: undefined,
        }),
    }),
    { name: "coldpro-catalog-session" },
  ),
);
