import { create } from "zustand";
import type {
  CoilGeometryCatalogItem,
  UnilabPhysicalInputs,
  UnilabSimulationResult,
  UnilabThermoInputs,
} from "../types/unilab.types";
import {
  DEFAULT_MATERIAL_PRICES,
  calculateBatteryCost,
  type MaterialKey,
  type MaterialPrices,
} from "../engine/costCalculator";

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

  // Versão do motor termodinâmico ("v1" Etapa 5 | "v2" Etapa 6 ASHRAE)
  engineVersion: "v1" | "v2";
  setEngineVersion: (v: "v1" | "v2") => void;

  // Capacidade alvo (modo Desenho) — em Watts (canonical)
  targetCapacityW: number;
  setTargetCapacityW: (val: number) => void;

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
  isMassFlowLocked: boolean;
  fluidOperatingTemp_C: number;
  fluidTempReference: "inlet" | "middle" | "outlet";
  superheat_K: number;
  subcooling_K: number;
  foulingFactorFluid: number;
  setFluid: (val: string) => void;
  setFluidMassFlow: (val: number) => void;
  toggleMassFlowLock: () => void;
  setFluidOperatingTemp: (val: number) => void;
  setFluidTempReference: (val: "inlet" | "middle" | "outlet") => void;
  setSuperheat: (val: number) => void;
  setSubcooling: (val: number) => void;
  setFoulingFactorFluid: (val: number) => void;

  // Etapa 3.6 — Custo da bateria
  materialPrices: MaterialPrices;
  calculatedCost: number;
  tubeMaterialKey: MaterialKey;
  finMaterialKey: MaterialKey;
  setMaterialPrice: (material: MaterialKey, price: number) => void;
  setTubeMaterialKey: (key: MaterialKey) => void;
  setFinMaterialKey: (key: MaterialKey) => void;
  recalculateCost: () => void;

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

  engineVersion: "v1",
  setEngineVersion: (v) => set({ engineVersion: v }),

  targetCapacityW: 0,
  setTargetCapacityW: (val) => set({ targetCapacityW: val }),

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
  isMassFlowLocked: true,
  fluidOperatingTemp_C: 45,
  fluidTempReference: "middle",
  superheat_K: 5,
  subcooling_K: 3,
  foulingFactorFluid: 0,
  setFluid: (val) => set({ fluid: val }),
  setFluidMassFlow: (val) => set({ fluidMassFlow_kg_h: val }),
  toggleMassFlowLock: () =>
    set((s) => ({ isMassFlowLocked: !s.isMassFlowLocked })),
  setFluidOperatingTemp: (val) => set({ fluidOperatingTemp_C: val }),
  setFluidTempReference: (val) => set({ fluidTempReference: val }),
  setSuperheat: (val) => set({ superheat_K: val }),
  setSubcooling: (val) => set({ subcooling_K: val }),
  setFoulingFactorFluid: (val) => set({ foulingFactorFluid: val }),

  // Etapa 3.6 — Custo da bateria
  materialPrices: { ...DEFAULT_MATERIAL_PRICES },
  calculatedCost: 0,
  tubeMaterialKey: "copper_kg",
  finMaterialKey: "aluminum_kg",
  setMaterialPrice: (material, price) =>
    set((s) => {
      const materialPrices = { ...s.materialPrices, [material]: price };
      const cost = computeCostFromState({ ...s, materialPrices });
      return { materialPrices, calculatedCost: cost };
    }),
  setTubeMaterialKey: (key) =>
    set((s) => {
      const cost = computeCostFromState({ ...s, tubeMaterialKey: key });
      return { tubeMaterialKey: key, calculatedCost: cost };
    }),
  setFinMaterialKey: (key) =>
    set((s) => {
      const cost = computeCostFromState({ ...s, finMaterialKey: key });
      return { finMaterialKey: key, calculatedCost: cost };
    }),
  recalculateCost: () =>
    set((s) => ({ calculatedCost: computeCostFromState(s) })),

  setPhysicalInputs: (patch) =>
    set((s) => {
      const physicalInputs = { ...s.physicalInputs, ...patch };
      return {
        physicalInputs,
        calculatedCost: computeCostFromState({ ...s, physicalInputs }),
      };
    }),
  setThermoInputs: (patch) =>
    set((s) => ({ thermoInputs: { ...s.thermoInputs, ...patch } })),
  setSelectedGeometry: (geometry) =>
    set((s) => {
      // Etapa 3.5 — auto-fill ao selecionar geometria do catálogo.
      // O CoilGeometryItem (enriquecido) traz espessuras em pt-BR; o catálogo
      // base não. Em ambos os casos preservamos valores anteriores do usuário.
      const enriched = geometry as
        | (CoilGeometryCatalogItem & {
            espessura_tubo_mm?: number | null;
            espessura_aleta_mm?: number | null;
          })
        | undefined;
      const physicalInputs = geometry
        ? {
            ...s.physicalInputs,
            geometryId: geometry.id,
            tubePitchTransverseMm: geometry.tubePitchTransverseMm,
            tubePitchLongitudinalMm: geometry.tubePitchLongitudinalMm,
            tubeOuterDiameterMm: geometry.tubeOuterDiameterMm,
            tubeInnerDiameterMm:
              geometry.tubeInnerDiameterMm ?? s.physicalInputs.tubeInnerDiameterMm,
            finThicknessMm:
              enriched?.espessura_aleta_mm ?? s.physicalInputs.finThicknessMm,
            rows: geometry.defaultRows ?? s.physicalInputs.rows,
            circuits: geometry.defaultCircuits ?? s.physicalInputs.circuits,
          }
        : s.physicalInputs;
      return {
        selectedGeometry: geometry,
        physicalInputs,
        calculatedCost: computeCostFromState({ ...s, physicalInputs }),
      };
    }),
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
      targetCapacityW: 0,
      airFlow_m3h: 0,
      tempInDB_C: 25,
      rhIn_pct: 60,
      foulingFactorAir: 0,
      selectedFanId: undefined,
      fluidExtras: {},
      fluid: "R404A",
      fluidMassFlow_kg_h: 0,
      isMassFlowLocked: true,
      fluidOperatingTemp_C: 45,
      fluidTempReference: "middle",
      superheat_K: 5,
      subcooling_K: 3,
      foulingFactorFluid: 0,
      materialPrices: { ...DEFAULT_MATERIAL_PRICES },
      calculatedCost: 0,
      tubeMaterialKey: "copper_kg",
      finMaterialKey: "aluminum_kg",
    }),
}));

