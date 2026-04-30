/**
 * Helpers server-only para o Catálogo 480 consolidado
 * (cn_equipment_master + masters de evap/cond/comp/perf).
 *
 * IMPORTANT: kept in a separate `.server.ts` module so the
 * `tss-serverfn-split` Vite transform doesn't strand these declarations
 * when splitting per-handler chunks.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export type Cn480ListItem = {
  id: string;
  modelo: string;
  linha: string | null;
  hp: string | null;
  refrigerante: string | null;
  gabinete: string | null;
  has_evaporator: boolean;
  has_condenser: boolean;
  has_compressor: boolean;
  perf_points: number;
  compressor_label: string | null;
  status: "ready" | "partial" | "empty";
  nominal_capacity_w: number | null;
  nominal_tevap_c: number | null;
  nominal_tcond_c: number | null;
};

export type Cn480Master = {
  id: string;
  modelo: string;
  linha: string | null;
  hp: string | null;
  gabinete: string | null;
  tipo_gabinete: string | null;
  refrigerante: string | null;
  tipo_degelo: string | null;
  origem_dados: string;
  confianca: number;
  raw_sources_json: Record<string, any> | any[] | null;
};

export type Cn480EvaporatorMaster = {
  id: string;
  geometry: string | null;
  tube_diameter: number | null;
  tube_thickness: number | null;
  tubes_per_row: number | null;
  rows: number | null;
  circuits: number | null;
  fin_spacing: number | null;
  airflow: number | null;
  internal_volume: number | null;
  exchange_area: number | null;
  raw_json: Record<string, any> | any[] | null;
};

export type Cn480CondenserMaster = Omit<Cn480EvaporatorMaster, "exchange_area">;

export type Cn480CompressorMaster = {
  id: string;
  copeland: string | null;
  bitzer: string | null;
  danfoss: string | null;
  dorin: string | null;
  secondary: string | null;
  raw_json: Record<string, any> | any[] | null;
};

export type Cn480PerformancePoint = {
  id: string;
  point_index: number;
  tevap: number | null;
  tcond: number | null;
  capacity_evap: number | null;
  capacity_cond: number | null;
  power: number | null;
  cop: number | null;
  airflow: number | null;
  source: string;
  raw_json: Record<string, any> | any[] | null;
};

export type Cn480Detail = {
  master: Cn480Master;
  evaporator: Cn480EvaporatorMaster | null;
  condenser: Cn480CondenserMaster | null;
  compressor: Cn480CompressorMaster | null;
  performance: Cn480PerformancePoint[];
};

const COMP_BRANDS: Array<{
  brand: "copeland" | "bitzer" | "danfoss" | "dorin" | "secondary";
  label: string;
}> = [
  { brand: "copeland", label: "Copeland" },
  { brand: "bitzer", label: "Bitzer" },
  { brand: "danfoss", label: "Danfoss" },
  { brand: "dorin", label: "Dorin" },
  { brand: "secondary", label: "Secundário" },
];

export function pickCompressorLabel(
  comp:
    | Pick<Cn480CompressorMaster, "copeland" | "bitzer" | "danfoss" | "dorin" | "secondary">
    | null
    | undefined,
): { label: string; manufacturer: string; model: string } | null {
  if (!comp) return null;
  for (const { brand, label } of COMP_BRANDS) {
    const v = comp[brand];
    if (v && v.trim().length > 0) {
      return { label: `${label} ${v.trim()}`, manufacturer: label, model: v.trim() };
    }
  }
  return null;
}

export function pickNominalPerformancePoint(
  perf: Cn480PerformancePoint[],
): Cn480PerformancePoint | null {
  if (!perf || perf.length === 0) return null;
  const sorted = [...perf].sort((a, b) => {
    if (a.point_index !== b.point_index) return a.point_index - b.point_index;
    const ca = a.cop ?? -Infinity;
    const cb = b.cop ?? -Infinity;
    return cb - ca;
  });
  return sorted[0] ?? null;
}

export async function loadCn480List(supabase: SupabaseLike): Promise<Cn480ListItem[]> {
  const [{ data: masters, error: me }, { data: evaps }, { data: conds }, { data: comps }, { data: perfs }] =
    await Promise.all([
      supabase
        .from("cn_equipment_master")
        .select("id,modelo,linha,hp,refrigerante,gabinete")
        .order("modelo", { ascending: true }),
      supabase.from("cn_equipment_evaporator_master").select("model_id"),
      supabase.from("cn_equipment_condenser_master").select("model_id"),
      supabase
        .from("cn_equipment_compressor_master")
        .select("model_id,copeland,bitzer,danfoss,dorin,secondary"),
      supabase
        .from("cn_equipment_performance_master")
        .select("model_id,point_index,tevap,tcond,capacity_evap,cop")
        .order("point_index", { ascending: true }),
    ]);
  if (me) throw new Error(me.message ?? "Erro ao carregar catálogo 480.");

  const evapSet = new Set<string>((evaps ?? []).map((r: { model_id: string }) => r.model_id));
  const condSet = new Set<string>((conds ?? []).map((r: { model_id: string }) => r.model_id));
  const compMap = new Map<string, Cn480CompressorMaster>();
  for (const r of comps ?? []) {
    compMap.set((r as { model_id: string }).model_id, r as unknown as Cn480CompressorMaster);
  }
  const perfByModel = new Map<string, Cn480PerformancePoint[]>();
  for (const r of perfs ?? []) {
    const k = (r as { model_id: string }).model_id;
    const arr = perfByModel.get(k) ?? [];
    arr.push(r as unknown as Cn480PerformancePoint);
    perfByModel.set(k, arr);
  }

  return (masters ?? []).map((m: Record<string, unknown>) => {
    const id = m.id as string;
    const comp = compMap.get(id) ?? null;
    const compLabel = pickCompressorLabel(comp);
    const has_evaporator = evapSet.has(id);
    const has_condenser = condSet.has(id);
    const has_compressor = !!compLabel;
    const perfPoints = perfByModel.get(id) ?? [];
    const perf_points = perfPoints.length;
    const nom = pickNominalPerformancePoint(perfPoints);
    const completeCount = [has_evaporator, has_condenser, has_compressor, perf_points > 0].filter(
      Boolean,
    ).length;
    const status: Cn480ListItem["status"] =
      completeCount === 4 ? "ready" : completeCount === 0 ? "empty" : "partial";
    return {
      id,
      modelo: m.modelo as string,
      linha: (m.linha as string | null) ?? null,
      hp: (m.hp as string | null) ?? null,
      refrigerante: (m.refrigerante as string | null) ?? null,
      gabinete: (m.gabinete as string | null) ?? null,
      has_evaporator,
      has_condenser,
      has_compressor,
      perf_points,
      compressor_label: compLabel?.label ?? null,
      status,
      nominal_capacity_w: nom?.capacity_evap != null ? Number(nom.capacity_evap) : null,
      nominal_tevap_c: nom?.tevap != null ? Number(nom.tevap) : null,
      nominal_tcond_c: nom?.tcond != null ? Number(nom.tcond) : null,
    };
  });
}

export async function loadCn480Detail(
  supabase: SupabaseLike,
  modelId: string,
): Promise<Cn480Detail> {
  const { data: master, error: me } = await supabase
    .from("cn_equipment_master")
    .select("*")
    .eq("id", modelId)
    .maybeSingle();
  if (me) throw new Error(me.message);
  if (!master) throw new Error("Modelo do catálogo não encontrado.");

  const [{ data: evap }, { data: cond }, { data: comp }, { data: perf }] = await Promise.all([
    supabase.from("cn_equipment_evaporator_master").select("*").eq("model_id", modelId).maybeSingle(),
    supabase.from("cn_equipment_condenser_master").select("*").eq("model_id", modelId).maybeSingle(),
    supabase.from("cn_equipment_compressor_master").select("*").eq("model_id", modelId).maybeSingle(),
    supabase
      .from("cn_equipment_performance_master")
      .select("*")
      .eq("model_id", modelId)
      .order("point_index", { ascending: true }),
  ]);

  return {
    master: master as Cn480Master,
    evaporator: (evap as Cn480EvaporatorMaster | null) ?? null,
    condenser: (cond as Cn480CondenserMaster | null) ?? null,
    compressor: (comp as Cn480CompressorMaster | null) ?? null,
    performance: (perf as Cn480PerformancePoint[] | null) ?? [],
  };
}

export type EvaporatorCoilFields = {
  refrigerant: string | null;
  rows: number | null;
  tubes_per_row: number | null;
  circuits: number | null;
  fin_pitch_mm: number | null;
  tube_od_mm: number | null;
  fin_thickness_mm: number | null;
  internal_volume_l: number | null;
  surface_area_m2: number | null;
  nominal_airflow_m3h: number | null;
  nominal_evap_temp_c: number | null;
  nominal_capacity_w: number | null;
};

export function mapEvaporatorToCoilModel(
  detail: Cn480Detail,
): EvaporatorCoilFields | null {
  const e = detail.evaporator;
  if (!e) return null;
  const nom = pickNominalPerformancePoint(detail.performance);
  return {
    refrigerant: detail.master.refrigerante ?? null,
    rows: e.rows != null ? Math.round(Number(e.rows)) : null,
    tubes_per_row: e.tubes_per_row != null ? Math.round(Number(e.tubes_per_row)) : null,
    circuits: e.circuits != null ? Math.round(Number(e.circuits)) : null,
    fin_pitch_mm: e.fin_spacing != null ? Number(e.fin_spacing) : null,
    tube_od_mm: e.tube_diameter != null ? Number(e.tube_diameter) : null,
    fin_thickness_mm: e.tube_thickness != null ? Number(e.tube_thickness) : null,
    internal_volume_l: e.internal_volume != null ? Number(e.internal_volume) : null,
    surface_area_m2: e.exchange_area != null ? Number(e.exchange_area) : null,
    nominal_airflow_m3h: e.airflow != null ? Number(e.airflow) : (nom?.airflow ?? null),
    nominal_evap_temp_c: nom?.tevap ?? null,
    nominal_capacity_w: nom?.capacity_evap != null ? Number(nom.capacity_evap) : null,
  };
}

export type CondenserCoilFields = {
  refrigerant: string | null;
  rows: number | null;
  tubes_per_row: number | null;
  circuits: number | null;
  fin_pitch_mm: number | null;
  tube_od_mm: number | null;
  fin_thickness_mm: number | null;
  internal_volume_l: number | null;
  nominal_airflow_m3h: number | null;
  nominal_cond_temp_c: number | null;
  nominal_capacity_w: number | null;
};

export function mapCondenserToCoilModel(
  detail: Cn480Detail,
): CondenserCoilFields | null {
  const c = detail.condenser;
  if (!c) return null;
  const nom = pickNominalPerformancePoint(detail.performance);
  return {
    refrigerant: detail.master.refrigerante ?? null,
    rows: c.rows != null ? Math.round(Number(c.rows)) : null,
    tubes_per_row: c.tubes_per_row != null ? Math.round(Number(c.tubes_per_row)) : null,
    circuits: c.circuits != null ? Math.round(Number(c.circuits)) : null,
    fin_pitch_mm: c.fin_spacing != null ? Number(c.fin_spacing) : null,
    tube_od_mm: c.tube_diameter != null ? Number(c.tube_diameter) : null,
    fin_thickness_mm: c.tube_thickness != null ? Number(c.tube_thickness) : null,
    internal_volume_l: c.internal_volume != null ? Number(c.internal_volume) : null,
    nominal_airflow_m3h: c.airflow != null ? Number(c.airflow) : (nom?.airflow ?? null),
    nominal_cond_temp_c: nom?.tcond ?? null,
    nominal_capacity_w: nom?.capacity_cond != null ? Number(nom.capacity_cond) : null,
  };
}

export function inferEquipmentKindAndApplication(linha: string | null): {
  equipment_kind: "unidade_condensadora" | "outro";
  application: "congelamento" | "resfriamento" | "outro";
} {
  const l = (linha ?? "").toUpperCase();
  if (l.includes("LT") || l.includes("CONGEL")) {
    return { equipment_kind: "unidade_condensadora", application: "congelamento" };
  }
  if (l.includes("MT") || l.includes("RESFR") || l.includes("MEDIA")) {
    return { equipment_kind: "unidade_condensadora", application: "resfriamento" };
  }
  return { equipment_kind: "outro", application: "outro" };
}

export async function findMasterByModel(
  supabase: SupabaseLike,
  code: string | null,
  commercial_name: string | null,
): Promise<{ id: string; modelo: string } | null> {
  const candidates = [code, commercial_name].filter((x): x is string => !!x && x.length > 0);
  for (const cand of candidates) {
    const { data } = await supabase
      .from("cn_equipment_master")
      .select("id,modelo")
      .ilike("modelo", cand)
      .limit(1)
      .maybeSingle();
    if (data) return data as { id: string; modelo: string };
  }
  for (const cand of candidates) {
    const { data } = await supabase
      .from("cn_equipment_master")
      .select("id,modelo")
      .ilike("modelo", `%${cand}%`)
      .limit(1)
      .maybeSingle();
    if (data) return data as { id: string; modelo: string };
  }
  return null;
}
