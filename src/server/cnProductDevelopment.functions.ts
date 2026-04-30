/**
 * Server functions para o Kanban de Desenvolvimento de Produtos CN.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/attach-auth";

const STATUS = ["a_analisar", "em_analise", "sugestoes_ok", "aprovado", "arquivado"] as const;

export const listProducts = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ includeArchived: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("cn_product_development")
      .select("*")
      .order("status", { ascending: true })
      .order("position", { ascending: true });
    if (!data.includeArchived) q = q.neq("status", "arquivado");
    const { data: rows, error } = await q;
    if (error) throw error;

    // Conta curvas por modelo
    const models = (rows ?? []).map((r) => r.catalog_model);
    let curvesByModel: Record<string, number> = {};
    if (models.length > 0) {
      const { data: curves } = await supabase
        .from("cn_catalog_performance_curves")
        .select("modelo")
        .in("modelo", models);
      for (const c of curves ?? []) {
        curvesByModel[c.modelo] = (curvesByModel[c.modelo] ?? 0) + 1;
      }
    }
    return { products: rows ?? [], curvesByModel };
  });

export const getProductFullDetails = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: product, error: pe } = await supabase
      .from("cn_product_development")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (pe) throw pe;
    if (!product) throw new Error("Produto não encontrado.");

    const { data: curves, error: ce } = await supabase
      .from("cn_catalog_performance_curves")
      .select(
        "id, modelo, linha, hp, gabinete, tipo, refrigerante, curva_indice, total_pontos, corrente_estimada, corrente_partida, carga_fluido, origem, raw_json, curva_json",
      )
      .eq("modelo", product.catalog_model)
      .order("curva_indice", { ascending: true });
    if (ce) throw ce;

    // Extrai dados técnicos consolidados a partir do raw_json da primeira curva
    let technical: Record<string, string | number | null> = {};
    const first = curves?.[0];
    if (first?.raw_json && typeof first.raw_json === "object") {
      const raw = first.raw_json as Record<string, unknown>;
      const curvaRaw = raw.curva_raw;
      if (typeof curvaRaw === "string") {
        try {
          technical = JSON.parse(curvaRaw);
        } catch {
          technical = {};
        }
      } else if (curvaRaw && typeof curvaRaw === "object") {
        technical = curvaRaw as Record<string, unknown>;
      }
    }

    return {
      product,
      curves: curves ?? [],
      technical,
    };
  });

export const updateProductStatus = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(STATUS),
      position: z.number().int(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch = {
      status: data.status,
      position: data.position,
      ...(data.status === "arquivado" ? { archived_at: new Date().toISOString() } : {}),
    };
    const { error } = await supabase
      .from("cn_product_development")
      .update(patch)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      catalog_model: z.string().min(1).max(200),
      linha: z.string().optional().nullable(),
      hp: z.string().optional().nullable(),
      refrigerante: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: maxRow } = await supabase
      .from("cn_product_development")
      .select("position")
      .eq("status", "a_analisar")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? 0) + 1000;
    const { data: row, error } = await supabase
      .from("cn_product_development")
      .insert({
        catalog_model: data.catalog_model,
        linha: data.linha ?? null,
        hp: data.hp ?? null,
        refrigerante: data.refrigerante ?? null,
        notes: data.notes ?? null,
        status: "a_analisar",
        position: nextPos,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { product: row };
  });

export const approveProduct = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prod, error: pe } = await supabase
      .from("cn_product_development")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (pe) throw pe;
    if (!prod) throw new Error("Produto não encontrado.");

    let equipmentProjectId = prod.equipment_project_id;

    if (!equipmentProjectId) {
      // Cria equipment_project (status validated = pronto para uso)
      const { data: proj, error: ce } = await supabase
        .from("equipment_projects")
        .insert({
          commercial_name: prod.catalog_model,
          code: prod.catalog_model,
          equipment_kind: "unidade_condensadora" as never,
          application: "outro" as never,
          family: prod.linha ?? null,
          refrigerant: prod.refrigerante ?? null,
          status: "validated" as never,
          notes: `Aprovado a partir do Desenvolvimento de Produtos CN.`,
          created_by: userId,
        })
        .select()
        .single();
      if (ce) throw ce;
      equipmentProjectId = proj.id;
    } else {
      await supabase
        .from("equipment_projects")
        .update({ status: "validated" as never })
        .eq("id", equipmentProjectId);
    }

    const { data: maxRow } = await supabase
      .from("cn_product_development")
      .select("position")
      .eq("status", "aprovado")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? 0) + 1000;

    const { error: ue } = await supabase
      .from("cn_product_development")
      .update({
        status: "aprovado",
        position: nextPos,
        equipment_project_id: equipmentProjectId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (ue) throw ue;

    return { equipmentProjectId };
  });

export const ensureEquipmentProject = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prod, error: pe } = await supabase
      .from("cn_product_development")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (pe) throw pe;
    if (!prod) throw new Error("Produto não encontrado.");

    if (prod.equipment_project_id) {
      return { equipmentProjectId: prod.equipment_project_id };
    }

    const { data: proj, error: ce } = await supabase
      .from("equipment_projects")
      .insert({
        commercial_name: prod.catalog_model,
        code: prod.catalog_model,
        equipment_kind: "unidade_condensadora" as never,
        application: "outro" as never,
        family: prod.linha ?? null,
        refrigerant: prod.refrigerante ?? null,
        status: "draft" as never,
        notes: `Criado a partir do Desenvolvimento de Produtos CN.`,
        created_by: userId,
      })
      .select()
      .single();
    if (ce) throw ce;

    const { error: ue } = await supabase
      .from("cn_product_development")
      .update({ equipment_project_id: proj.id })
      .eq("id", data.id);
    if (ue) throw ue;

    return { equipmentProjectId: proj.id };
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      reason: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("cn_product_development")
      .update({
        status: "arquivado",
        archived_reason: data.reason ?? null,
        archived_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const unarchiveProduct = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("cn_product_development")
      .update({ status: "a_analisar", archived_at: null, archived_reason: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
