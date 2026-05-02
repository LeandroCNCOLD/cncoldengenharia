import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

export type RevisionSource = "simulation" | "manual_review" | "catalog_import";

export interface CatalogRevisionEntry {
  equipmentId: string;
  revisionId: string;
  revisionNumber: number;
  createdAt: string;
  createdBy?: string;
  source: RevisionSource;
  notes?: string;
  snapshot: CatalogEquipmentRow;
}

interface CatalogRevisionState {
  revisions: CatalogRevisionEntry[];
  addRevision: (
    equipment: CatalogEquipmentRow,
    source: RevisionSource,
    notes?: string,
    createdBy?: string,
  ) => CatalogRevisionEntry;
  listRevisions: (equipmentId: string) => CatalogRevisionEntry[];
  clearRevisions: (equipmentId: string) => void;
  clearAll: () => void;
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useCatalogRevisionStore = create<CatalogRevisionState>()(
  persist(
    (set, get) => ({
      revisions: [],
      addRevision: (equipment, source, notes, createdBy) => {
        const existing = get().revisions.filter(
          (r) => r.equipmentId === equipment.id,
        );
        const nextNumber =
          existing.reduce((acc, r) => Math.max(acc, r.revisionNumber), 0) + 1;
        const entry: CatalogRevisionEntry = {
          equipmentId: equipment.id,
          revisionId: genId(),
          revisionNumber: nextNumber,
          createdAt: new Date().toISOString(),
          createdBy,
          source,
          notes,
          snapshot: equipment,
        };
        set((state) => ({ revisions: [...state.revisions, entry] }));
        return entry;
      },
      listRevisions: (equipmentId) =>
        get()
          .revisions.filter((r) => r.equipmentId === equipmentId)
          .sort((a, b) => b.revisionNumber - a.revisionNumber),
      clearRevisions: (equipmentId) =>
        set((state) => ({
          revisions: state.revisions.filter(
            (r) => r.equipmentId !== equipmentId,
          ),
        })),
      clearAll: () => set({ revisions: [] }),
    }),
    { name: "coldpro-catalog-revisions" },
  ),
);
