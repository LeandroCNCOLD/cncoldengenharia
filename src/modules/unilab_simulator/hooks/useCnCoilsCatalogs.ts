// Hook centralizado que carrega TODOS os catálogos CN Coils a partir de
// /public/data/catalogs/*.json. Sem mocks, sem fallback silencioso —
// erros são reportados via `errors` para a UI exibir.
//
// Uso:
//   const cat = useCnCoilsCatalogs();
//   const geometriasFiltradas = cat.geometriesByType("evaporator_dx");

import { useEffect, useMemo, useState } from "react";
import type {
  BomCatalog,
  CoilShape,
  Compressor,
  CompressorStandard,
  DistributorHoleSize,
  DistributorKappaMap,
  Fan,
  FinHeight,
  FinPitch,
  FinThickness,
  FinTreatment,
  Geometry,
  MaterialEntry,
  PowerSupply,
  Refrigerant,
  SecondaryFluid,
  TubeThickness,
  UiLabelEntry,
  WarningEntry,
} from "../types/catalogs";

const CATALOG_BASE = "/data/catalogs";

const FILES = {
  refrigerantsPure: "refrigerantsPure.json",
  refrigerantsMixtures: "refrigerantsMixtures.json",
  secondaryFluids: "secondaryFluids.json",
  compressors: "compressors.json",
  compressorStandards: "compressorStandards.json",
  fans: "fans.json",
  geometries: "geometries.json",
  finThicknesses: "finThicknesses.json",
  tubeThicknesses: "tubeThicknesses.json",
  finPitches: "finPitches.json",
  finHeights: "finHeights.json",
  materials: "materials.json",
  frameMaterials: "frameMaterials.json",
  coilShapes: "coilShapes.json",
  finTreatments: "finTreatments.json",
  powerSupplies: "powerSupplies.json",
} as const;

export interface CnCoilsCatalogsData {
  refrigerantsPure: Refrigerant[];
  refrigerantsMixtures: Refrigerant[];
  /** Lista combinada (puros + misturas) ordenada alfabeticamente por shortName. */
  refrigerants: Refrigerant[];
  secondaryFluids: SecondaryFluid[];
  compressors: Compressor[];
  compressorStandards: CompressorStandard[];
  fans: Fan[];
  geometries: Geometry[];
  finThicknesses: FinThickness[];
  tubeThicknesses: TubeThickness[];
  finPitches: FinPitch[];
  finHeights: FinHeight[];
  materials: MaterialEntry[];
  frameMaterials: MaterialEntry[];
  coilShapes: CoilShape[];
  finTreatments: FinTreatment[];
  powerSupplies: PowerSupply[];
  /** Lista de Materiais (BOM) — 15 grupos consolidados do UNILAB. */
  bom: BomCatalog;
  warnings: WarningEntry[];
  uiLabels: UiLabelEntry[];
  distributorKappa: DistributorKappaMap;
  distributorHoleSizes: DistributorHoleSize[];
}

export interface CnCoilsCatalogsState extends CnCoilsCatalogsData {
  loading: boolean;
  ready: boolean;
  errors: Record<string, string>;
  /** Filtra geometrias pelo `type` (ex.: "evaporator_dx"). Memoizado por chamada. */
  geometriesByType: (type: string | undefined) => Geometry[];
}

const EMPTY: CnCoilsCatalogsData = {
  refrigerantsPure: [],
  refrigerantsMixtures: [],
  refrigerants: [],
  secondaryFluids: [],
  compressors: [],
  compressorStandards: [],
  fans: [],
  geometries: [],
  finThicknesses: [],
  tubeThicknesses: [],
  finPitches: [],
  finHeights: [],
  materials: [],
  frameMaterials: [],
  coilShapes: [],
  finTreatments: [],
  powerSupplies: [],
  bom: {
    collectors: [], tubes: [], bends: [], distributors: [], endCaps: [],
    sheets: [], nipples: [], nodes: [], fins: [], capillaries: [],
    plugs: [], soldering: [], groups: [], elements: [], frame: [],
  },
  warnings: [],
  uiLabels: [],
  distributorKappa: {},
  distributorHoleSizes: [],
};

async function fetchJsonArray<T>(file: string): Promise<T[]> {
  const res = await fetch(`${CATALOG_BASE}/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${file}`);
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw)) throw new Error(`Conteúdo inválido em ${file}`);
  return raw as T[];
}

// Cache em módulo — evita refetch entre páginas/componentes na mesma sessão.
let cached: CnCoilsCatalogsData | null = null;
let cachedErrors: Record<string, string> = {};

export function useCnCoilsCatalogs(): CnCoilsCatalogsState {
  const [data, setData] = useState<CnCoilsCatalogsData>(cached ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>(cachedErrors);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    (async () => {
      const next: CnCoilsCatalogsData = { ...EMPTY };
      const errs: Record<string, string> = {};

      const tasks: Array<[keyof typeof FILES, string]> = (
        Object.entries(FILES) as Array<[keyof typeof FILES, string]>
      );

      await Promise.all([
        ...tasks.map(async ([key, file]) => {
          try {
            const arr = await fetchJsonArray<unknown>(file);
            (next as unknown as Record<string, unknown>)[key] = arr;
          } catch (err) {
            errs[file] = err instanceof Error ? err.message : String(err);
          }
        }),
        (async () => {
          try {
            const res = await fetch(`${CATALOG_BASE}/bomComponents.json`, {
              cache: "no-cache",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = (await res.json()) as Partial<BomCatalog>;
            next.bom = { ...next.bom, ...raw };
          } catch (err) {
            errs["bomComponents.json"] =
              err instanceof Error ? err.message : String(err);
          }
        })(),
      ]);

      // Lista combinada ordenada
      next.refrigerants = [...next.refrigerantsPure, ...next.refrigerantsMixtures]
        .slice()
        .sort((a, b) =>
          (a.shortName ?? a.name ?? a.id).localeCompare(
            b.shortName ?? b.name ?? b.id,
          ),
        );

      if (cancelled) return;
      cached = next;
      cachedErrors = errs;
      setData(next);
      setErrors(errs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const geometriesByType = useMemo(() => {
    return (type: string | undefined) => {
      if (!type) return data.geometries;
      return data.geometries.filter((g) => g.type === type);
    };
  }, [data.geometries]);

  return {
    ...data,
    loading,
    ready: !loading && Object.keys(errors).length === 0,
    errors,
    geometriesByType,
  };
}
