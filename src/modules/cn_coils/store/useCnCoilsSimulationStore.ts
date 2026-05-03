import { create } from "zustand";
import type {
  CoilGeometryCatalogItem,
  CnCoilsPhysicalInputs,
  CnCoilsSimulationResult,
  CnCoilsThermoInputs,
} from "../types/cncoils.types";
import type { StructuredWarning } from "../types/warnings";
import {
  DEFAULT_MATERIAL_PRICES,
  calculateBatteryCost,
  type MaterialKey,
  type MaterialPrices,
} from "../engine/costCalculator";
import { snapFinPitchToTool } from "../config/finPitchTools";

/**
 * Modo de cálculo do CN Coils:
 *  - "verify"  → Verificar (entrada de geometria conhecida, calcula performance)
 *  - "design"  → Desenho (entrada de demanda, dimensiona geometria)
 */
export type CalcMode = "verify" | "design";

/**
 * Inputs adicionais do Lado Fluido específicos por aplicação. Mantidos
 * separados de `CnCoilsThermoInputs` (consumido pelo motor existente) para
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

interface CnCoilsSimulationStore {
  physicalInputs: Partial<CnCoilsPhysicalInputs>;
  thermoInputs: Partial<CnCoilsThermoInputs>;
  selectedGeometry?: CoilGeometryCatalogItem;
  result?: CnCoilsSimulationResult;
  warnings: StructuredWarning[];
  isSimulating: boolean;

  /**
   * Fator de Erro / margem de segurança (%). Auto-preenchido a partir do
   * SecurityFactor da geometria selecionada: errorFactor = (SF - 1) * 100.
   * Aplicado como multiplicador no resultado final: q' = q * (1 + ef/100).
   * Valor 0 = sem margem (SF = 1.0). Editável pelo usuário.
   */
  errorFactorPercent: number;
  setErrorFactorPercent: (val: number) => void;

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
  fanCount: number;
  fanRole: "blower" | "exhaust";
  setAirFlow: (val: number) => void;
  setTempInDB: (val: number) => void;
  setRhIn: (val: number) => void;
  setFoulingFactorAir: (val: number) => void;
  setSelectedFan: (id: string | undefined) => void;
  setFanCount: (n: number) => void;
  setFanRole: (r: "blower" | "exhaust") => void;

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
  /**
   * Temperatura emparelhada (lado oposto):
   *  - Evaporadores: Temperatura de Condensação (Tc)
   *  - Condensadores: Temperatura de Evaporação (Te)
   * Necessária para o ponto de equilíbrio com compressor.
   */
  pairedTempC: number | null;
  /** Sobreaquecimento de descarga (gás quente entrando no condensador). */
  dischargeSuperheatK: number | null;
  /** Compressor selecionado (acopla o cálculo ao polinômio ASHRAE). */
  selectedCompressorId?: string;
  /** Spec do compressor carregado do catálogo (passado ao motor). */
  compressorSpec?: {
    cooling_capacity_w: number;
    power_w: number;
    refrigerant: string;
    evap_temp_c: number;
    cond_temp_c: number;
  };
  /** Quantidade de compressores aplicados (multiplica vazão mássica/capacidade). */
  compressorCount: number;
  setFluid: (val: string) => void;
  setFluidMassFlow: (val: number) => void;
  toggleMassFlowLock: () => void;
  setFluidOperatingTemp: (val: number) => void;
  setFluidTempReference: (val: "inlet" | "middle" | "outlet") => void;
  setSuperheat: (val: number) => void;
  setSubcooling: (val: number) => void;
  setFoulingFactorFluid: (val: number) => void;
  setPairedTempC: (val: number | null) => void;
  setDischargeSuperheatK: (val: number | null) => void;
  setSelectedCompressor: (id: string | undefined) => void;
  setCompressorCount: (n: number) => void;

  // Etapa 3.6 — Custo da bateria
  materialPrices: MaterialPrices;
  calculatedCost: number;
  tubeMaterialKey: MaterialKey;
  finMaterialKey: MaterialKey;
  setMaterialPrice: (material: MaterialKey, price: number) => void;
  setTubeMaterialKey: (key: MaterialKey) => void;
  setFinMaterialKey: (key: MaterialKey) => void;
  recalculateCost: () => void;

  setPhysicalInputs: (patch: Partial<CnCoilsPhysicalInputs>) => void;
  setThermoInputs: (patch: Partial<CnCoilsThermoInputs>) => void;
  setSelectedGeometry: (geometry: CoilGeometryCatalogItem | undefined) => void;
  setResult: (result: CnCoilsSimulationResult | undefined) => void;
  setWarnings: (warnings: StructuredWarning[]) => void;
  setIsSimulating: (value: boolean) => void;
  clearResult: () => void;
  reset: () => void;
}

