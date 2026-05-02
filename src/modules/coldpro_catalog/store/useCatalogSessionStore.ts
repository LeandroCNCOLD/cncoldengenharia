import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

interface CatalogSessionState {
  selectedCompressor?: CatalogEquipmentRow;
  selectedCondenser?: CatalogEquipmentRow;

  setCompressor: (item: CatalogEquipmentRow | undefined) => void;
  setCondenser: (item: CatalogEquipmentRow | undefined) => void;
  clearSelection: () => void;
}

export const useCatalogSessionStore = create<CatalogSessionState>()(
  persist(
    (set) => ({
      selectedCompressor: undefined,
      selectedCondenser: undefined,
      setCompressor: (item) => set({ selectedCompressor: item }),
      setCondenser: (item) => set({ selectedCondenser: item }),
      clearSelection: () =>
        set({ selectedCompressor: undefined, selectedCondenser: undefined }),
    }),
    { name: "coldpro-catalog-session" },
  ),
);
