// Service de catálogo de refrigerantes para o painel Lado Fluido (Etapa 4).
// Lê arquivos reais — sem mocks. Tenta o agregado primeiro, depois o split
// puros + misturas. Falhas viram array vazio (UI permite input manual).

export interface RefrigerantOption {
  id: string;
  name?: string;
  shortName?: string;
  commercialName?: string;
  type?: string; // "pure" | "mixture" | livre, conforme catálogo
}

const SOURCES = [
  { url: "/data/catalogs/refrigerants.json", type: undefined as string | undefined },
  { url: "/data/refrigerants/pure.json", type: "pure" },
  { url: "/data/refrigerants/mixtures.json", type: "mixture" },
  // Fallback para os arquivos já presentes no projeto:
  { url: "/data/catalogs/refrigerantsPure.json", type: "pure" },
  { url: "/data/catalogs/refrigerantsMixtures.json", type: "mixture" },
];

async function fetchJsonSafe(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function normalize(raw: unknown, defaultType?: string): RefrigerantOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): RefrigerantOption | null => {
      if (typeof item === "string") {
        return { id: item, name: item, type: defaultType };
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const id = String(o.id ?? o.name ?? "").trim();
        if (!id) return null;
        const isMixture = o.isMixture === true;
        return {
          id,
          name: typeof o.name === "string" ? o.name : id,
          shortName: typeof o.shortName === "string" ? o.shortName : undefined,
          commercialName:
            typeof o.commercialName === "string" ? o.commercialName : undefined,
          type:
            typeof o.type === "string"
              ? o.type
              : typeof o.kind === "string"
                ? (o.kind as string)
                : isMixture
                  ? "mixture"
                  : defaultType,
        };
      }
      return null;
    })
    .filter((x): x is RefrigerantOption => x !== null);
}

let cache: RefrigerantOption[] | null = null;

export async function loadRefrigerants(): Promise<RefrigerantOption[]> {
  if (cache) return cache;

  // 1) Tenta o agregado primeiro
  const aggregated = await fetchJsonSafe(SOURCES[0].url);
  if (aggregated) {
    const list = normalize(aggregated);
    if (list.length > 0) {
      cache = dedupe(list);
      return cache;
    }
  }

  // 2) Tenta os arquivos separados (pure + mixtures), em ambos os caminhos
  const collected: RefrigerantOption[] = [];
  for (const src of SOURCES.slice(1)) {
    const raw = await fetchJsonSafe(src.url);
    if (raw) collected.push(...normalize(raw, src.type));
  }

  cache = dedupe(collected);
  return cache;
}

function dedupe(list: RefrigerantOption[]): RefrigerantOption[] {
  const seen = new Set<string>();
  const out: RefrigerantOption[] = [];
  for (const r of list) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export async function filterRefrigerants(search: string): Promise<RefrigerantOption[]> {
  const list = await loadRefrigerants();
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      (r.name?.toLowerCase().includes(q) ?? false),
  );
}
