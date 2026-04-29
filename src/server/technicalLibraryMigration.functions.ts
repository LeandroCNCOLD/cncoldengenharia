/**
 * Migração incremental: popula technical_components a partir das tabelas
 * finais existentes. Cada chamada processa um chunk pequeno (MAX_PER_RUN)
 * e retorna { done } — o cliente re-chama até done=true.
 *
 * Idempotente via source_raw_id.
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
  source: string;
  context: string;
  normalized_json: Record<string, unknown>;
  source_raw_id: string;
  source_batch_id: null;
  source_mapped_id: null;
  approved_at: string | null;
  approved_by: string | null;
  family: string | null;
  application: string | null;
}

function inferSource(manufacturer: string | null | undefined, fallback: string): string {
  const m = (manufacturer ?? "").toUpperCase();
  if (m.includes("BITZER")) return "BITZER";
  if (m.includes("DANFOSS")) return "DANFOSS";
  if (m.includes("TORIN")) return "TORIN";
  if (m.includes("UNILAB")) return "UNILAB";
  if (m.includes("VAPCYC")) return "VAPCYC";
  return fallback;
}

// Limites conservadores para caber no Worker (CPU/memória/tempo).
const PAGE = 500; // tamanho de página de leitura
const INSERT_CHUNK = 200; // tamanho do insert
const MAX_PER_RUN = 2000; // máximo de registros migrados por chamada

const SOURCES: Array<
  "compressor" | "fan" | "refrigerant" | "fluid" | "coil_geometry"
> = ["refrigerant", "fluid", "fan", "coil_geometry", "compressor"];

function nowIso() {
  return new Date().toISOString();
}

async function insertChunked(rows: Inserted[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const slice = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabaseAdmin
      .from("technical_components")
      .insert(slice as never);
    if (error) throw new Error(error.message);
    total += slice.length;
  }
  return total;
}

/** Retorna ids já presentes em technical_components para um conjunto de candidatos. */
async function existingFor(
  entity: EntityType,
  candidateIds: string[],
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < candidateIds.length; i += 500) {
    const slice = candidateIds.slice(i, i + 500);
    const { data, error } = await supabaseAdmin
      .from("technical_components")
      .select("source_raw_id")
      .eq("entity_type", entity)
      .in("source_raw_id", slice);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) if (r.source_raw_id) out.add(r.source_raw_id);
  }
  return out;
}

interface SourceResult {
  inserted: number;
  exhausted: boolean; // true se a fonte foi totalmente percorrida
}