/**
 * Calcula o custo a partir de um snapshot do estado.
 * Defensivo: retorna 0 quando faltam dados (evita NaN/Infinity).
 */
function computeCostFromState(s: {
  physicalInputs: Partial<UnilabPhysicalInputs>;
  materialPrices: MaterialPrices;
  tubeMaterialKey: MaterialKey;
  finMaterialKey: MaterialKey;
}): number {
  const p = s.physicalInputs;
  const tubesPerRow =
    p.tubesPerRow && p.tubesPerRow > 0
      ? p.tubesPerRow
      : p.finnedHeightMm && p.tubePitchTransverseMm && p.tubePitchTransverseMm > 0
        ? Math.max(1, Math.round(p.finnedHeightMm / p.tubePitchTransverseMm))
        : 0;
  const result = calculateBatteryCost({
    tubesPerRow,
    rows: p.rows ?? 0,
    finnedLengthMm: p.finnedLengthMm ?? 0,
    finnedHeightMm: p.finnedHeightMm ?? 0,
    finPitchMm: p.finPitchMm ?? 0,
    tubeOuterDiameterMm: p.tubeOuterDiameterMm ?? 0,
    tubeInnerDiameterMm: p.tubeInnerDiameterMm ?? 0,
    finThicknessMm: p.finThicknessMm ?? 0,
    tubePitchTransverseMm: p.tubePitchTransverseMm ?? 0,
    tubeMaterial: s.tubeMaterialKey,
    finMaterial: s.finMaterialKey,
    prices: s.materialPrices,
  });
  return result.totalCost;
}
