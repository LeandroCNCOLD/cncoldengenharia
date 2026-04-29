import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnilabCalculationMode, UnilabGeometryFactor } from "./types";
import { fromDatabaseRow, toDatabaseRow } from "./unilabGeometryFactorMapper";

export async function createUnilabImportBatch(
  supabase: SupabaseClient,
  input: { sourceName?: string; sourceVersion?: string; sourceHash?: string; notes?: string },
): Promise<string> {
  const { data, error } = await supabase
    .from("unilab_import_batches")
    .insert({
      source_name: input.sourceName ?? "unilab_all_tables",
      source_version: input.sourceVersion,
      source_hash: input.sourceHash,
      notes: input.notes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function upsertUnilabGeometryFactors(
  supabase: SupabaseClient,
  factors: UnilabGeometryFactor[],
  importBatchId?: string,
): Promise<number> {
  if (factors.length === 0) return 0;
  const rows = factors.map((f) => toDatabaseRow(f, importBatchId));
  const chunkSize = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("coil_geometry_factors")
      .upsert(chunk, { onConflict: "mode,geometry_code,sigla,source_table" });
    if (error) throw error;
    total += chunk.length;
  }
  return total;
}

export async function findGeometryFactor(
  supabase: SupabaseClient,
  args: {
    mode: UnilabCalculationMode;
    sigla?: string;
    description?: string;
    geometryCode?: string;
  },
): Promise<UnilabGeometryFactor | null> {
  let query = supabase
    .from("coil_geometry_factors")
    .select("*")
    .eq("mode", args.mode)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (args.sigla) query = query.ilike("sigla", args.sigla);
  else if (args.description) query = query.ilike("description", args.description);
  else if (args.geometryCode) query = query.eq("geometry_code", args.geometryCode);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? fromDatabaseRow(data) : null;
}
