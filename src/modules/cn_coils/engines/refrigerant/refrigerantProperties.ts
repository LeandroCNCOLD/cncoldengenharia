/**
 * Serviço de propriedades termodinâmicas de saturação.
 * Fonte: public/data/refrigerants/saturation_tables.json (CoolProp 7.2 compatible)
 * 37 refrigerantes: naturais, HFCs, HCFCs, HFOs e misturas de baixo GWP.
 */

export interface RefrigerantSatPoint {
  T_C: number;
  P_kPa: number;
  h_f_kJkg: number;
  h_g_kJkg: number;
  h_fg_kJkg: number;
  s_f_kJkgK: number;
  s_g_kJkgK: number;
  liquid: {
    rho_kgm3: number;
    cp_kJkgK: number;
    mu_Pas: number;
    k_WmK: number;
    Pr: number;
  };
  vapor: {
    rho_kgm3: number;
    cp_kJkgK: number;
    mu_Pas: number;
    k_WmK: number;
    Pr: number;
  };
}

export interface RefrigerantSatProps extends RefrigerantSatPoint {
  warnings: string[];
}

export interface RefrigerantMetadata {
  name: string;
  coolprop_id: string;
  category: "natural" | "hfc_pure" | "hcfc" | "hfo" | "hfc_blend" | "hfo_blend";
  T_range_C: [number, number];
  points_count: number;
  P_range_kPa: [number, number];
  note?: string;
  /** Pressão crítica [kPa] — necessária para Shah (1979) e Jung & Didion (1989) */
  P_crit_kPa?: number;
  /** Massa molar [kg/kmol] — necessária para Cooper (1984) */
  M_kg_kmol?: number;
  /** Temperatura crítica [°C] */
  T_crit_C?: number;
}

interface RefrigerantTablesCache {
  tables: Record<string, RefrigerantSatPoint[]>;
  metadata: Record<string, RefrigerantMetadata>;
}

let _cache: RefrigerantTablesCache | null = null;

