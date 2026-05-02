import { create } from "zustand";
import type {
  CoilGeometryCatalogItem,
  UnilabPhysicalInputs,
  UnilabSimulationResult,
  UnilabThermoInputs,
} from "../types/unilab.types";

interface UnilabSimulationStore {
  physicalInputs: Partial<UnilabPhysicalInputs>;
  thermoInputs: Partial<UnilabThermoInputs>;
  selectedGeometry?: CoilGeometryCatalogItem;
  selectedFanId?: string;
  result?: UnilabSimulationResult;
  warnings: string[];
  isSimulating: boolean;

  setPhysicalInputs: (patch: Partial<UnilabPhysicalInputs>) => void;
  setThermoInputs: (patch: Partial<UnilabThermoInputs>) => void;
  setSelectedGeometry: (geometry: CoilGeometryCatalogItem | undefined) => void;
  setSelectedFanId: (fanId: string | undefined) => void;
  setResult: (result: UnilabSimulationResult | undefined) => void;
  setWarnings: (warnings: string[]) => void;
  setIsSimulating: (value: boolean) => void;
  clearResult: () => void;
  reset: () => void;
}

export const useUnilabSimulationStore = create<UnilabSimulationStore>((set) => ({
  physicalInputs: {},
  thermoInputs: {},
  selectedGeometry: undefined,
  selectedFanId: undefined,
  result: undefined,
  warnings: [],
  isSimulating: false,

  setPhysicalInputs: (patch) =>
    set((s) => ({ physicalInputs: { ...s.physicalInputs, ...patch } })),
  setThermoInputs: (patch) =>
    set((s) => ({ thermoInputs: { ...s.thermoInputs, ...patch } })),
  setSelectedGeometry: (geometry) =>
    set((s) => ({
      selectedGeometry: geometry,
      physicalInputs: geometry
        ? {
            ...s.physicalInputs,
            geometryId: geometry.id,
            tubePitchTransverseMm: geometry.tubePitchTransverseMm,
            tubePitchLongitudinalMm: geometry.tubePitchLongitudinalMm,
            tubeOuterDiameterMm: geometry.tubeOuterDiameterMm,
            tubeInnerDiameterMm:
              geometry.tubeInnerDiameterMm ?? s.physicalInputs.tubeInnerDiameterMm,
            rows: geometry.defaultRows ?? s.physicalInputs.rows,
            circuits: geometry.defaultCircuits ?? s.physicalInputs.circuits,
          }
        : s.physicalInputs,
    })),
  setSelectedFanId: (fanId) => set({ selectedFanId: fanId }),
  setResult: (result) => set({ result }),
  setWarnings: (warnings) => set({ warnings }),
  setIsSimulating: (value) => set({ isSimulating: value }),
  clearResult: () => set({ result: undefined, warnings: [] }),
  reset: () =>
    set({
      physicalInputs: {},
      thermoInputs: {},
      selectedGeometry: undefined,
      selectedFanId: undefined,
      result: undefined,
      warnings: [],
      isSimulating: false,
    }),
}));
