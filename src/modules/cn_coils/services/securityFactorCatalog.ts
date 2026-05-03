// Lê o SecurityFactor por geometria do catálogo legado `geometries.json`.
// A chave de junção com `coilGeometries.json` é o `codigo` (== Sigla/Descrizione).

const URL = "/data/catalogs/geometries.json";

let cache: Map<string, number> | null = null;
let inflight: Promise<Map<string, number>> | null = null;

export async function loadSecurityFactorMap(): Promise<Map<string, number>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = (await res.json()) as Array<Record<string, unknown>>;
      const map = new Map<string, number>();
      for (const item of arr) {
        const sf = Number(item["SecurityFactor"]);
        if (!Number.isFinite(sf)) continue;
        for (const key of ["Sigla", "Descrizione", "code", "codigo"]) {
          const v = item[key];
          if (typeof v === "string" && v.length > 0) map.set(v, sf);
        }
      }
      cache = map;
      return map;
    } catch {
      cache = new Map();
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function getSecurityFactor(codigo?: string | null): number | undefined {
  if (!codigo || !cache) return undefined;
  return cache.get(codigo);
}
