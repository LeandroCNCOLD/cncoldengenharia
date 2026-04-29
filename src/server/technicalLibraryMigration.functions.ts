/**
 * Migração inicial: popula technical_components a partir das tabelas finais
 * já existentes (unilab_geometries, compressor_models, fan_models,
 * coil_fluids, refrigerants, coil_geometry_factors, compressor_polynomials,
 * fan_curves).
 *
 * Idempotente — usa source_raw_id (carregado com o id da tabela origem) para
 * evitar duplicação em re-execuções.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type EntityType =
  | "compressor"
  | "fan"
  | "evaporator_coil"
  | "condenser_coil"
  | "refrigerant"
  | "fluid";

type Status = "approved" | "validated" | "mapped";

interface Inserted {
  entity_type: EntityType;
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  status: Status;
  normalized_json: Record<string, unknown>;
  source_raw_id: string;
  source_batch_id: null;
  source_mapped_id: null;
  approved_at: string | null;
  approved_by: string | null;
  family: string | null;
  application: string | null;
}

const BATCH = 500;

async function existingSourceIds(entity: EntityType): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  // paginar; .select('source_raw_id') sem count
  // não temos > 100k esperados aqui, mas paginação por segurança
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("technical_components")
      .select("source_raw_id")
      .eq("entity_type", entity)
      .not("source_raw_id", "is", null)
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.source_raw_id) ids.add(r.source_raw_id);
    if (data.length < 1000) break;
    from += 1000;
  }
  return ids;
}

async function insertChunked(rows: Inserted[]) {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from("technical_components")
      .insert(slice as never);
    if (error) throw new Error(error.message);
    total += slice.length;
  }
  return total;
}

function nowIso() {
  return new Date().toISOString();
}

export const migrateExistingDataToUniversalLibrary = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId ?? null;
    const summary: Record<string, number> = {};

    // ========== COMPRESSORES ==========
    {
      const skip = await existingSourceIds("compressor");
      const { data, error } = await supabaseAdmin
        .from("compressor_models")
        .select("*")
        .limit(50000);
      if (error) throw new Error(`compressor_models: ${error.message}`);
      const rows: Inserted[] = (data ?? [])
        .filter((r) => !skip.has(r.id))
        .map((r) => {
          const isUnilab =
            (r.manufacturer ?? "").toLowerCase().includes("unilab") ||
            r.source_db === "unilab";
          const status: Status = isUnilab ? "approved" : "validated";
          return {
            entity_type: "compressor",
            manufacturer: r.manufacturer ?? null,
            model: r.model ?? null,
            code: r.model ?? null,
            status,
            normalized_json: r as Record<string, unknown>,
            source_raw_id: r.id,
            source_batch_id: null,
            source_mapped_id: null,
            approved_at: nowIso(),
            approved_by: userId,
            family: r.compressor_type ?? null,
            application: r.application_type ?? null,
          };
        });
      summary.compressors = await insertChunked(rows);
    }

    // ========== VENTILADORES ==========
    {
      const skip = await existingSourceIds("fan");
      const { data, error } = await supabaseAdmin
        .from("fan_models")
        .select("*")
        .limit(50000);
      if (error) throw new Error(`fan_models: ${error.message}`);
      const rows: Inserted[] = (data ?? [])
        .filter((r) => !skip.has(r.id))
        .map((r) => {
          const hasCurve = Boolean(
            r.nominal_airflow_m3h && r.nominal_pressure_pa,
          );
          const status: Status = hasCurve ? "validated" : "mapped";
          return {
            entity_type: "fan",
            manufacturer: r.manufacturer ?? null,
            model: r.model ?? null,
            code: r.model ?? null,
            status,
            normalized_json: r as Record<string, unknown>,
            source_raw_id: r.id,
            source_batch_id: null,
            source_mapped_id: null,
            approved_at: status === "validated" ? nowIso() : null,
            approved_by: status === "validated" ? userId : null,
            family: r.fan_type ?? null,
            application: null,
          };
        });
      summary.fans = await insertChunked(rows);
    }

    // ========== REFRIGERANTES ==========
    {
      const skip = await existingSourceIds("refrigerant");
      const { data, error } = await supabaseAdmin
        .from("refrigerants")
        .select("*")
        .limit(10000);
      if (error) throw new Error(`refrigerants: ${error.message}`);
      const rows: Inserted[] = (data ?? [])
        .filter((r) => !skip.has(r.id))
        .map((r) => ({
          entity_type: "refrigerant",
          manufacturer: null,
          model: r.code ?? r.name ?? null,
          code: r.code ?? null,
          status: "approved" as const,
          normalized_json: r as Record<string, unknown>,
          source_raw_id: r.id,
          source_batch_id: null,
          source_mapped_id: null,
          approved_at: nowIso(),
          approved_by: userId,
          family: r.family ?? r.type ?? null,
          application: null,
        }));
      summary.refrigerants = await insertChunked(rows);
    }

    // ========== FLUIDOS (props térmicas) ==========
    {
      const skip = await existingSourceIds("fluid");
      const { data, error } = await supabaseAdmin
        .from("coil_fluids")
        .select("*")
        .limit(10000);
      if (error) throw new Error(`coil_fluids: ${error.message}`);
      const rows: Inserted[] = (data ?? [])
        .filter((r) => !skip.has(r.id))
        .map((r) => ({
          entity_type: "fluid",
          manufacturer: null,
          model: r.name ?? null,
          code: r.name ?? null,
          status: "approved" as const,
          normalized_json: r as Record<string, unknown>,
          source_raw_id: r.id,
          source_batch_id: null,
          source_mapped_id: null,
          approved_at: nowIso(),
          approved_by: userId,
          family: r.family ?? r.fluid_type ?? null,
          application: null,
        }));
      summary.fluids = await insertChunked(rows);
    }

    // ========== GEOMETRIAS UNILAB → coils ==========
    // unilab_geometries está vazia hoje, mas tratamos por completude.
    // Mapeamos modo para entity_type (cooling/direct_expansion → evaporator;
    // condensing → condenser; demais ignorados).
    {
      const skipEvap = await existingSourceIds("evaporator_coil");
      const skipCond = await existingSourceIds("condenser_coil");

      // Geometrias canônicas (unilab_geometries) — tabela pode estar vazia.
      const { data: geos } = await supabaseAdmin
        .from("unilab_geometries")
        .select("*")
        .limit(10000);
      const geoRows: Inserted[] = [];
      for (const g of geos ?? []) {
        const gAny = g as Record<string, unknown>;
        const mode = String(gAny.mode ?? "").toLowerCase();
        let entity: EntityType | null = null;
        if (mode.includes("cool") || mode.includes("expansion") || mode.includes("evap"))
          entity = "evaporator_coil";
        else if (mode.includes("cond")) entity = "condenser_coil";
        if (!entity) continue;
        const skip = entity === "evaporator_coil" ? skipEvap : skipCond;
        const id = String(gAny.id ?? "");
        if (!id || skip.has(id)) continue;
        geoRows.push({
          entity_type: entity,
          manufacturer: "Unilab",
          model: (gAny.geometry_code as string) ?? (gAny.sigla as string) ?? null,
          code: (gAny.sigla as string) ?? null,
          status: "approved",
          normalized_json: gAny,
          source_raw_id: id,
          source_batch_id: null,
          source_mapped_id: null,
          approved_at: nowIso(),
          approved_by: userId,
          family: mode || null,
          application: null,
        });
      }
      const geoInserted = await insertChunked(geoRows);

      // Fatores de geometria (coil_geometry_factors) — também coil-related.
      const { data: facs, error: facErr } = await supabaseAdmin
        .from("coil_geometry_factors")
        .select("*")
        .limit(50000);
      if (facErr) throw new Error(`coil_geometry_factors: ${facErr.message}`);
      const facRows: Inserted[] = [];
      for (const f of facs ?? []) {
        const mode = String(f.mode ?? "").toLowerCase();
        let entity: EntityType | null = null;
        if (mode.includes("cool") || mode.includes("expansion") || mode.includes("evap"))
          entity = "evaporator_coil";
        else if (mode.includes("cond")) entity = "condenser_coil";
        if (!entity) continue;
        const skip = entity === "evaporator_coil" ? skipEvap : skipCond;
        if (skip.has(f.id)) continue;
        facRows.push({
          entity_type: entity,
          manufacturer: "Unilab",
          model: f.geometry_code ?? f.sigla ?? null,
          code: f.sigla ?? null,
          status: "approved",
          normalized_json: f as Record<string, unknown>,
          source_raw_id: f.id,
          source_batch_id: null,
          source_mapped_id: null,
          approved_at: nowIso(),
          approved_by: userId,
          family: mode || null,
          application: null,
        });
      }
      const facInserted = await insertChunked(facRows);

      summary.evaporator_coils = 0;
      summary.condenser_coils = 0;
      for (const r of [...geoRows, ...facRows]) {
        if (r.entity_type === "evaporator_coil") summary.evaporator_coils++;
        else if (r.entity_type === "condenser_coil") summary.condenser_coils++;
      }
      summary.coil_geometries_total = geoInserted + facInserted;
    }

    return { ok: true, summary };
  });
