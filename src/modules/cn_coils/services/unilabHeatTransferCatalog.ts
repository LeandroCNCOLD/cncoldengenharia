/**
 * @deprecated Motor V2 agora calcula h_ar via Wang-Chi-Chang dinamicamente.
 * Este loader não é mais necessário. Mantido para compatibilidade.
 */

interface UnilabHeatTransferCoeffEntry {
  geometryId: string;
  h_air_polynomial: number[];
  vMin?: number;
  vMax?: number;
  finEfficiency?: number;
  areaCorrection?: number;
}

interface UnilabHeatTransferCatalog {
  entries: UnilabHeatTransferCoeffEntry[];
}

const CATALOG_URL = "/data/catalogs/unilabHeatTransferCoefficients.json";

let cache: UnilabHeatTransferCatalog | null = null;
let inflight: Promise<UnilabHeatTransferCatalog> | null = null;

function isEntry(x: unknown): x is UnilabHeatTransferCoeffEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.geometryId === "string" &&
    Array.isArray(o.h_air_polynomial) &&
    o.h_air_polynomial.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export async function loadUnilabHeatTransferCatalog(): Promise<UnilabHeatTransferCatalog> {
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
      const entries: UnilabHeatTransferCoeffEntry[] = Array.isArray(raw)
        ? raw.filter(isEntry)
        : [];
      const catalog: UnilabHeatTransferCatalog = { entries };
      cache = catalog;
      return catalog;
    })
    .catch(() => {
      const empty: UnilabHeatTransferCatalog = { entries: [] };
      cache = empty;
      return empty;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Conveniência síncrona para componentes que já carregaram o catálogo. */
export function getCachedHeatTransferCatalog(): UnilabHeatTransferCatalog | null {
  return cache;
}
