import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Mappers raw → tipado. Lê unilab_source_rows e popula:
 *   - unilab_geometries
 *   - compressor_models + compressor_polynomials
 *   - fan_models + fan_curves
 *   - refrigerants
 *
 * Usa apenas o batch mais recente (ignora duplicatas de import).
 * Faz UPSERT por chave natural (geometry_code / model+refrigerant / model).
 */

const InputSchema = z.object({
  targets: z.array(z.enum(["geometries", "compressors", "fans", "refrigerants", "all"])).min(1),
});

type RawRow = { id: string; raw_json: Record<string, unknown> };

type MapperResult = { inserted: number; skipped: number; errors: string[] };
type RunResult = Record<string, MapperResult> & { totalMs: number };

const PAGE_SIZE = 1000;

/** Pega o id do source_file mais recente para um (database, table). */
async function pickLatestFile(database: string, table: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("unilab_source_files")
    .select("id, created_at")
    .eq("source_database", database)
    .eq("source_table", table)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`pickLatestFile(${database}/${table}): ${error.message}`);
  return data?.[0]?.id ?? null;
}

/** Itera sobre todas as raw_rows de um source_file_id em páginas. */
async function* iterateRows(sourceFileId: string): AsyncGenerator<RawRow[]> {
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("unilab_source_rows")
      .select("id, raw_json")
      .eq("source_file_id", sourceFileId)
      .order("row_index", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`iterateRows: ${error.message}`);
    if (!data || data.length === 0) return;
    yield data as RawRow[];
    if (data.length < PAGE_SIZE) return;
    from += PAGE_SIZE;
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/* ---------------------------------------------------------------------- */
/* GEOMETRIES                                                              */
/* ---------------------------------------------------------------------- */

const GEOM_SOURCES: { table: string; mode: string }[] = [
  { table: "Tbl_GeometrieEspansioneDiretta", mode: "expansion" },
  { table: "Tbl_GeometrieCondensazione", mode: "condensation" },
];

async function mapGeometries(): Promise<MapperResult> {
  const result: MapperResult = { inserted: 0, skipped: 0, errors: [] };
  for (const { table, mode } of GEOM_SOURCES) {
    const fileId = await pickLatestFile("01_Coils6_Principal", table);
    if (!fileId) {
      result.errors.push(`${table}: nenhum source_file encontrado`);
      continue;
    }
    const rowsToInsert: Array<Record<string, unknown>> = [];
    for await (const page of iterateRows(fileId)) {
      for (const row of page) {
        const r = row.raw_json;
        const code = str(r["CodiceBatteria"]) ?? str(r["Sigla"]);
        if (!code) {
          result.skipped++;
          continue;
        }
        rowsToInsert.push({
          geometry_code: code,
          mode,
          description: str(r["Descrizione"]),
          fin_type: str(r["TipoAletta"]),
          tube_type: str(r["TipoTubo"]),
          tube_outer_diameter_mm: num(r["DiamEster"]),
          fin_thickness_mm: num(r["SpessoreAletta"]),
          row_pitch_mm: num(r["PassoRanghi"]),
          tube_pitch_mm: num(r["PassoTubi"]),
          source_table: table,
          raw_json: r,
        });
      }
    }
    if (rowsToInsert.length === 0) continue;

    // Limpa as geometrias deste mode para evitar duplicatas em re-runs
    await supabaseAdmin.from("unilab_geometries").delete().eq("mode", mode);

    // Insere em batches de 500
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const batch = rowsToInsert.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("unilab_geometries").insert(batch);
      if (error) {
        result.errors.push(`${table}: insert ${error.message}`);
      } else {
        result.inserted += batch.length;
      }
    }
  }
  return result;
}

/* ---------------------------------------------------------------------- */
/* REFRIGERANTS                                                            */
/* ---------------------------------------------------------------------- */

