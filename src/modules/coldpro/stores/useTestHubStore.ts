/**
 * useTestHubStore — Store Zustand do Hub de Testes
 *
 * Centraliza o estado compartilhado entre todas as abas do Hub:
 * - Configuração da máquina (compressor, evaporador, condensador, condições)
 * - Resultados de cada análise (ciclo PH, Monte Carlo, polinômios, otimização, IA)
 * - Flags de loading e erros por análise
 * - Trigger de auto-disparo ao selecionar máquina do catálogo
 */
import { create } from "zustand";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import type { EvaporatorFormValue } from "../components/forms/EvaporatorForm";
import type { SystemConditions } from "../components/forms/SystemConditionsForm";
import type { CatalogEquipmentRow } from "@/modules/coldpro_catalog/data/equipmentCatalog.types";

// ── Tipos dos resultados de cada análise ─────────────────────────────────────

export interface PhCyclePoint {
  label: string;
  h_kJkg: number;
  P_kPa: number;
  T_C: number;
  quality?: number;
  phase: "subcooled" | "two_phase" | "superheated" | "liquid" | "vapor";
}

export interface PhSaturationPoint {
  T_C: number;
  P_kPa: number;
  h_f_kJkg: number;
  h_g_kJkg: number;
}

export interface PhDiagramResult {
  points: PhCyclePoint[];
  saturationCurve: PhSaturationPoint[];
  refrigerant: string;
  Te_C: number;
  Tc_C: number;
  superheatK: number;
  subcoolingK: number;
  COP: number;
  EER: number;
  qEvap_kJkg: number;
  wComp_kJkg: number;
  qCond_kJkg: number;
  compressionRatio: number;
  dischargeTemp_C: number;
  warnings: string[];
}

export interface MonteCarloResult {
  samples: number;
  confidenceLevel: number;
  capacity: { nominal: number; lower: number; upper: number; stdDev: number };
  cop: { nominal: number; lower: number; upper: number; stdDev: number };
  eer: { nominal: number; lower: number; upper: number; stdDev: number };
  airPressureDrop: { nominal: number; lower: number; upper: number; stdDev: number };
  overallU: { nominal: number; lower: number; upper: number; stdDev: number };
  histogram: { bin: number; count: number }[];
  sensitivityRanking: { parameter: string; impact_pct: number; description: string }[];
  warnings: string[];
  computeTimeMs: number;
}

export interface PolynomialResult {
  refrigerant: string;
  norm: "ARI 540" | "EN 12900";
  grid: { Te_C: number; Tc_C: number; Q_W: number; W_W: number; COP: number }[];
  coefficients: {
    target: string;
    a0: number; a1: number; a2: number; a3: number; a4: number; a5: number;
    r2: number;
    maxError_pct: number;
  }[];
  warnings: string[];
}

export interface OptimizationResult {
  status: "ok" | "warning" | "error";
  bestEquilibrium: {
    Te_C: number;
    Tc_C: number;
    Q_evap_W: number;
    COP: number;
    compressor_pct: number;
    evaporator_pct: number;
    condenser_pct: number;
    balance_error_pct: number;
  } | null;
  recommendations: string[];
  adjustments: {
    parameter: string;
    current: string;
    suggested: string;
    expectedGain: string;
    priority: "high" | "medium" | "low";
  }[];
  teRange: { Te_C: number; Q_W: number; COP: number; status: string }[];
  warnings: string[];
}

export interface AIAnalysisResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  diagnoses: {
    category: string;
    severity: "ok" | "warning" | "critical";
    finding: string;
    explanation: string;
    reference: string;
  }[];
  recommendations: {
    priority: number;
    action: string;
    expectedImpact: string;
    reference: string;
  }[];
  thermodynamicInsights: string[];
  warnings: string[];
}

// ── Estado do store ───────────────────────────────────────────────────────────

export type AnalysisKey = "ph" | "montecarlo" | "polynomial" | "optimization" | "ai";

interface AnalysisState<T> {
  result: T | null;
  loading: boolean;
  error: string | null;
  lastRunAt: number | null;
}

