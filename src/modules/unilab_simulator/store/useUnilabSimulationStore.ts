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
  result?: UnilabSimulationResult;
  warnings: string[];
  isSimulating: boolean;

  // Lado Ar / Ventilação (Etapa 3)
  airFlow_m3h: number;
  tempInDB_C: number;
  rhIn_pct: number;
  foulingFactorAir: number;
  selectedFanId?: string;
  setAirFlow: (val: number) => void;
  setTempInDB: (val: number) => void;
  setRhIn: (val: number) => void;
  setFoulingFactorAir: (val: number) => void;
  setSelectedFan: (id: string | undefined) => void;

  setPhysicalInputs: (patch: Partial<UnilabPhysicalInputs>) => void;
  setThermoInputs: (patch: Partial<UnilabThermoInputs>) => void;
  setSelectedGeometry: (geometry: CoilGeometryCatalogItem | undefined) => void;
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
  result: undefined,
  warnings: [],
  isSimulating: false,

  airFlow_m3h: 0,
  tempInDB_C: 25,
  rhIn_pct: 60,
  foulingFactorAir: 0,
  selectedFanId: undefined,
  setAirFlow: (val) => set({ airFlow_m3h: val }),
  setTempInDB: (val) => set({ tempInDB_C: val }),
  setRhIn: (val) => set({ rhIn_pct: val }),
  setFoulingFactorAir: (val) => set({ foulingFactorAir: val }),
  setSelectedFan: (id) => set({ selectedFanId: id }),

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
  setResult: (result) => set({ result }),
  setWarnings: (warnings) => set({ warnings }),
  setIsSimulating: (value) => set({ isSimulating: value }),
  clearResult: () => set({ result: undefined, warnings: [] }),
  reset: () =>
    set({
      physicalInputs: {},
      thermoInputs: {},
      selectedGeometry: undefined,
      result: undefined,
      warnings: [],
      isSimulating: false,
      airFlow_m3h: 0,
      tempInDB_C: 25,
      rhIn_pct: 60,
      foulingFactorAir: 0,
      selectedFanId: undefined,
    }),
}));
