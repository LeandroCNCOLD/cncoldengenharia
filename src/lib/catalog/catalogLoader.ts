// Orquestrador: recebe arquivos brutos, chama parsers, normaliza, valida e devolve catálogo.

import {
  buildCompressorItem,
  parseCompressorCsv,
} from "./compressorParser";
import {
  parseCondenser,
  parseEvaporator,
} from "./heatExchangerParser";
import { initialCatalog } from "./initialCatalog";
import {
  CatalogValidationError,
  type Catalog,
  type CompressorCatalogItem,
  type HeatExchangerCatalogItem,
} from "./types";
import { validateCompressor, validateHeatExchanger } from "./validationRules";

export type RawFileInput =
  | { kind: "evaporator"; text: string; sourceFile: string }
  | { kind: "condenser"; text: string; sourceFile: string }
  | { kind: "compressor"; csv: string; sourceFile: string };

export type LoadCatalogOptions = {
  /** Inclui o catálogo manual inicial CN Cold (default: true). */
  includeInitial?: boolean;
  /** Lança no primeiro erro (default: true). Se false, pula itens inválidos. */
  failFast?: boolean;
};

export type LoadCatalogResult = {
  catalog: Catalog;
  errors: { sourceFile: string; error: string }[];
};

export function loadCatalog(
  files: RawFileInput[],
  options: LoadCatalogOptions = {},
): LoadCatalogResult {
  const { includeInitial = true, failFast = true } = options;

  const evaporators: HeatExchangerCatalogItem[] = [];
  const condensers: HeatExchangerCatalogItem[] = [];
  const compressors: CompressorCatalogItem[] = [];
  const errors: { sourceFile: string; error: string }[] = [];

  if (includeInitial) {
    evaporators.push(...initialCatalog.evaporators);
    condensers.push(...initialCatalog.condensers);
    compressors.push(...initialCatalog.compressors);
  }

  for (const f of files) {
    try {
      if (f.kind === "evaporator") {
        const item = parseEvaporator(f.text, f.sourceFile);
        validateHeatExchanger(item);
        evaporators.push(item);
      } else if (f.kind === "condenser") {
        const item = parseCondenser(f.text, f.sourceFile);
        validateHeatExchanger(item);
        condensers.push(item);
      } else {
        const parsed = parseCompressorCsv(f.csv, f.sourceFile);
        const item = buildCompressorItem(parsed, f.sourceFile, "capacity");
        validateCompressor(item);
        compressors.push(item);
      }
    } catch (e) {
      const msg = e instanceof CatalogValidationError ? e.message : String(e);
      errors.push({ sourceFile: f.sourceFile, error: msg });
      if (failFast) throw e;
    }
  }

  return {
    catalog: { evaporators, condensers, compressors },
    errors,
  };
}