function emptyAnalysis<T>(): AnalysisState<T> {
  return { result: null, loading: false, error: null, lastRunAt: null };
}

interface TestHubState {
  // Configuração da máquina
  selectedMachine: CatalogEquipmentRow | null;
  compressor: Partial<CompressorSpec>;
  condenser: Partial<CondenserSpec>;
  evaporator: EvaporatorFormValue;
  conditions: Partial<SystemConditions>;
  isConfigured: boolean;

  // Resultados das análises
  ph: AnalysisState<PhDiagramResult>;
  montecarlo: AnalysisState<MonteCarloResult>;
  polynomial: AnalysisState<PolynomialResult>;
  optimization: AnalysisState<OptimizationResult>;
  ai: AnalysisState<AIAnalysisResult>;

  // Ações de configuração
  setMachine: (row: CatalogEquipmentRow) => void;
  setCompressor: (v: Partial<CompressorSpec>) => void;
  setCondenser: (v: Partial<CondenserSpec>) => void;
  setEvaporator: (v: EvaporatorFormValue) => void;
  setConditions: (v: Partial<SystemConditions>) => void;
  clearMachine: () => void;

  // Ações de análise
  setAnalysisLoading: (key: AnalysisKey, loading: boolean) => void;
  setAnalysisResult: <T>(key: AnalysisKey, result: T) => void;
  setAnalysisError: (key: AnalysisKey, error: string) => void;
  clearAnalysis: (key: AnalysisKey) => void;
  clearAllAnalyses: () => void;
}

export const useTestHubStore = create<TestHubState>()((set) => ({
  selectedMachine: null,
  compressor: { refrigerant: "R404A" },
  condenser: {},
  evaporator: {},
  conditions: {},
  isConfigured: false,

  ph: emptyAnalysis<PhDiagramResult>(),
  montecarlo: emptyAnalysis<MonteCarloResult>(),
  polynomial: emptyAnalysis<PolynomialResult>(),
  optimization: emptyAnalysis<OptimizationResult>(),
  ai: emptyAnalysis<AIAnalysisResult>(),

  setMachine: (row) => set({ selectedMachine: row }),
  setCompressor: (v) => set((s) => ({ compressor: v, isConfigured: checkConfigured(v, s.condenser, s.evaporator) })),
  setCondenser: (v) => set((s) => ({ condenser: v, isConfigured: checkConfigured(s.compressor, v, s.evaporator) })),
  setEvaporator: (v) => set((s) => ({ evaporator: v, isConfigured: checkConfigured(s.compressor, s.condenser, v) })),
  setConditions: (v) => set({ conditions: v }),
  clearMachine: () => set({
    selectedMachine: null,
    compressor: { refrigerant: "R404A" },
    condenser: {},
    evaporator: {},
    conditions: {},
    isConfigured: false,
  }),

  setAnalysisLoading: (key, loading) =>
    set((s) => ({ [key]: { ...s[key], loading, error: null } })),
  setAnalysisResult: (key, result) =>
    set((s) => ({ [key]: { ...s[key], result, loading: false, error: null, lastRunAt: Date.now() } })),
  setAnalysisError: (key, error) =>
    set((s) => ({ [key]: { ...s[key], error, loading: false } })),
  clearAnalysis: (key) =>
    set({ [key]: emptyAnalysis() }),
  clearAllAnalyses: () =>
    set({
      ph: emptyAnalysis(),
      montecarlo: emptyAnalysis(),
      polynomial: emptyAnalysis(),
      optimization: emptyAnalysis(),
      ai: emptyAnalysis(),
    }),
}));

function checkConfigured(
  comp: Partial<CompressorSpec>,
  cond: Partial<CondenserSpec>,
  evap: EvaporatorFormValue,
): boolean {
  return Boolean(
    comp.cooling_capacity_w && comp.cooling_capacity_w > 0 &&
    cond.heat_rejection_capacity_w && cond.heat_rejection_capacity_w > 0 &&
    evap.rows_total && evap.rows_total > 0,
  );
}
