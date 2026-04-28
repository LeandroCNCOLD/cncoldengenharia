// Parsers para evaporadores e condensadores a partir de texto extraído (PDF/XLS).
// A entrada é texto bruto; a saída é um HeatExchangerCatalogItem normalizado.

import type { HeatExchangerCatalogItem, HeatExchangerType } from "./types";
import {
  detectCapacityUnit,
  detectTemperatureUnit,
  normalizeCapacity,
  normalizeFlow,
  normalizeTemperature,
  type FlowUnit,
} from "./unitNormalizer";

type FieldMap = Record<string, RegExp[]>;

const COMMON_FIELDS: FieldMap = {
  capacity: [/capacidade[^:\n]*[:=]\s*([\d.,]+)\s*(W|kW|BTU\/h|kcal\/h|TR)?/i, /capacity[^:\n]*[:=]\s*([\d.,]+)\s*(W|kW|BTU\/h)?/i],
  airInletTemp: [/temperatura\s+(do\s+)?ar[^:\n]*[:=]\s*([\-\d.,]+)\s*°?\s*([CFK])?/i, /air\s+inlet[^:\n]*[:=]\s*([\-\d.,]+)\s*°?\s*([CFK])?/i],
  airFlow: [/vaz[ãa]o\s+(de\s+)?ar[^:\n]*[:=]\s*([\d.,]+)\s*(m3\/h|m³\/h|CFM|L\/s)?/i, /air\s+flow[^:\n]*[:=]\s*([\d.,]+)\s*(m3\/h|m³\/h|CFM)?/i],
  area: [/[áa]rea[^:\n]*[:=]\s*([\d.,]+)\s*m²?2?/i, /area[^:\n]*[:=]\s*([\d.,]+)\s*m2/i],
  volume: [/volume\s+interno[^:\n]*[:=]\s*([\d.,]+)\s*L?/i, /internal\s+volume[^:\n]*[:=]\s*([\d.,]+)/i],
  rows: [/fileiras[^:\n]*[:=]\s*(\d+)/i, /rows[^:\n]*[:=]\s*(\d+)/i],
  tubesPerRow: [/tubos\s+por\s+fileira[^:\n]*[:=]\s*(\d+)/i, /tubes\s+per\s+row[^:\n]*[:=]\s*(\d+)/i],
  circuits: [/circuitos[^:\n]*[:=]\s*(\d+)/i, /circuits[^:\n]*[:=]\s*(\d+)/i],
  refrigerant: [/(?:fluido|refrigerante|refrigerant)[^:\n]*[:=]\s*([A-Z0-9\-]+)/i],
  model: [/modelo[^:\n]*[:=]\s*([A-Za-z0-9\- ]+)/i, /model[^:\n]*[:=]\s*([A-Za-z0-9\- ]+)/i],
  finSpacing: [/(?:aleta|fin)[^:\n]*[:=]\s*([\d.,]+)\s*mm/i],
  tubeOd: [/di[âa]metro\s+externo[^:\n]*[:=]\s*([\d.,]+)\s*mm/i, /tube\s+od[^:\n]*[:=]\s*([\d.,]+)\s*mm/i],
  tubeId: [/di[âa]metro\s+interno[^:\n]*[:=]\s*([\d.,]+)\s*mm/i, /tube\s+id[^:\n]*[:=]\s*([\d.,]+)\s*mm/i],
};

const EVAP_TEMP: RegExp[] = [
  /temperatura\s+(de\s+)?evapora[çc][ãa]o[^:\n]*[:=]\s*([\-\d.,]+)\s*°?\s*([CFK])?/i,
  /evaporating\s+temp[^:\n]*[:=]\s*([\-\d.,]+)\s*°?\s*([CFK])?/i,
  /\bTEvap?\b[^:\n]*[:=]\s*([\-\d.,]+)/i,
];
const COND_TEMP: RegExp[] = [
  /temperatura\s+(de\s+)?condensa[çc][ãa]o[^:\n]*[:=]\s*([\-\d.,]+)\s*°?\s*([CFK])?/i,
  /condensing\s+temp[^:\n]*[:=]\s*([\-\d.,]+)\s*°?\s*([CFK])?/i,
  /\bTCond?\b[^:\n]*[:=]\s*([\-\d.,]+)/i,
];