async function loadTables(): Promise<RefrigerantTablesCache> {
  if (_cache) return _cache;

  let json: Record<string, unknown>;
  if (typeof window !== "undefined") {
    const res = await fetch("/data/refrigerants/saturation_tables.json");
    if (!res.ok) {
      throw new Error(
        `Falha ao carregar saturation_tables.json: HTTP ${res.status}`,
      );
    }
    json = (await res.json()) as Record<string, unknown>;
  } else {
    const [{ readFile }, { resolve }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const raw = await readFile(
      resolve(process.cwd(), "public/data/refrigerants/saturation_tables.json"),
      "utf-8",
    );
    json = JSON.parse(raw) as Record<string, unknown>;
  }

  const metadata =
    (json._metadata as { refrigerants?: Record<string, RefrigerantMetadata> } | undefined)
      ?.refrigerants ?? {};
  const tables: Record<string, RefrigerantSatPoint[]> = {};
  for (const key of Object.keys(json)) {
    if (key !== "_metadata") tables[key] = json[key] as RefrigerantSatPoint[];
  }
  _cache = { tables, metadata };
  return _cache;
}

function interpolate(
  T: number,
  p1: RefrigerantSatPoint,
  p2: RefrigerantSatPoint,
): RefrigerantSatPoint {
  const f = (T - p1.T_C) / (p2.T_C - p1.T_C);
  const lerp = (a: number, b: number) => a + f * (b - a);
  return {
    T_C: T,
    P_kPa: lerp(p1.P_kPa, p2.P_kPa),
    h_f_kJkg: lerp(p1.h_f_kJkg, p2.h_f_kJkg),
    h_g_kJkg: lerp(p1.h_g_kJkg, p2.h_g_kJkg),
    h_fg_kJkg: lerp(p1.h_fg_kJkg, p2.h_fg_kJkg),
    s_f_kJkgK: lerp(p1.s_f_kJkgK, p2.s_f_kJkgK),
    s_g_kJkgK: lerp(p1.s_g_kJkgK, p2.s_g_kJkgK),
    liquid: {
      rho_kgm3: lerp(p1.liquid.rho_kgm3, p2.liquid.rho_kgm3),
      cp_kJkgK: lerp(p1.liquid.cp_kJkgK, p2.liquid.cp_kJkgK),
      mu_Pas: lerp(p1.liquid.mu_Pas, p2.liquid.mu_Pas),
      k_WmK: lerp(p1.liquid.k_WmK, p2.liquid.k_WmK),
      Pr: lerp(p1.liquid.Pr, p2.liquid.Pr),
    },
    vapor: {
      rho_kgm3: lerp(p1.vapor.rho_kgm3, p2.vapor.rho_kgm3),
      cp_kJkgK: lerp(p1.vapor.cp_kJkgK, p2.vapor.cp_kJkgK),
      mu_Pas: lerp(p1.vapor.mu_Pas, p2.vapor.mu_Pas),
      k_WmK: lerp(p1.vapor.k_WmK, p2.vapor.k_WmK),
      Pr: lerp(p1.vapor.Pr, p2.vapor.Pr),
    },
  };
}

function normalizeRefrigerantId(refrigerantId: string): string {
  const aliases: Record<string, string> = {
    NH3: "R717",
    AMMONIA: "R717",
    CO2: "R744",
    PROPANE: "R290",
    ISOBUTANE: "R600a",
    PROPYLENE: "R1270",
    WATER: "R718",
  };
  const raw = refrigerantId.toUpperCase().trim();
  return aliases[raw] ?? refrigerantId.trim();
}

/**
 * Retorna as propriedades de saturação do refrigerante na temperatura T_C.
 * Suporta 37 refrigerantes. Usa interpolação linear entre os pontos da tabela.
 */
export async function getRefrigerantSatProps(
  refrigerantId: string,
  T_C: number,
): Promise<RefrigerantSatProps> {
  const { tables, metadata } = await loadTables();
  const warnings: string[] = [];
  const key = normalizeRefrigerantId(refrigerantId);

  const table = tables[key];
  if (!table || table.length === 0) {
    const fallback = await getRefrigerantSatProps("R404A", T_C);
    return {
      ...fallback,
      warnings: [
        `Refrigerante "${refrigerantId}" não encontrado. Usando R404A como fallback.`,
        ...fallback.warnings,
      ],
    };
  }

  const meta = metadata[key];
  if (meta?.note?.includes("estimado") || meta?.note?.includes("Proxy")) {
    warnings.push(`${key}: ${meta.note}`);
  }

  const Tmin = table[0].T_C;
  const Tmax = table[table.length - 1].T_C;
  if (T_C < Tmin) {
    warnings.push(
      `T=${T_C}°C abaixo do mínimo da tabela (${Tmin}°C) para ${key}. Usando T=${Tmin}°C.`,
    );
    return { ...table[0], warnings };
  }
  if (T_C > Tmax) {
    warnings.push(
      `T=${T_C}°C acima do máximo da tabela (${Tmax}°C) para ${key}. Usando T=${Tmax}°C.`,
    );
    return { ...table[table.length - 1], warnings };
  }

  let i = 0;
  while (i < table.length - 1 && table[i + 1].T_C <= T_C) i++;
  if (i >= table.length - 1) return { ...table[table.length - 1], warnings };

  return { ...interpolate(T_C, table[i], table[i + 1]), warnings };
}

export async function listAvailableRefrigerants(): Promise<
  Array<{ id: string } & RefrigerantMetadata>
> {
  const { metadata } = await loadTables();
  return Object.entries(metadata).map(([id, meta]) => ({ id, ...meta }));
}

/**
 * Retorna os metadados do refrigerante (inclui P_crit_kPa, M_kg_kmol, T_crit_C).
 * Útil para cálculos de Shah (1979) e Jung & Didion (1989).
 */
export async function getRefrigerantMetadata(
  refrigerantId: string,
): Promise<RefrigerantMetadata | null> {
  const { metadata } = await loadTables();
  const key = normalizeRefrigerantId(refrigerantId);
  return metadata[key] ?? null;
}

export function getRefrigerantMaxTubeVelocity(_id: string): number {
  return 2.3;
}

export function getRefrigerantMassVelocityLimits(_id: string): {
  min: number;
  ok: number;
  max: number;
} {
  return { min: 100, ok: 200, max: 400 };
}
