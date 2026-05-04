import { create } from "zustand";

import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

interface CatalogPreloadState {
  pendingEvaporator: CatalogEquipmentRow | null;
  pendingCondenser: CatalogEquipmentRow | null;
  pendingCompressor: CatalogEquipmentRow | null;
  setPendingEvaporator: (row: CatalogEquipmentRow | null) => void;
  setPendingCondenser: (row: CatalogEquipmentRow | null) => void;
  setPendingCompressor: (row: CatalogEquipmentRow | null) => void;
  clearAll: () => void;
}

export const useCatalogPreloadStore = create<CatalogPreloadState>()((set) => ({
  pendingEvaporator: null,
  pendingCondenser: null,
  pendingCompressor: null,
  setPendingEvaporator: (row) => set({ pendingEvaporator: row }),
  setPendingCondenser: (row) => set({ pendingCondener: row } as never),
  setPendingCompressor: (row) => set({ pendingCompressor: row }),
  clearAll: () =>
    set({
      pendingEvaporator: null,
      pendingCondenser: null,
      pendingCompressor: null,
    }),
}));
