/**
 * Server functions para o Catálogo 480 consolidado.
 *
 *  - listCn480Catalog        → lista de modelos com flags de completude
 *  - getCn480Detail          → detalhe completo (master + evap + cond + comp + perf)
 *  - createEquipmentFromCn480→ cria equipment_project + componentes pré-preenchidos
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/attach-auth";
import {
  loadCn480List,
  loadCn480Detail,
  mapEvaporatorToCoilModel,
  mapCondenserToCoilModel,
  pickCompressorLabel,
  pickNominalPerformancePoint,
  inferEquipmentKindAndApplication,
  type Cn480Detail,
  type Cn480ListItem,
} from "./cn480Catalog.server";

export type { Cn480Detail, Cn480ListItem } from "./cn480Catalog.server";

export const listCn480Catalog = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<Cn480ListItem[]> => {
    const { supabase } = context;
    return loadCn480List(supabase);
  });

export const getCn480Detail = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ modelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Cn480Detail> => {
    const { supabase } = context;
    return loadCn480Detail(supabase, data.modelId);
  });

export type CreateFromCn480Result = {
  equipmentProjectId: string;
  reused: boolean;
  catalogModel: string;
  evaporatorComponentItemId: string | null;
  condenserComponentItemId: string | null;
  compressorComponentItemId: string | null;
  warnings: string[];
};

export const createEquipmentFromCn480 = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ modelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CreateFromCn480Result> => {
    const { supabase, userId } = context;
    const warnings: string[] = [];
    const detail = await loadCn480Detail(supabase, data.modelId);
    const m = detail.master;

    const kindApp = inferEquipmentKindAndApplication(m.linha);
    const compLabel = pickCompressorLabel(detail.compressor);
    const nom = pickNominalPerformancePoint(detail.performance);

    // -------- Idempotência: reaproveita projeto existente com mesmo code -----
    const { data: existing } = await supabase
      .from("equipment_projects")
      .select("id")
      .eq("code", m.modelo)
      .limit(1)
      .maybeSingle();

    let projectId: string;
    let reused = false;
    if (existing?.id) {
      projectId = existing.id as string;
      reused = true;
    } else {
      const { data: proj, error: pe } = await supabase
        .from("equipment_projects")
        .insert({
          code: m.modelo,
          commercial_name: m.modelo,
          family: m.linha,
          equipment_kind: kindApp.equipment_kind as never,
          application: kindApp.application as never,
          refrigerant: m.refrigerante,
          status: "draft" as never,
          notes: `Importado do Catálogo 480 (${m.origem_dados}).${
            compLabel ? ` Compressor: ${compLabel.label}.` : ""
          }`,
          created_by: userId,
        })
        .select("id")
        .single();
      if (pe || !proj) throw new Error(pe?.message ?? "Erro ao criar equipamento.");
      projectId = proj.id as string;
    }

    // -------- helper p/ criar/reusar component_item ---------
    async function ensureComponentItem(
      kind: "evaporador" | "condensador" | "compressor",
      raw: Record<string, unknown>,
      manufacturer: string | null = null,
      model: string | null = null,
    ): Promise<string> {
      const { data: existingItems } = await supabase
        .from("component_items")
        .select("id,raw_fields")
        .eq("equipment_project_id", projectId)
        .eq("kind", kind);
      const fromCatalog = (existingItems ?? []).find(
        (i: { raw_fields: unknown }) =>
          (i.raw_fields as { source?: string } | null)?.source === "cn_equipment_master",
      );
      if (fromCatalog) return fromCatalog.id as string;
      const { data: item, error: ie } = await supabase
        .from("component_items")
        .insert({
          equipment_project_id: projectId,
          kind: kind as never,
          manufacturer,
          model,
          description: `Pré-preenchido pelo Catálogo 480 (${m.modelo}).`,
          status: "imported" as never,
          raw_fields: {
            source: "cn_equipment_master",
            catalog_model_id: m.id,
            catalog_model: m.modelo,
            ...raw,
          } as never,
          validated_fields: {} as never,
          created_by: userId,
        })
        .select("id")
        .single();
      if (ie || !item) throw new Error(ie?.message ?? `Erro ao criar ${kind}.`);
      return item.id as string;
    }

    // -------- EVAPORADOR ----------
    let evapCiId: string | null = null;
    const evapFields = mapEvaporatorToCoilModel(detail);
    if (evapFields) {
      evapCiId = await ensureComponentItem("evaporador", {
        raw_master: detail.evaporator?.raw_json ?? {},
      });
      const { error: ee } = await supabase.from("evaporator_coil_models").upsert(
        {
          component_item_id: evapCiId,
          ...evapFields,
          raw_fields: {
            source: "cn_equipment_master",
            catalog_model: m.modelo,
            nominal_point: nom,
          } as never,
        },
        { onConflict: "component_item_id" },
      );
      if (ee) warnings.push(`Falha ao gravar evaporator_coil_models: ${ee.message}`);
    } else {
      warnings.push("Sem evaporador no catálogo 480 para este modelo.");
    }

    // -------- CONDENSADOR ----------
    let condCiId: string | null = null;
    const condFields = mapCondenserToCoilModel(detail);
    if (condFields) {
      condCiId = await ensureComponentItem("condensador", {
        raw_master: detail.condenser?.raw_json ?? {},
      });
      const { error: ce } = await supabase.from("condenser_coil_models").upsert(
        {
          component_item_id: condCiId,
          ...condFields,
          raw_fields: {
            source: "cn_equipment_master",
            catalog_model: m.modelo,
            nominal_point: nom,
          } as never,
        },
        { onConflict: "component_item_id" },
      );
      if (ce) warnings.push(`Falha ao gravar condenser_coil_models: ${ce.message}`);
    } else {
      warnings.push("Sem condensador no catálogo 480 para este modelo.");
    }

    // -------- COMPRESSOR (textual) ----------
    let compCiId: string | null = null;
    if (compLabel) {
      compCiId = await ensureComponentItem(
        "compressor",
        { raw_master: detail.compressor?.raw_json ?? {} },
        compLabel.manufacturer,
        compLabel.model,
      );
    } else {
      warnings.push("Sem compressor identificado no catálogo 480 para este modelo.");
    }

    return {
      equipmentProjectId: projectId,
      reused,
      catalogModel: m.modelo,
      evaporatorComponentItemId: evapCiId,
      condenserComponentItemId: condCiId,
      compressorComponentItemId: compCiId,
      warnings,
    };
  });
