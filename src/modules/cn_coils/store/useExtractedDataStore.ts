/**
 * Feature B — Modelagem de Dados Extraídos
 * Store Zustand com persist para geometrias e compressores extraídos de catálogos.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ExtractedGeometry {
  id: string;
  source: "unilab" | "manual" | "catalog";
  height_mm: number;
  width_mm: number;
  depth_mm: number;
  finPitch_mm: number;
  tubeDiameter_mm: number;
  tubeRows: number;
  tubesPerRow: number;
  circuitCount: number;
  fatCorAl?: number;
  fatCoeflattub?: number;
  fatRidAumSup?: number;
  extractedAt: number; // UTC timestamp ms
}

export interface ExtractedCompressor {
  id: string;
  source: "bitzer" | "copeland" | "manual";
  model: string;
  refrigerant: string;
  coefficients: number[];
  norm: "AHRI540" | "EN12900";
  extractedAt: number; // UTC timestamp ms
}

interface ExtractedDataState {
  geometries: ExtractedGeometry[];
  compressors: ExtractedCompressor[];
  addGeometry: (geometry: Omit<ExtractedGeometry, "id" | "extractedAt">) => void;
  removeGeometry: (id: string) => void;
  addCompressor: (compressor: Omit<ExtractedCompressor, "id" | "extractedAt">) => void;
  removeCompressor: (id: string) => void;
  clearAll: () => void;
}

// ── Utilitário de ID ──────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useExtractedDataStore = create<ExtractedDataState>()(
  persist(
    (set) => ({
      geometries: [],
      compressors: [],

      addGeometry: (geometry) =>
        set((state) => ({
          geometries: [
            ...state.geometries,
            { ...geometry, id: generateId(), extractedAt: Date.now() },
          ],
        })),

      removeGeometry: (id) =>
        set((state) => ({
          geometries: state.geometries.filter((g) => g.id !== id),
        })),

      addCompressor: (compressor) =>
        set((state) => ({
          compressors: [
            ...state.compressors,
            { ...compressor, id: generateId(), extractedAt: Date.now() },
          ],
        })),

      removeCompressor: (id) =>
        set((state) => ({
          compressors: state.compressors.filter((c) => c.id !== id),
        })),

      clearAll: () => set({ geometries: [], compressors: [] }),
    }),
    {
      name: "cncold-extracted-data",
    },
  ),
);

// ── Hook de resumo ────────────────────────────────────────────────────────────

export function useExtractedDataSummary() {
  const geometries = useExtractedDataStore((s) => s.geometries);
  const compressors = useExtractedDataStore((s) => s.compressors);

  const geometryCount = geometries.length;
  const compressorCount = compressors.length;
  const hasData = geometryCount > 0 || compressorCount > 0;

  const allTimestamps = [
    ...geometries.map((g) => g.extractedAt),
    ...compressors.map((c) => c.extractedAt),
  ];
  const lastExtractedAt = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;

  return { geometryCount, compressorCount, lastExtractedAt, hasData };
}