async function migrateCompressors(userId: string | null, budget: number): Promise<SourceResult> {
  let inserted = 0;
  let offset = 0;
  while (inserted < budget) {
    const { data, error } = await supabaseAdmin
      .from("compressor_models")
      .select("id, model, manufacturer, refrigerant, compressor_type, application_type, source_db")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`compressor_models: ${error.message}`);
    const page = data ?? [];
    if (page.length === 0) return { inserted, exhausted: true };

    const skip = await existingFor("compressor", page.map((r) => r.id));
    const rows: Inserted[] = page
      .filter((r) => !skip.has(r.id))
      .slice(0, budget - inserted)
      .map((r) => {
        const isUnilab =
          (r.manufacturer ?? "").toLowerCase().includes("unilab") ||
          r.source_db === "unilab";
        return {
          entity_type: "compressor",
          manufacturer: r.manufacturer ?? null,
          model: r.model ?? null,
          code: r.model ?? null,
          status: isUnilab ? "approved" : "validated",
          source: isUnilab ? "UNILAB" : inferSource(r.manufacturer, "UNKNOWN"),
          context: "reference",
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
    inserted += await insertChunked(rows);
    offset += page.length;
    if (page.length < PAGE) return { inserted, exhausted: true };
  }
  return { inserted, exhausted: false };
}

async function migrateFans(userId: string | null, budget: number): Promise<SourceResult> {
  let inserted = 0;
  let offset = 0;
  while (inserted < budget) {
    const { data, error } = await supabaseAdmin
      .from("fan_models")
      .select("id, model, manufacturer, fan_type, nominal_airflow_m3h, nominal_pressure_pa")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`fan_models: ${error.message}`);
    const page = data ?? [];
    if (page.length === 0) return { inserted, exhausted: true };
    const skip = await existingFor("fan", page.map((r) => r.id));
    const rows: Inserted[] = page
      .filter((r) => !skip.has(r.id))
      .slice(0, budget - inserted)
      .map((r) => {
        const hasCurve = Boolean(r.nominal_airflow_m3h && r.nominal_pressure_pa);
        const status: Status = hasCurve ? "validated" : "mapped";
        return {
          entity_type: "fan",
          manufacturer: r.manufacturer ?? null,
          model: r.model ?? null,
          code: r.model ?? null,
          status,
          source: inferSource(r.manufacturer, "UNKNOWN"),
          context: "reference",
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
    inserted += await insertChunked(rows);
    offset += page.length;
    if (page.length < PAGE) return { inserted, exhausted: true };
  }
  return { inserted, exhausted: false };
}

async function migrateRefrigerants(userId: string | null, budget: number): Promise<SourceResult> {
  const { data, error } = await supabaseAdmin
    .from("refrigerants")
    .select("*")
    .limit(5000);
  if (error) throw new Error(`refrigerants: ${error.message}`);
  const page = data ?? [];
  const skip = await existingFor("refrigerant", page.map((r) => r.id));
  const rows: Inserted[] = page
    .filter((r) => !skip.has(r.id))
    .slice(0, budget)
    .map((r) => ({
      entity_type: "refrigerant",
      manufacturer: null,
      model: r.code ?? r.name ?? null,
      code: r.code ?? null,
      status: "approved",
      source: "UNILAB",
      context: "reference",
      normalized_json: r as Record<string, unknown>,
      source_raw_id: r.id,
      source_batch_id: null,
      source_mapped_id: null,
      approved_at: nowIso(),
      approved_by: userId,
      family: r.family ?? r.type ?? null,
      application: null,
    }));
  const inserted = await insertChunked(rows);
  return { inserted, exhausted: true };
}

async function migrateFluids(userId: string | null, budget: number): Promise<SourceResult> {
  const { data, error } = await supabaseAdmin
    .from("coil_fluids")
    .select("*")
    .limit(5000);
  if (error) throw new Error(`coil_fluids: ${error.message}`);
  const page = data ?? [];
  const skip = await existingFor("fluid", page.map((r) => r.id));
  const rows: Inserted[] = page
    .filter((r) => !skip.has(r.id))
    .slice(0, budget)
    .map((r) => ({
      entity_type: "fluid",
      manufacturer: null,
      model: r.name ?? null,
      code: r.name ?? null,
      status: "approved",
      normalized_json: r as Record<string, unknown>,
      source_raw_id: r.id,
      source_batch_id: null,
      source_mapped_id: null,
      approved_at: nowIso(),
      approved_by: userId,
      family: r.family ?? r.fluid_type ?? null,
      application: null,
    }));
  const inserted = await insertChunked(rows);
  return { inserted, exhausted: true };
}

async function migrateCoilGeometry(userId: string | null, budget: number): Promise<SourceResult> {
  let inserted = 0;
  let offset = 0;
  while (inserted < budget) {
    const { data, error } = await supabaseAdmin
      .from("coil_geometry_factors")
      .select("id, mode, geometry_code, sigla")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`coil_geometry_factors: ${error.message}`);
    const page = data ?? [];
    if (page.length === 0) return { inserted, exhausted: true };

    const evapIds = page
      .filter((f) => {
        const m = String(f.mode ?? "").toLowerCase();
        return m.includes("cool") || m.includes("expansion") || m.includes("evap");
      })
      .map((f) => f.id);
    const condIds = page
      .filter((f) => String(f.mode ?? "").toLowerCase().includes("cond"))
      .map((f) => f.id);
    const skipEvap = await existingFor("evaporator_coil", evapIds);
    const skipCond = await existingFor("condenser_coil", condIds);

    const rows: Inserted[] = [];
    for (const f of page) {
      const mode = String(f.mode ?? "").toLowerCase();
      let entity: EntityType | null = null;
      if (mode.includes("cool") || mode.includes("expansion") || mode.includes("evap"))
        entity = "evaporator_coil";
      else if (mode.includes("cond")) entity = "condenser_coil";
      if (!entity) continue;
      const skip = entity === "evaporator_coil" ? skipEvap : skipCond;
      if (skip.has(f.id)) continue;
      rows.push({
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
      if (inserted + rows.length >= budget) break;
    }
    inserted += await insertChunked(rows);
    offset += page.length;
    if (page.length < PAGE) return { inserted, exhausted: true };
  }
  return { inserted, exhausted: false };
}

export const migrateExistingDataToUniversalLibrary = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId ?? null;
    const summary: Record<string, number> = {};
    let budget = MAX_PER_RUN;
    let allExhausted = true;

    for (const src of SOURCES) {
      if (budget <= 0) {
        allExhausted = false;
        break;
      }
      let res: SourceResult;
      switch (src) {
        case "compressor":
          res = await migrateCompressors(userId, budget);
          break;
        case "fan":
          res = await migrateFans(userId, budget);
          break;
        case "refrigerant":
          res = await migrateRefrigerants(userId, budget);
          break;
        case "fluid":
          res = await migrateFluids(userId, budget);
          break;
        case "coil_geometry":
          res = await migrateCoilGeometry(userId, budget);
          break;
      }
      summary[src] = res.inserted;
      budget -= res.inserted;
      if (!res.exhausted) {
        allExhausted = false;
        break;
      }
    }

    return { ok: true, done: allExhausted, summary };
  });
