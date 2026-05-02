// Tipagens dos catálogos CN Coils carregados a partir de
// /public/data/catalogs/*.json (gerados a partir do banco UNILAB original).
//
// Estes tipos refletem EXATAMENTE o shape dos JSONs entregues pelo usuário —
// não inventamos campos, não normalizamos unidades, não geramos defaults.

export interface Refrigerant {
  id: string;
  name: string;
  shortName: string;
  fileName: string;
  cas?: string | null;
  chemicalName?: string | null;
  chemicalFormula?: string | null;
  commercialName?: string | null;
  synonym?: string | null;
  maxTempC?: number | null;
  maxPressKPa?: number | null;
  isMixture: boolean;
  unilab: boolean;
}

export interface SecondaryFluid {
  id: string;
  name: string;
  fileName: string;
  type: "liquid" | "liquid_mixture" | "gas";
  tipologia: number;
  guid?: string | null;
  unilab: boolean;
  requiresPressure: boolean;
  raoult?: {
    pm1: number;
    ka1: number;
    kb1: number;
    kc1: number;
  } | null;
}

export interface Compressor {
  id: number;
  model: string;
  series: string;
  type: string;
  refrigerantCode: string;
  refrigerantId: number;
  shRef: number;
  scRef: number;
  tcondRef: number;
  tevapRef: number;
  capacityCoeffs?: Record<string, number>;
  powerCoeffs?: Record<string, number>;
  currentCoeffs?: Record<string, number>;
}

export interface CompressorStandard {
  id: number;
  name: string;
  tevapC: number;
  tcondC: number;
  superheatK: number;
  subcoolingK: number;
}

export interface Fan {
  id: number;
  model: string;
  series: string;
  type: string;
  builder: string;
  diameterMm?: number;
  powerW?: number;
  voltageV?: number;
  currentA?: number;
  speedRpm?: number;
  airflowM3h?: number;
  maxPressurePa?: number;
}

/**
 * Geometria UNILAB no formato cru (campos italianos preservados).
 * Cada item carrega as dimensões e fatores de correção que devem
 * ser aplicados aos campos da barra inferior ao selecionar uma geometria.
 */
export interface Geometry {
  type: string; // "evaporator_dx" | "condenser_air" | ...
  CodiceBatteria: number;
  ItipoB: number;
  AlCS: number;
  Psq: string;
  Descrizione: string;
  PassoRanghi: number;       // passo entre fileiras (mm)
  PassoTubi: number;         // passo entre tubos (mm)
  DiamEster: number;         // Ø externo do tubo (mm)
  Spessoretubo: number;      // espessura do tubo (mm)
  SpessoreAletta: number;    // espessura da aleta (mm)
  AltezzaAletta: number;     // altura da aleta (mm)
  FatCorAl: number;
  FatRidAumSup: number;
  FatCoeflattub: number;
  FatCorrFatAttr: number;
  RidAreaPassTubo: number;
  Sigla: string;
  FattoreAttrAria: number;
  SlopeFatCorAl?: number;
  SlopeFatCoeflattub?: number;
  SlopeFatCorrFatAttr?: number;
  [extra: string]: unknown;
}

export interface FinThickness {
  SpessoreAlettaID: number;
  SpessoreAletta: number; // mm
}

export interface TubeThickness {
  SpessoreTuboID: number;
  SpessoreTubo: number; // mm
}

export interface FinPitch {
  PassiAletteID: number;
  PassoAletta: number; // mm
  FinsPerInch: number;
}

export interface FinHeight {
  AltezzaAlettaID: number;
  AltezzaAletta: number; // mm (0 = livre)
}

export interface MaterialEntry {
  MaterialID: number;
  Description1: string;          // it
  Description2: string;          // en
  Description9?: string;         // pt
  ThermalConductivity: number;   // W/(m·K)
  Density: number;               // kg/m³
  Price: number;                 // €/kg
  [extra: string]: unknown;
}

export interface CoilShape {
  IdCoilShape: number;
  Name: string;
  filePicture: string;
  [extra: string]: unknown;
}

export interface FinTreatment {
  IdTrattamento: number;
  Descrizione: string;
  IdDescrizione: number;
  /** Fator de redução da condução térmica aplicado às aletas com tratamento. */
  FattoreRiduzioneCondTermica: number;
  /** Fator de redução do atrito do ar aplicado às aletas com tratamento. */
  FattoreRiduzioneFattoreAttritoAria: number;
}

export interface PowerSupply {
  IdAlim: number;
  Alimentazione: string; // ex.: "400 V/3 ph/50 Hz"
  Tensione: number;
  Fasi: number;
  Frequnza: number; // sic — preservado
}

