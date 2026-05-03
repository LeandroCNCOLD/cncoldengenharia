/**
 * @deprecated Motor V2 agora calcula h_ar via Wang-Chi-Chang dinamicamente.
 * Este loader não é mais necessário. Mantido para compatibilidade.
 */

interface CnCoilsHeatTransferCoeffEntry {
  geometryId: string;
  h_air_polynomial: number[];
  vMin?: number;
  vMax?: number;
  finEfficiency?: number;
  areaCorrection?: number;
}

interface CnCoilsHeatTransferCatalog {
  entries: CnCoilsHeatTransferCoeffEntry[];
}

const CATALOG_URL = "/data/catalogs/cncoilsHeatTransferCoefficients.json";

let cache: CnCoilsHeatTransferCatalog | null = null;
let inflight: Promise<CnCoilsHeatTransferCatalog> | null = null;

function isEntry(x: unknown): x is CnCoilsHeatTransferCoeffEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.geometryId === "string" &&
    Array.isArray(o.h_air_polynomial) &&
    o.h_air_polynomial.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export async function loadCnCoilsHeatTransferCatalog(): Promise<CnCoilsHeatTransferCatalog> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = fetch(CATALOG_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: unknown) => {
      const raw =
        data && typeof data === "object" && "entries" in (data as object)
          ? (data as { entries: unknown }).entries
          : [];
      const entries: CnCoilsHeatTransferCoeffEntry[] = Array.isArray(raw)
        ? raw.filter(isEntry)
        : [];
      const catalog: CnCoilsHeatTransferCatalog = { entries };
      cache = catalog;
      return catalog;
    })
    .catch(() => {
      const empty: CnCoilsHeatTransferCatalog = { entries: [] };
      cache = empty;
      return empty;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Conveniência síncrona para componentes que já carregaram o catálogo. */
export function getCachedHeatTransferCatalog(): CnCoilsHeatTransferCatalog | null {
  return cache;
}