function num(s: string | undefined): number | undefined {
  if (s == null) return undefined;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function findFirst(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m;
  }
  return null;
}

/** Extrai grupo de captura "valor numérico + unidade opcional" — tolera padrão N°2/3. */
function extractValueUnit(m: RegExpMatchArray): { value?: number; unit?: string } {
  // Procura primeiro grupo numérico capturado.
  for (let i = 1; i < m.length; i++) {
    const v = num(m[i]);
    if (v !== undefined) {
      const unit = m[i + 1];
      return { value: v, unit };
    }
  }
  return {};
}

function parseHeatExchanger(
  type: HeatExchangerType,
  text: string,
  sourceFile: string,
): HeatExchangerCatalogItem {
  const get = (key: keyof typeof COMMON_FIELDS) => {
    const m = findFirst(text, COMMON_FIELDS[key]);
    return m ? extractValueUnit(m) : {};
  };

  const cap = get("capacity");
  const capacityW = cap.value
    ? normalizeCapacity(cap.value, (cap.unit as never) ?? detectCapacityUnit(text))
    : 0;

  const airIn = get("airInletTemp");
  const airInletC = airIn.value !== undefined
    ? normalizeTemperature(airIn.value, (airIn.unit as never) ?? detectTemperatureUnit(text))
    : 0;

  const exchangeM = findFirst(text, type === "evaporator" ? EVAP_TEMP : COND_TEMP);
  const exch = exchangeM ? extractValueUnit(exchangeM) : {};
  const exchangeC = exch.value !== undefined
    ? normalizeTemperature(exch.value, (exch.unit as never) ?? "C")
    : 0;

  const flow = get("airFlow");
  const airFlowM3h = flow.value
    ? normalizeFlow(flow.value, normalizeFlowUnit(flow.unit))
    : 0;

  const area = get("area");
  const volume = get("volume");

  const item: HeatExchangerCatalogItem = {
    id: `${type}-${(get("model").value ? String(get("model").value) : sourceFile).toString().replace(/\s+/g, "_")}`,
    type,
    model: extractText(text, COMMON_FIELDS.model) ?? "Unknown",
    refrigerant: extractText(text, COMMON_FIELDS.refrigerant) ?? "Unknown",
    nominalCapacityW: capacityW,
    nominalAirInletTempC: airInletC,
    nominalExchangeTempC: exchangeC,
    nominalDeltaT: Math.abs(airInletC - exchangeC),
    airFlowM3h,
    faceVelocityMs: 0, // calculável posteriormente se área frontal for conhecida
    exchangeAreaM2: area.value ?? 0,
    internalVolumeL: volume.value ?? 0,
    rows: Math.round(get("rows").value ?? 0),
    tubesPerRow: Math.round(get("tubesPerRow").value ?? 0),
    circuits: Math.round(get("circuits").value ?? 0),
    finSpacingMm: get("finSpacing").value ?? 0,
    tubeOuterDiameterMm: get("tubeOd").value ?? 0,
    tubeInnerDiameterMm: get("tubeId").value ?? 0,
    sourceFile,
  };

  return item;
}

function extractText(text: string, patterns: RegExp[]): string | undefined {
  const m = findFirst(text, patterns);
  if (!m) return undefined;
  for (let i = 1; i < m.length; i++) {
    if (m[i] && Number.isNaN(Number(m[i]))) return m[i].trim();
  }
  return undefined;
}

function normalizeFlowUnit(unit?: string): FlowUnit {
  if (!unit) return "m3/h";
  const u = unit.toLowerCase();
  if (u.includes("cfm")) return "CFM";
  if (u.includes("l/s")) return "L/s";
  if (u.includes("m3/s") || u.includes("m³/s")) return "m3/s";
  return "m3/h";
}

export function parseEvaporator(text: string, sourceFile: string): HeatExchangerCatalogItem {
  return parseHeatExchanger("evaporator", text, sourceFile);
}

export function parseCondenser(text: string, sourceFile: string): HeatExchangerCatalogItem {
  return parseHeatExchanger("condenser", text, sourceFile);
}