// Defaults sensatos para que o usuário possa simular sem necessariamente
// abrir o modal de geometria. Todos os campos podem ser sobrescritos pela
// UI (GeometryBottomBar, GeometryForm, picker do catálogo, importação).
const DEFAULT_PHYSICAL_INPUTS: Partial<CnCoilsPhysicalInputs> = {
  finnedHeightMm: 600,
  finnedLengthMm: 1200,
  rows: 4,
  tubesPerRow: 16,
  circuits: 4,
  tubeMaterialId: "MAT_2", // Copper
  finPitchMm: 2.5,
  finThicknessMm: 0.12,
  tubePitchTransverseMm: 25,
  tubePitchLongitudinalMm: 21.65,
  tubeOuterDiameterMm: 9.52,
  tubeInnerDiameterMm: 8.92,
};

export const useCnCoilsSimulationStore = create<CnCoilsSimulationStore>((set) => ({
  physicalInputs: { ...DEFAULT_PHYSICAL_INPUTS },
  thermoInputs: {},
  selectedGeometry: undefined,
  result: undefined,
  warnings: [],
  isSimulating: false,
  errorFactorPercent: 0,
  setErrorFactorPercent: (val) =>
    set({ errorFactorPercent: Number.isFinite(val) ? val : 0 }),

  calcMode: "verify",
  setCalcMode: (mode) => set({ calcMode: mode }),

  engineVersion: "v1",
  setEngineVersion: (v) => set({ engineVersion: v }),

  targetCapacityW: 0,
  setTargetCapacityW: (val) => set({ targetCapacityW: val }),

  airFlow_m3h: 5000,
  tempInDB_C: 25,
  rhIn_pct: 60,
  foulingFactorAir: 0,
  selectedFanId: undefined,
  fanCount: 1,
  fanRole: "exhaust",
  setAirFlow: (val) => set({ airFlow_m3h: val }),
  setTempInDB: (val) => set({ tempInDB_C: val }),
  setRhIn: (val) => set({ rhIn_pct: val }),
  setFoulingFactorAir: (val) => set({ foulingFactorAir: val }),
  setSelectedFan: (id) => set({ selectedFanId: id }),
  setFanCount: (n) => set({ fanCount: Math.max(1, Math.floor(n) || 1) }),
  setFanRole: (r) => set({ fanRole: r }),

  fluidExtras: {},
  setFluidExtras: (patch) =>
    set((s) => ({ fluidExtras: { ...s.fluidExtras, ...patch } })),

  fluid: "REF_R404A",
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
  pairedTempC: null,
  dischargeSuperheatK: null,
  selectedCompressorId: undefined,
  compressorCount: 1,
  setPairedTempC: (val) => set({ pairedTempC: val }),
  setDischargeSuperheatK: (val) => set({ dischargeSuperheatK: val }),
  setSelectedCompressor: (id) => {
    set({ selectedCompressorId: id });
    if (id) {
      void import("@/modules/coldpro_catalog/data/compressorCatalog.service").then(
        ({ getCompressorById, toCompressorSpec }) =>
          getCompressorById(id).then((row) => {
            if (row) {
              const state = useCnCoilsSimulationStore.getState();
              const spec = toCompressorSpec(row, {
                evap_temp_c: state.fluidOperatingTemp_C,
                cond_temp_c: state.fluidOperatingTemp_C,
              });
              set({ compressorSpec: spec });
            }
          }),
      );
    } else {
      set({ compressorSpec: undefined });
    }
  },
  setCompressorCount: (n) => set({ compressorCount: Math.max(1, Math.floor(n) || 1) }),

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
      const merged = { ...s.physicalInputs, ...patch };
      // Sincroniza rowFinPitchesMm com rows quando passo variável estiver ativo.
      if (merged.isVariableFinPitch) {
        const rows = Math.max(1, Math.floor(merged.rows ?? 1));
        const current = merged.rowFinPitchesMm ?? [];
        const fallback = snapFinPitchToTool(merged.finPitchMm ?? 2.5);
        const next: number[] = [];
        for (let i = 0; i < rows; i++) {
          next.push(current[i] ?? current[current.length - 1] ?? fallback);
        }
        merged.rowFinPitchesMm = next;
      }
      return {
        physicalInputs: merged,
        calculatedCost: computeCostFromState({ ...s, physicalInputs: merged }),
      };
    }),
  setThermoInputs: (patch) =>
    set((s) => ({ thermoInputs: { ...s.thermoInputs, ...patch } })),
  setSelectedGeometry: (geometry) =>
    set((s) => {
      // Etapa 3.5 — auto-fill ao selecionar geometria do catálogo.
      // Quando uma geometria NOVA é escolhida (id diferente da anterior),
      // sobrescrevemos os parâmetros derivados da geometria (tubos, passos,
      // espessuras, default de filas/circuitos/comprimento) para refletir
      // exatamente o item escolhido. Quando o usuário reabre o modal e
      // confirma a MESMA geometria, preservamos seus ajustes manuais.
      const enriched = geometry as
        | (CoilGeometryCatalogItem & {
            espessura_tubo_mm?: number | null;
            espessura_aleta_mm?: number | null;
          })
        | undefined;
      const rawFinPitch =
        geometry?.raw && typeof geometry.raw === "object"
          ? (geometry.raw as Record<string, unknown>)["fin_pitch_mm"]
          : undefined;
      const finPitchFromCatalog =
        typeof rawFinPitch === "number" && Number.isFinite(rawFinPitch)
          ? rawFinPitch
          : undefined;

      const previousId = s.physicalInputs.geometryId;
      const isNewGeometry = !!geometry && geometry.id !== previousId;
      const pick = <T,>(fresh: T | undefined, current: T | undefined): T | undefined =>
        isNewGeometry ? (fresh ?? current) : (current ?? fresh);

      const finnedHeightMm = pick(600, s.physicalInputs.finnedHeightMm);
      const tubesPerRowFromHeight =
        geometry && geometry.tubePitchTransverseMm > 0 && finnedHeightMm
          ? Math.max(
              1,
              Math.round(finnedHeightMm / geometry.tubePitchTransverseMm),
            )
          : undefined;

      const physicalInputs = geometry
        ? {
            ...s.physicalInputs,
            geometryId: geometry.id,
            tubePitchTransverseMm: geometry.tubePitchTransverseMm,
            tubePitchLongitudinalMm: geometry.tubePitchLongitudinalMm,
            tubeOuterDiameterMm: geometry.tubeOuterDiameterMm,
            tubeInnerDiameterMm: pick(
              geometry.tubeInnerDiameterMm ?? undefined,
              s.physicalInputs.tubeInnerDiameterMm,
            ),
            finThicknessMm: pick(
              enriched?.espessura_aleta_mm ?? undefined,
              s.physicalInputs.finThicknessMm,
            ),
            finPitchMm: pick(
              snapFinPitchToTool(finPitchFromCatalog ?? 2.5),
              s.physicalInputs.finPitchMm,
            ),
            finnedLengthMm: pick(1000, s.physicalInputs.finnedLengthMm),
            finnedHeightMm,
            rows: pick(geometry.defaultRows ?? 4, s.physicalInputs.rows),
            circuits: pick(
              geometry.defaultCircuits ?? 12,
              s.physicalInputs.circuits,
            ),
            tubesPerRow: pick(
              tubesPerRowFromHeight,
              s.physicalInputs.tubesPerRow,
            ),
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
      physicalInputs: { ...DEFAULT_PHYSICAL_INPUTS },
      thermoInputs: {},
      selectedGeometry: undefined,
      result: undefined,
      warnings: [],
      isSimulating: false,
      errorFactorPercent: 0,
      calcMode: "verify",
      targetCapacityW: 0,
      airFlow_m3h: 5000,
      tempInDB_C: 25,
      rhIn_pct: 60,
      foulingFactorAir: 0,
      selectedFanId: undefined,
      fanCount: 1,
      fanRole: "exhaust",
      fluidExtras: {},
      fluid: "REF_R404A",
      fluidMassFlow_kg_h: 0,
      isMassFlowLocked: true,
      fluidOperatingTemp_C: 45,
      fluidTempReference: "middle",
      superheat_K: 5,
      subcooling_K: 3,
      foulingFactorFluid: 0,
      pairedTempC: null,
      dischargeSuperheatK: null,
      selectedCompressorId: undefined,
      compressorCount: 1,
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
  physicalInputs: Partial<CnCoilsPhysicalInputs>;
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
