/**
 * Server functions para o fluxo Catálogo CN → componentes reais.
 *
 * - generateAndCacheSuggestions: roda o motor e persiste em cn_catalog_component_suggestions
 * - acceptSuggestion / rejectSuggestion: muda status
 * - createEquipmentFromCatalog: cria equipment_project + component_items + links
 *   a partir das sugestões aceitas
 * - validateAgainstCatalogCurve: chama o catalog-calibration existente
 * - diagnoseCatalogVsSimulation: usa Lovable AI Gateway para diagnóstico técnico
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  suggestComponentsForCatalogModel,
  type ComponentSuggestion,
  type ComponentType,
} from "@/lib/coldpro/cn-catalog-suggestions";
import type { CatalogCurve } from "@/lib/coldpro/catalog-curves";

// ============================================================================
// 1. Gerar e cachear sugestões
// ============================================================================

const generateInput = z.object({
  catalogModelId: z.string().uuid(),
  fanCount: z.number().int().min(1).max(20).optional(),
  airflowM3h: z.number().positive().optional(),
  pressurePa: z.number().nonnegative().optional(),
  forceRefresh: z.boolean().optional(),
});

export const generateAndCacheCnSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => generateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Carrega curva CN
    const { data: curveRow, error: curveErr } = await supabase
      .from("cn_catalog_performance_curves")
      .select("*")
      .eq("id", data.catalogModelId)
      .maybeSingle();
    if (curveErr) throw curveErr;
    if (!curveRow) throw new Error("Modelo CN não encontrado.");

    const curve = curveRow as unknown as CatalogCurve;

    // 2. Se já existe cache válido e não foi pedido refresh → retorna
    if (!data.forceRefresh) {
      const { data: existing } = await supabase
        .from("cn_catalog_component_suggestions")
        .select("*")
        .eq("catalog_model_id", data.catalogModelId)
        .neq("status", "outdated")
        .order("ranking", { ascending: true });
      if (existing && existing.length > 0) {
        return { fromCache: true, suggestions: existing, warnings: [] };
      }
    }

    // 3. Roda motor
    const result = await suggestComponentsForCatalogModel(curve, {
      fanCount: data.fanCount,
      airflowM3h: data.airflowM3h,
      pressurePa: data.pressurePa,
    });

    // 4. Persiste (deleta antigos do mesmo catálogo + insere novos)
    await supabase
      .from("cn_catalog_component_suggestions")
      .delete()
      .eq("catalog_model_id", data.catalogModelId);

    const all: ComponentSuggestion[] = [
      ...result.compressor_suggestions,
      ...result.fan_suggestions,
      ...result.coil_suggestions,
      ...result.valve_suggestions,
    ];

    if (all.length > 0) {
      const rows = all.map((s) => ({
        catalog_model_id: data.catalogModelId,
        catalog_model: result.catalogModel,
        refrigerante: result.refrigerante,
        component_type: s.componentType,
        suggested_table: s.suggestedTable,
        suggested_component_id: s.suggestedComponentId,
        score: s.score,
        ranking: s.ranking,
        tier: s.tier,
        reason_json: { ...s.reason, label: s.label, manufacturer: s.manufacturer, model: s.model } as never,
        simulated_values_json: s.simulatedValues as never,
        status: "suggested" as const,
        created_by: userId,
      }));
      const { error: insErr } = await supabase
        .from("cn_catalog_component_suggestions")
        .insert(rows);
      if (insErr) throw insErr;
    }

    const { data: saved } = await supabase
      .from("cn_catalog_component_suggestions")
      .select("*")
      .eq("catalog_model_id", data.catalogModelId)
      .order("ranking", { ascending: true });

    return { fromCache: false, suggestions: saved ?? [], warnings: result.warnings };
  });

// ============================================================================
// 2. Aceitar / rejeitar sugestão
// ============================================================================

export const setSuggestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      suggestionId: z.string().uuid(),
      status: z.enum(["suggested", "accepted", "rejected", "outdated"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("cn_catalog_component_suggestions")
      .update({ status: data.status })
      .eq("id", data.suggestionId);
    if (error) throw error;
    return { ok: true };
  });

// ============================================================================
// 3. Criar equipamento a partir das sugestões aceitas
// ============================================================================

const KIND_BY_COMPONENT: Record<ComponentType, string> = {
  compressor: "compressor",
  fan: "ventilador",
  coil: "evaporador", // padrão; o usuário pode trocar depois
  valve: "valvula_expansao",
};

export const createEquipmentFromCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      catalogModelId: z.string().uuid(),
      commercialName: z.string().min(1).max(200),
      code: z.string().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Carrega curva e sugestões aceitas
    const { data: curve, error: ce } = await supabase
      .from("cn_catalog_performance_curves")
      .select("modelo,refrigerante,linha")
      .eq("id", data.catalogModelId)
      .maybeSingle();
    if (ce) throw ce;
    if (!curve) throw new Error("Modelo CN não encontrado.");

    const { data: accepted, error: ae } = await supabase
      .from("cn_catalog_component_suggestions")
      .select("*")
      .eq("catalog_model_id", data.catalogModelId)
      .eq("status", "accepted");
    if (ae) throw ae;

    // Cria equipment_project
    const { data: proj, error: pe } = await supabase
      .from("equipment_projects")
      .insert({
        commercial_name: data.commercialName,
        code: data.code,
        equipment_kind: "unidade_condensadora",
        application: "outro",
        family: curve.linha ?? null,
        refrigerant: curve.refrigerante ?? null,
        notes: `Gerado a partir do catálogo CN (modelo ${curve.modelo}).`,
        created_by: userId,
      })
      .select()
      .single();
    if (pe) throw pe;

    // Cria component_items + links
    const createdItems: { id: string; type: string }[] = [];
    for (const s of accepted ?? []) {
      const kind = KIND_BY_COMPONENT[s.component_type as ComponentType] ?? "outro";
      const reason = (s.reason_json as Record<string, unknown>) ?? {};
      const { data: item, error: ie } = await supabase
        .from("component_items")
        .insert({
          equipment_project_id: proj.id,
          kind: kind as never,
          manufacturer: (reason.manufacturer as string | null) ?? null,
          model: (reason.model as string | null) ?? null,
          description: `Sugerido pelo catálogo CN (ranking ${s.ranking}, tier ${s.tier}).`,
          status: "draft" as never,
          raw_fields: { source: "cn_catalog", suggestion_id: s.id, suggested_table: s.suggested_table, suggested_component_id: s.suggested_component_id },
          validated_fields: s.simulated_values_json ?? {},
          created_by: userId,
        })
        .select()
        .single();
      if (ie) throw ie;
      createdItems.push({ id: item.id, type: s.component_type });
    }

    return { equipmentProjectId: proj.id, createdItems };
  });

// ============================================================================
// 4. Diagnóstico IA (Lovable AI Gateway)
// ============================================================================

export const diagnoseCatalogVsSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      catalogModelId: z.string().uuid(),
      simulationSummary: z.record(z.string(), z.unknown()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { diagnosis: null, error: "LOVABLE_API_KEY não configurada." };
    }

    const { data: curve } = await supabase
      .from("cn_catalog_performance_curves")
      .select("modelo,refrigerante,hp,linha,corrente_estimada,corrente_partida,carga_fluido,total_pontos,curva_json")
      .eq("id", data.catalogModelId)
      .maybeSingle();

    if (!curve) return { diagnosis: null, error: "Modelo CN não encontrado." };

    const prompt = [
      "Você é um engenheiro frigorista sênior da CN COLD.",
      "Compare a CURVA REAL DO CATÁLOGO com o RESULTADO SIMULADO do sistema e produza um diagnóstico técnico em PT-BR.",
      "Avalie: compressor fora do envelope, ventilador subdimensionado, coil insuficiente, excesso de carga de fluido, divergência de corrente, gargalo térmico.",
      "Liste recomendações priorizadas (alta/média/baixa).",
      "",
      "CATÁLOGO CN:",
      JSON.stringify(curve),
      "",
      "SIMULAÇÃO:",
      JSON.stringify(data.simulationSummary),
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um engenheiro frigorista sênior. Responda em PT-BR, conciso e técnico." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { diagnosis: null, error: `IA: ${res.status} ${txt.slice(0, 300)}` };
      }
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content ?? null;
      return { diagnosis: content, error: null };
    } catch (err) {
      return { diagnosis: null, error: (err as Error).message };
    }
  });
