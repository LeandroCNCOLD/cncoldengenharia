import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ValidationStatus } from "../data/equipmentCatalog.types";

export interface ValidationOverride {
  equipmentId: string;
  validationStatus: ValidationStatus;
  reviewedAt: string;
  reviewedBy?: string;
  notes?: string[];
}

interface CatalogValidationState {
  overrides: Record<string, ValidationOverride>;
  setStatus: (
    equipmentId: string,
    status: ValidationStatus,
    reviewedBy?: string,
    notes?: string[],
  ) => void;
  getOverride: (equipmentId: string) => ValidationOverride | undefined;
  clear: (equipmentId: string) => void;
}

export const useCatalogValidationStore = create<CatalogValidationState>()(
  persist(
    (set, get) => ({
      overrides: {},
      setStatus: (equipmentId, status, reviewedBy, notes) =>
        set((state) => ({
          overrides: {
            ...state.overrides,
            [equipmentId]: {
              equipmentId,
              validationStatus: status,
              reviewedAt: new Date().toISOString(),
              reviewedBy,
              notes,
            },
          },
        })),
      getOverride: (id) => get().overrides[id],
      clear: (equipmentId) =>
        set((state) => {
          const { [equipmentId]: _removed, ...rest } = state.overrides;
          return { overrides: rest };
        }),
    }),
    { name: "coldpro-catalog-validation" },
  ),
);
