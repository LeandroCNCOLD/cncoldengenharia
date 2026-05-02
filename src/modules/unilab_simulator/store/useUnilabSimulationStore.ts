import { create } from "zustand";
import type {
  CoilGeometryCatalogItem,
  UnilabPhysicalInputs,
  UnilabSimulationResult,
  UnilabThermoInputs,
} from "../types/unilab.types";

/**
 * Modo de cálculo do UNILAB:
 *  - "verify"  → Verificar (entrada de geometria conhecida, calcula performance)
 *  - "design"  → Desenho (entrada de demanda, dimensiona geometria)
 */
export type CalcMode = "verify" | "design";

/**
 * Inputs adicionais do Lado Fluido específicos por aplicação. Mantidos
 * separados de `UnilabThermoInputs` (consumido pelo motor existente) para
 * não alterar tipos do engine. O motor continua lendo o subset que conhece.
 */
export interface FluidSideExtras {
  fluidInletTempC?: number;
  fluidOutletTempC?: number;
  fluidFlowMassKgH?: number;
  fluidPressureDropKpa?: number;
  fluidFoulingFactor?: number;
  steamPressureKpa?: number;
}

interface UnilabSimulationStore {
  physicalInputs: Partial<UnilabPhysicalInputs>;
  thermoInputs: Partial<UnilabThermoInputs>;
  selectedGeometry?: CoilGeometryCatalogItem;
  result?: UnilabSimulationResult;
  warnings: string[];
  isSimulating: boolean;

  // Modo de cálculo (Verificar / Desenho) — UI apenas
  calcMode: CalcMode;
  setCalcMode: (mode: CalcMode) => void;

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

  // Lado Fluido (campos extras por aplicação — hidrônico/vapor)
  fluidExtras: FluidSideExtras;
  setFluidExtras: (patch: FluidSideExtras) => void;

  // Lado Fluido / Refrigerante (Etapa 4)
  fluid: string;
  fluidMassFlow_kg_h: number;
  fluidOperatingTemp_C: number;
  fluidTempReference: "inlet" | "middle" | "outlet";
  superheat_K: number;
  subcooling_K: number;
  foulingFactorFluid: number;
  setFluid: (val: string) => void;
  setFluidMassFlow: (val: number) => void;
  setFluidOperatingTemp: (val: number) => void;
  setFluidTempReference: (val: "inlet" | "middle" | "outlet") => void;
  setSuperheat: (val: number) => void;
  setSubcooling: (val: number) => void;
  setFoulingFactorFluid: (val: number) => void;

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

  calcMode: "verify",
  setCalcMode: (mode) => set({ calcMode: mode }),

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

  fluidExtras: {},
  setFluidExtras: (patch) =>
    set((s) => ({ fluidExtras: { ...s.fluidExtras, ...patch } })),

  fluid: "R404A",
  fluidMassFlow_kg_h: 0,
  fluidOperatingTemp_C: 0,
  fluidTempReference: "middle",
  superheat_K: 0,
  subcooling_K: 0,
  foulingFactorFluid: 0,
  setFluid: (val) => set({ fluid: val }),
  setFluidMassFlow: (val) => set({ fluidMassFlow_kg_h: val }),
  setFluidOperatingTemp: (val) => set({ fluidOperatingTemp_C: val }),
  setFluidTempReference: (val) => set({ fluidTempReference: val }),
  setSuperheat: (val) => set({ superheat_K: val }),
  setSubcooling: (val) => set({ subcooling_K: val }),
  setFoulingFactorFluid: (val) => set({ foulingFactorFluid: val }),

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
      calcMode: "verify",
      airFlow_m3h: 0,
      tempInDB_C: 25,
      rhIn_pct: 60,
      foulingFactorAir: 0,
      selectedFanId: undefined,
      fluidExtras: {},
      fluid: "R404A",
      fluidMassFlow_kg_h: 0,
      fluidOperatingTemp_C: 0,
      fluidTempReference: "middle",
      superheat_K: 0,
      subcooling_K: 0,
      foulingFactorFluid: 0,
    }),
}));
