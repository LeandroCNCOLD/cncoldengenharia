// Etapa 3.6 — Cálculo de custo de materiais da bateria aletada (tubos + aletas).
//
// Sem dependências externas — recebe um snapshot dos parâmetros geométricos e
// retorna o peso e o custo total. Tratamento defensivo para evitar NaN/Infinity.

export type MaterialKey =
  | "copper_kg"
  | "aluminum_kg"
  | "stainless_steel_kg"
  | "carbon_steel_kg";

export interface MaterialPrices {
  copper_kg: number;
  aluminum_kg: number;
  stainless_steel_kg: number;
  carbon_steel_kg: number;
}

export const DEFAULT_MATERIAL_PRICES: MaterialPrices = {
  copper_kg: 10.0,
  aluminum_kg: 4.5,
  stainless_steel_kg: 8.0,
  carbon_steel_kg: 2.5,
};

/** Densidades (kg/m³) — referências industriais. */
export const MATERIAL_DENSITY_KG_M3: Record<MaterialKey, number> = {
  copper_kg: 8960,
  aluminum_kg: 2700,
  stainless_steel_kg: 7900,
  carbon_steel_kg: 7850,
};

export const MATERIAL_LABELS: Record<MaterialKey, string> = {
  copper_kg: "Cobre",
  aluminum_kg: "Alumínio",
  stainless_steel_kg: "Aço Inox",
  carbon_steel_kg: "Aço Carbono",
};

export interface CostCalcInputs {
  /** Geometria — barra inferior */
  tubesPerRow: number;
  rows: number;
  finnedLengthMm: number;       // comprimento aletado
  finnedHeightMm: number;       // altura aletada
  finPitchMm: number;
  // dimensões herdadas da geometria do catálogo
  tubeOuterDiameterMm: number;  // OD
  tubeInnerDiameterMm: number;  // ID
  finThicknessMm: number;
  tubePitchTransverseMm: number;
  // material
  tubeMaterial: MaterialKey;
  finMaterial: MaterialKey;
  prices: MaterialPrices;
  /**
   * BDI — Benefícios e Despesas Indiretas (%). Multiplicador aplicado sobre o
   * custo direto de materiais (tubos + aletas) para incorporar mão de obra,
   * encargos, impostos, despesas indiretas e lucro.
   * Ex.: BDI = 25 → totalCost = directCost * 1.25.
   * Padrão: 0 (sem BDI) para preservar compatibilidade.
   */
  bdiPercent?: number;
}

export interface CostCalcResult {
  tubesWeightKg: number;
  finsWeightKg: number;
  tubesCost: number;
  finsCost: number;
  /** Custo direto = tubesCost + finsCost (sem BDI). */
  directCost: number;
  /** Percentual de BDI aplicado (echo do input, default 0). */
  bdiPercent: number;
  /** Valor monetário do BDI = directCost * bdiPercent / 100. */
  bdiAmount: number;
  /** Custo total = directCost + bdiAmount. */
  totalCost: number;
}

const safe = (n: number | undefined, fallback = 0): number =>
  Number.isFinite(n) && (n as number) > 0 ? (n as number) : fallback;

export function calculateBatteryCost(input: CostCalcInputs): CostCalcResult {
  const tubesPerRow = safe(input.tubesPerRow);
  const rows = safe(input.rows);
  const finnedLengthMm = safe(input.finnedLengthMm);
  const finnedHeightMm = safe(input.finnedHeightMm);
  const finPitchMm = safe(input.finPitchMm);
  const od = safe(input.tubeOuterDiameterMm);
  const id = safe(input.tubeInnerDiameterMm);
  const finThk = safe(input.finThicknessMm);
  const pitchT = safe(input.tubePitchTransverseMm);

  // Tubos
  const totalTubeLengthM = (tubesPerRow * rows * finnedLengthMm) / 1000;
  const odM = od / 1000;
  const idM = id / 1000;
  const tubeSectionM2 = Math.PI * ((odM / 2) ** 2 - (idM / 2) ** 2);
  const tubeVolumeM3 = Math.max(0, tubeSectionM2 * totalTubeLengthM);
  const tubeDensity = MATERIAL_DENSITY_KG_M3[input.tubeMaterial];
  const tubesWeightKg = tubeVolumeM3 * tubeDensity;

  // Aletas
  const numFins = finPitchMm > 0 ? finnedLengthMm / finPitchMm : 0;
  const depthMm = rows * pitchT;
  const finGrossM2 = (finnedHeightMm * depthMm) / 1_000_000;
  const finHolesM2 = tubesPerRow * rows * (Math.PI * (odM / 2) ** 2);
  const finNetM2 = Math.max(0, finGrossM2 - finHolesM2);
  const finsVolumeM3 = numFins * finNetM2 * (finThk / 1000);
  const finDensity = MATERIAL_DENSITY_KG_M3[input.finMaterial];
  const finsWeightKg = finsVolumeM3 * finDensity;

  const tubesCost = tubesWeightKg * input.prices[input.tubeMaterial];
  const finsCost = finsWeightKg * input.prices[input.finMaterial];
  const directCost = tubesCost + finsCost;
  const bdiPercent =
    Number.isFinite(input.bdiPercent) && (input.bdiPercent as number) >= 0
      ? (input.bdiPercent as number)
      : 0;
  const bdiAmount = directCost * (bdiPercent / 100);
  const totalCost = directCost + bdiAmount;

  return {
    tubesWeightKg: Number.isFinite(tubesWeightKg) ? tubesWeightKg : 0,
    finsWeightKg: Number.isFinite(finsWeightKg) ? finsWeightKg : 0,
    tubesCost: Number.isFinite(tubesCost) ? tubesCost : 0,
    finsCost: Number.isFinite(finsCost) ? finsCost : 0,
    directCost: Number.isFinite(directCost) ? directCost : 0,
    bdiPercent,
    bdiAmount: Number.isFinite(bdiAmount) ? bdiAmount : 0,
    totalCost: Number.isFinite(totalCost) ? totalCost : 0,
  };
}

export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return "R$ 0,00";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}
