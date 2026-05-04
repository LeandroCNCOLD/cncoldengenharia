import { describe, it, expect, beforeEach } from "vitest";
import { useExtractedDataStore } from "../useExtractedDataStore";
import type { ExtractedGeometry, ExtractedCompressor } from "../useExtractedDataStore";

// Reseta o store antes de cada teste
beforeEach(() => {
  useExtractedDataStore.getState().clearAll();
});

const sampleGeometry: Omit<ExtractedGeometry, "id" | "extractedAt"> = {
  source: "unilab",
  height_mm: 400,
  width_mm: 1200,
  depth_mm: 87,
  finPitch_mm: 2.1,
  tubeDiameter_mm: 9.52,
  tubeRows: 3,
  tubesPerRow: 12,
  circuitCount: 4,
};

const sampleCompressor: Omit<ExtractedCompressor, "id" | "extractedAt"> = {
  source: "bitzer",
  model: "2KES-05",
  refrigerant: "R404A",
  coefficients: [1.08, -0.0069, 4.66e-5],
  norm: "EN12900",
};

describe("useExtractedDataStore — geometrias", () => {
  it("adiciona e remove geometria corretamente", () => {
    const { addGeometry, removeGeometry } = useExtractedDataStore.getState();

    addGeometry(sampleGeometry);
    expect(useExtractedDataStore.getState().geometries).toHaveLength(1);

    const id = useExtractedDataStore.getState().geometries[0].id;
    removeGeometry(id);
    expect(useExtractedDataStore.getState().geometries).toHaveLength(0);
  });
});

describe("useExtractedDataStore — compressores", () => {
  it("adiciona e remove compressor corretamente", () => {
    const { addCompressor, removeCompressor } = useExtractedDataStore.getState();

    addCompressor(sampleCompressor);
    expect(useExtractedDataStore.getState().compressors).toHaveLength(1);

    const id = useExtractedDataStore.getState().compressors[0].id;
    removeCompressor(id);
    expect(useExtractedDataStore.getState().compressors).toHaveLength(0);
  });
});

describe("useExtractedDataStore — clearAll", () => {
  it("limpa geometrias e compressores", () => {
    const { addGeometry, addCompressor, clearAll } = useExtractedDataStore.getState();

    addGeometry(sampleGeometry);
    addCompressor(sampleCompressor);
    expect(useExtractedDataStore.getState().geometries).toHaveLength(1);
    expect(useExtractedDataStore.getState().compressors).toHaveLength(1);

    clearAll();
    expect(useExtractedDataStore.getState().geometries).toHaveLength(0);
    expect(useExtractedDataStore.getState().compressors).toHaveLength(0);
  });
});
