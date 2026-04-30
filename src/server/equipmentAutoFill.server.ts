/**
 * Server-only helpers for equipmentAutoFill.functions.ts
 *
 * IMPORTANT: kept in a separate `.server.ts` module so the
 * `tss-serverfn-split` Vite transform doesn't strand these declarations
 * when splitting per-handler chunks.
 */

export type AutoFillRoleKey =
  | "evaporator"
  | "condenser"
  | "compressor"
  | "fan_evaporator"
  | "fan_condenser";

export type AutoFillItemPreview = {
  role: AutoFillRoleKey;
  label: string;
  description: string;
  conflict: boolean;
  existing: { kind: string; label: string } | null;
  available: boolean;
  unavailableReason?: string;
};

export type AutoFillPreview = {
  matched: boolean;
  catalogModelId: string | null;
  catalogModel: string | null;
  refrigerante: string | null;
  items: AutoFillItemPreview[];
  warnings: string[];
};

export type CnCurveRow = {
  id: string;
  modelo: string;
  refrigerante: string | null;
  raw_json: unknown;
  curva_json: unknown;
};

export type CoilGeometry = {
  rows: number | null;
  tubesPerRow: number | null;
  circuits: number | null;
  finPitchMm: number | null;
  coilLengthMm: number | null;
  tubeOdMm: number | null;
  tubeWallMm: number | null;
  finThicknessMm: number | null;
  airflowM3h: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseGeometryString(str: string | null | undefined): {
  rows: number | null;
  tubesPerRow: number | null;
  circuits: number | null;
  finPitchMm: number | null;
  coilLengthMm: number | null;
} {
  if (!str || typeof str !== "string") {
    return { rows: null, tubesPerRow: null, circuits: null, finPitchMm: null, coilLengthMm: null };
  }
  const s = str.toUpperCase().replace(/,/g, ".");
  let rows: number | null = null;
  let tubesPerRow: number | null = null;
  const dim = s.match(/(\d+)\s*X\s*(\d+)/);
  if (dim) {
    rows = Number(dim[1]);
    tubesPerRow = Number(dim[2]);
  }
  const cir = s.match(/(\d+)\s*CIRCUITO/);
  const circuits = cir ? Number(cir[1]) : null;
  const fin = s.match(/ESPA[CÇ]AMENTO\s*([\d.]+)/);
  const finPitchMm = fin ? Number(fin[1]) : null;
  const len = s.match(/(\d+(?:\.\d+)?)\s*MM\s*$/);
  const coilLengthMm = len ? Number(len[1]) : null;
  return { rows, tubesPerRow, circuits, finPitchMm, coilLengthMm };
}

export function tryGetFromCurvaRaw(raw: Record<string, unknown>, key: string): string | undefined {
  const cr = raw["curva_raw"];
  if (typeof cr !== "string") return undefined;
  try {
    const parsed = JSON.parse(cr) as Record<string, unknown>;
    const v = parsed[key];
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function extractGeometry(
  raw: Record<string, unknown>,
  side: "evaporador" | "condensador",
): CoilGeometry {
  const k = (suffix: string) => raw[`${side}_${suffix}`];
  const modelStr =
    side === "evaporador"
      ? (raw["evaporador_evaporator_model"] as string | undefined) ??
        (raw["MODELO EVAPORADOR"] as string | undefined) ??
        tryGetFromCurvaRaw(raw, "MODELO EVAPORADOR")
      : (raw["condensador_condenser_model"] as string | undefined) ??
        (raw["MODELO CONDENSADOR"] as string | undefined) ??
        tryGetFromCurvaRaw(raw, "MODELO CONDENSADOR");

  const parsed = parseGeometryString(modelStr ?? null);

  const tubesPerRow = toNum(k("tubes_per_row")) ?? parsed.tubesPerRow;
  const rows = toNum(k("rows")) ?? parsed.rows;
  const lenMm =
    toNum(k("tube_length_mm")) ??
    (toNum(k("tube_length_m")) != null ? (toNum(k("tube_length_m")) as number) * 1000 : null) ??
    parsed.coilLengthMm;
  const circuits = toNum(k("circuits")) ?? parsed.circuits;
  const finPitchMm = toNum(k("fin_spacing_mm")) ?? parsed.finPitchMm;
  const tubeOdMm = toNum(k("tube_outer_diameter_mm")) ?? toNum(k("tube_diameter_mm"));
  const tubeWallMm = toNum(k("tube_wall_thickness_mm")) ?? toNum(k("tube_thickness_mm"));
  const finThicknessMm = toNum(k("fin_thickness_mm"));
  const airflowM3h = toNum(k("airflow_m3_h"));

  return {
    rows,
    tubesPerRow,
    circuits,
    finPitchMm,
    coilLengthMm: lenMm,
    tubeOdMm,
    tubeWallMm,
    finThicknessMm,
    airflowM3h,
  };
}

export function extractMidPointOps(curva: unknown): {
  tempEvapC: number | null;
  tempCondC: number | null;
  capacityKcalh: number | null;
  airflowM3h: number | null;
  rhInPct: number | null;
  superheatK: number | null;
  subcoolingK: number | null;
} {
  const arr = Array.isArray(curva) ? curva : [];
  if (arr.length === 0) {
    return {
      tempEvapC: null,
      tempCondC: null,
      capacityKcalh: null,
      airflowM3h: null,
      rhInPct: null,
      superheatK: null,
      subcoolingK: null,
    };
  }
  const mid = (arr[Math.floor(arr.length / 2)] as Record<string, unknown>) ?? {};
  return {
    tempEvapC: toNum(mid["TEMPERATURA DE EVAPORAÇÃO  (°C)"]),
    tempCondC: toNum(mid["TEMPERATURA DE CONDENSAÇÃO  (°C)"]),
    capacityKcalh: toNum(mid["CAPACIDADE FRIGORÍFICA DO COMPRESSOR (Kcal/h)"]),
    airflowM3h: toNum(mid["VAZÃO VENTILADOR EVAPORADOR (m³/h)"]),
    rhInPct: toNum(mid["UMIDADE INTERNA (%)"]),
    superheatK: toNum(mid["SUPERAQUECIMENTO TOTAL (K)"]),
    subcoolingK: toNum(mid["SUBRESFRIAMENTO (K)"]),
  };
}

export async function findCurveForEquipment(
  supabase: SupabaseLike,
  code: string | null,
  commercialName: string | null,
): Promise<CnCurveRow | null> {
  const candidates = [code, commercialName].filter((x): x is string => !!x && x.length > 0);
  for (const cand of candidates) {
    const { data: row } = await supabase
      .from("cn_catalog_performance_curves")
      .select("*")
      .ilike("modelo", cand)
      .order("curva_indice", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (row) return row as CnCurveRow;
  }
  for (const cand of candidates) {
    const { data: row } = await supabase
      .from("cn_catalog_performance_curves")
      .select("*")
      .ilike("modelo", `%${cand}%`)
      .order("curva_indice", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (row) return row as CnCurveRow;
  }
  return null;
}