/**
 * Catálogo unificado de Lista de Materiais (BOM) — consolidação das 15
 * tabelas `Tbl_Ma*` originais do UNILAB. Cada array contém os registros
 * crus (campos italianos preservados) usados pelo módulo de Orçamento.
 */
export interface BomCatalog {
  collectors: Array<Record<string, unknown>>;
  tubes: Array<Record<string, unknown>>;
  bends: Array<Record<string, unknown>>;
  distributors: Array<Record<string, unknown>>;
  endCaps: Array<Record<string, unknown>>;
  sheets: Array<Record<string, unknown>>;
  nipples: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  fins: Array<Record<string, unknown>>;
  capillaries: Array<Record<string, unknown>>;
  plugs: Array<Record<string, unknown>>;
  soldering: Array<Record<string, unknown>>;
  groups: Array<Record<string, unknown>>;
  elements: Array<Record<string, unknown>>;
  frame: Array<Record<string, unknown>>;
}

export interface WarningEntry {
  id: number | null;
  translations: Record<string, string>;
}

export interface UiLabelEntry {
  id: number | null;
  translations: Record<string, string>;
}

/** Kappa do distribuidor: { "R404A": { "-40": 0.28, ... } } */
export type DistributorKappaMap = Record<string, Record<string, number>>;

export interface DistributorHoleSize {
  ID: number;
  Fase: number;
  TipoScambiatore: number;
  Abilita: number;
  InVerifica: number;
  [extra: string]: unknown;
}

export interface EngineErrorTranslation {
  message: string | null;
  technical: string | null;
  note: string | null;
}

export interface EngineErrorMessage {
  id: number | null;
  phase: string | null;
  exchangerType: string | null;
  enabled: boolean;
  stopCalculation: boolean;
  askToContinue: boolean;
  /** "1" = info, "2" = aviso, "3" = erro */
  level: string | null;
  condition: string | null;
  translations: Record<string, EngineErrorTranslation>;
}

/** Resolve o texto localizado de uma mensagem do motor pelo seu id. */
export function getEngineWarningText(
  engineErrors: EngineErrorMessage[],
  warningId: number,
  lang = "pt",
): string {
  const entry = engineErrors.find((e) => e.id === warningId);
  if (!entry) return `Aviso #${warningId}`;
  const t = entry.translations[lang] ?? entry.translations.en;
  return t?.message ?? `Aviso #${warningId}`;
}

/**
 * Resolve o Kappa do distribuidor para um fluido e Tevap (°C),
 * usando o ponto de temperatura mais próximo disponível na tabela.
 */
export function getDistributorKappa(
  kappaMap: DistributorKappaMap,
  fluid: string,
  tevapC: number,
): number {
  const fluidMap = kappaMap[fluid];
  if (!fluidMap) return 0.25;
  const temps = Object.keys(fluidMap).map(Number).sort((a, b) => a - b);
  if (temps.length === 0) return 0.25;
  const closest = temps.reduce((prev, curr) =>
    Math.abs(curr - tevapC) < Math.abs(prev - tevapC) ? curr : prev,
  );
  return fluidMap[String(closest)] ?? 0.25;
}

/** Helper: traduz um label/aviso para o idioma desejado, com fallback EN. */
export function translateEntry(
  entry: { translations: Record<string, string> } | undefined,
  lang = "pt",
): string {
  if (!entry) return "";
  return entry.translations[lang] ?? entry.translations.en ?? "";
}

// ───────────── LOTE 8 — Termofísica e auxiliares ─────────────

export interface ThermoPhysicalProperty {
  IDFluido: string | null;
  IDProp: string | null;
  IDStep: string | null;
  MinValue: string | null;
  MaxValue: string | null;
  [extra: string]: unknown;
}

export interface CorrectionPolynomial {
  CodiceBatteria: string | null;
  ItipoB: string | null;
  AlCS: string | null;
  Psq: string | null;
  Descrizione: string | null;
  [extra: string]: unknown;
}

export interface FanElectricalData {
  IDFan: string | null;
  Description: string | null;
  Tension: string | null;
  ICurva: string | null;
  Var01: string | null;
  [extra: string]: unknown;
}

export interface PumpData {
  IDPump: string | null;
  Description: string | null;
  ICurva: string | null;
  Var01: string | null;
  Var02: string | null;
  [extra: string]: unknown;
}

export interface CompressorOutletTemperature {
  FreonID: string | null;
  Descrizione: string | null;
  DescriptionID: string | null;
  CAS: string | null;
  ChemicalName: string | null;
  [extra: string]: unknown;
}