async function mapRefrigerants(): Promise<MapperResult> {
  const result: MapperResult = { inserted: 0, skipped: 0, errors: [] };

  // Tbl_Freon vive em vários bancos; pegamos o de 16_LinePressureDrop_PerdaCarga (canon)
  const fileId =
    (await pickLatestFile("16_LinePressureDrop_PerdaCarga", "Tbl_Freon")) ??
    (await pickLatestFile("01_Coils6_Principal", "Tbl_Freon"));
  if (!fileId) {
    result.errors.push("Tbl_Freon: nenhum source_file encontrado");
    return result;
  }

  const seen = new Set<string>();
  const rows: Array<Record<string, unknown>> = [];
  for await (const page of iterateRows(fileId)) {
    for (const row of page) {
      const r = row.raw_json;
      const code = str(r["Description"]);
      if (!code || seen.has(code)) {
        result.skipped++;
        continue;
      }
      seen.add(code);
      rows.push({
        code,
        name: code,
        family: code.startsWith("R7") ? "natural" : code.startsWith("R29") || code.startsWith("R32") || code.startsWith("R12") ? "HFO/HC" : "HFC",
        raw_json: r,
      });
    }
  }
  if (rows.length === 0) return result;

  // Upsert por code (limpa antes para garantir consistência)
  await supabaseAdmin.from("refrigerants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabaseAdmin.from("refrigerants").insert(rows);
  if (error) result.errors.push(`refrigerants insert: ${error.message}`);
  else result.inserted = rows.length;
  return result;
}

/* ---------------------------------------------------------------------- */
/* COMPRESSORS                                                             */
/* ---------------------------------------------------------------------- */

/** Map IdsFreon (numérico do Unilab) -> código do refrigerante. */
async function loadFreonMap(): Promise<Map<number, string>> {
  const fileId =
    (await pickLatestFile("16_LinePressureDrop_PerdaCarga", "Tbl_Freon")) ??
    (await pickLatestFile("01_Coils6_Principal", "Tbl_Freon"));
  const map = new Map<number, string>();
  if (!fileId) return map;
  for await (const page of iterateRows(fileId)) {
    for (const row of page) {
      const id = num(row.raw_json["IDFreon"]);
      const code = str(row.raw_json["Description"]);
      if (id !== null && code) map.set(id, code);
    }
  }
  return map;
}

function extractAhriCoeffs(r: Record<string, unknown>): number[] {
  const coefs: number[] = [];
  for (let i = 1; i <= 10; i++) {
    const k = `Var${i.toString().padStart(2, "0")}`;
    const n = num(r[k]);
    coefs.push(n ?? 0);
  }
  return coefs;
}

async function mapCompressors(): Promise<MapperResult> {
  const result: MapperResult = { inserted: 0, skipped: 0, errors: [] };
  const freonMap = await loadFreonMap();

  // 1) compressor_models a partir de Tbl_Compressor_Model
  const modelFileId = await pickLatestFile("01_Coils6_Principal", "Tbl_Compressor_Model");
  if (!modelFileId) {
    result.errors.push("Tbl_Compressor_Model: não encontrado");
    return result;
  }

  type ModelKey = string; // `${IdCompModel}|${IdsFreon}`
  const modelMap = new Map<ModelKey, { model: string; refrigerant: string | null; raw: Record<string, unknown> }>();
  for await (const page of iterateRows(modelFileId)) {
    for (const row of page) {
      const r = row.raw_json;
      const id = num(r["IdCompModel"]);
      const refId = num(r["IdsFreon"]);
      const model = str(r["Model"]);
      if (id === null || !model) {
        result.skipped++;
        continue;
      }
      const key = `${id}|${refId ?? "0"}`;
      if (!modelMap.has(key)) {
        modelMap.set(key, {
          model,
          refrigerant: refId !== null ? freonMap.get(refId) ?? null : null,
          raw: r,
        });
      }
    }
  }

  // Limpa tabelas
  await supabaseAdmin.from("compressor_polynomials").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabaseAdmin.from("compressor_models").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Insere modelos e guarda mapping IdCompModel -> uuid
  const idToUuid = new Map<string, string>();
  const modelRows = Array.from(modelMap.entries()).map(([key, v]) => ({
    model: v.model,
    refrigerant: v.refrigerant,
    compressor_type: "scroll", // default; Unilab não traz por modelo
    raw_json: { ...v.raw, _key: key },
  }));

  for (let i = 0; i < modelRows.length; i += 200) {
    const batch = modelRows.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from("compressor_models")
      .insert(batch)
      .select("id, raw_json");
    if (error) {
      result.errors.push(`compressor_models batch ${i}: ${error.message}`);
      continue;
    }
    for (const ins of data ?? []) {
      const k = (ins.raw_json as Record<string, unknown>)?._key as string | undefined;
      if (k) idToUuid.set(k, ins.id as string);
    }
    result.inserted += batch.length;
  }

  // 2) Polinômios a partir de Tbl_Compressor_Capacity / AbsorbedPower / Current
  const polySources: { table: string; curveType: string }[] = [
    { table: "Tbl_Compressor_Capacity", curveType: "capacity" },
    { table: "Tbl_Compressor_AbsorbedPower", curveType: "absorbed_power" },
    { table: "Tbl_Compressor_Current", curveType: "current" },
  ];

  for (const { table, curveType } of polySources) {
    const fileId = await pickLatestFile("01_Coils6_Principal", table);
    if (!fileId) {
      result.errors.push(`${table}: não encontrado`);
      continue;
    }
    const polyRows: Array<Record<string, unknown>> = [];
    for await (const page of iterateRows(fileId)) {
      for (const row of page) {
        const r = row.raw_json;
        const id = num(r["IdCompModel"]);
        const refId = num(r["IDFreon"]);
        if (id === null) {
          result.skipped++;
          continue;
        }
        const key = `${id}|${refId ?? "0"}`;
        const compUuid = idToUuid.get(key);
        if (!compUuid) {
          result.skipped++;
          continue;
        }
        polyRows.push({
          compressor_id: compUuid,
          curve_type: curveType,
          unit_system: "SI",
          coefficients_json: extractAhriCoeffs(r),
          temp_evap_min_c: num(r["Temin"]),
          temp_evap_max_c: num(r["Temax"]),
          temp_cond_min_c: num(r["Tcmin"]),
          temp_cond_max_c: num(r["Tcmax"]),
          raw_json: r,
        });
      }
    }
    for (let i = 0; i < polyRows.length; i += 500) {
      const batch = polyRows.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("compressor_polynomials").insert(batch);
      if (error) result.errors.push(`${table} insert: ${error.message}`);
      else result.inserted += batch.length;
    }
  }

  return result;
}

/* ---------------------------------------------------------------------- */
/* FANS                                                                    */
/* ---------------------------------------------------------------------- */

async function mapFans(): Promise<MapperResult> {
  const result: MapperResult = { inserted: 0, skipped: 0, errors: [] };

  // 1) Modelos
  const modelFileId = await pickLatestFile("01_Coils6_Principal", "Tbl_Fan_Model");
  if (!modelFileId) {
    result.errors.push("Tbl_Fan_Model: não encontrado");
    return result;
  }

  await supabaseAdmin.from("fan_curves").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabaseAdmin.from("fan_models").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const idToUuid = new Map<number, string>();
  const modelRows: Array<{ rawId: number; row: Record<string, unknown> }> = [];

  for await (const page of iterateRows(modelFileId)) {
    for (const row of page) {
      const r = row.raw_json;
      const id = num(r["IdFanModel"]);
      const model = str(r["Model"]);
      if (id === null || !model) {
        result.skipped++;
        continue;
      }
      modelRows.push({
        rawId: id,
        row: {
          model,
          fan_type: str(r["Type"]) ?? "axial",
          diameter_mm: num(r["Diameter"]),
          nominal_airflow_m3h: num(r["NominalFlow"]),
          nominal_pressure_pa: num(r["NominalPressure"]),
          nominal_power_w: num(r["PotenzaAssorbita"]) ?? num(r["NominalPower"]),
          raw_json: { ...r, _rawId: id },
        },
      });
    }
  }

  for (let i = 0; i < modelRows.length; i += 200) {
    const batch = modelRows.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from("fan_models")
      .insert(batch.map((b) => b.row))
      .select("id, raw_json");
    if (error) {
      result.errors.push(`fan_models batch ${i}: ${error.message}`);
      continue;
    }
    for (const ins of data ?? []) {
      const rawId = (ins.raw_json as Record<string, unknown>)?._rawId as number | undefined;
      if (typeof rawId === "number") idToUuid.set(rawId, ins.id as string);
    }
    result.inserted += batch.length;
  }

  // 2) Curvas — axiais (Tbl_Fan_Axial_*) e centrífugos (Tbl_Fan_Centr_Curve)
  const curveSources = [
    { table: "Tbl_Fan_Axial_0_1", curveType: "axial_table_x_y", idField: "IdFanModel" },
    { table: "Tbl_Fan_Axial_0_2", curveType: "axial_poly5", idField: "IdFanModel" },
    { table: "Tbl_Fan_Axial_1_1", curveType: "axial_table_x_y", idField: "IdFanModel" },
    { table: "Tbl_Fan_Axial_1_2", curveType: "axial_poly5", idField: "IdFanModel" },
    { table: "Tbl_Fan_Centr_Curve", curveType: "centr_table_43pt", idField: "CodVentRif" },
  ];

  for (const src of curveSources) {
    const fileId = await pickLatestFile("01_Coils6_Principal", src.table);
    if (!fileId) continue;
    const rows: Array<Record<string, unknown>> = [];
    for await (const page of iterateRows(fileId)) {
      for (const row of page) {
        const r = row.raw_json;
        const rawId = num(r[src.idField]);
        if (rawId === null) {
          result.skipped++;
          continue;
        }
        const fanUuid = idToUuid.get(rawId);
        if (!fanUuid) {
          result.skipped++;
          continue;
        }
        rows.push({
          fan_id: fanUuid,
          curve_type: src.curveType,
          table_data_json: r,
          coefficients_json: [],
          raw_json: { source_table: src.table, ...r },
        });
      }
    }
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("fan_curves").insert(batch);
      if (error) result.errors.push(`${src.table} insert: ${error.message}`);
      else result.inserted += batch.length;
    }
  }

  return result;
}

/* ---------------------------------------------------------------------- */
/* SERVER FUNCTION                                                         */
/* ---------------------------------------------------------------------- */

export const runColdproMappers = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<RunResult> => {
    const t0 = Date.now();
    const targets = data.targets.includes("all")
      ? (["geometries", "refrigerants", "compressors", "fans"] as const)
      : (data.targets.filter((t) => t !== "all") as ReadonlyArray<"geometries" | "refrigerants" | "compressors" | "fans">);

    const out: Record<string, MapperResult> = {};
    for (const t of targets) {
      try {
        if (t === "geometries") out.geometries = await mapGeometries();
        else if (t === "refrigerants") out.refrigerants = await mapRefrigerants();
        else if (t === "compressors") out.compressors = await mapCompressors();
        else if (t === "fans") out.fans = await mapFans();
      } catch (e) {
        out[t] = {
          inserted: 0,
          skipped: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }
    return { ...out, totalMs: Date.now() - t0 } as RunResult;
  });
