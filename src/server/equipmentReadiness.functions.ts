/**
 * getEquipmentReadiness(equipmentProjectId)
 *   - Avalia o status técnico do equipamento em 9 itens
 *     (evap, cond, compressor, fan_evap, fan_cond, fluido, sim_evap, sim_cond, sim_sistema)
 *   - Devolve um veredicto "ok" | "incomplete" | "blocked" para cada item,
 *     mensagem amigável, lista de campos faltando e próxima ação recomendada.
 *
 * autoSimulateCoilsIfReady(equipmentProjectId)
 *   - Não executa simulações (a UI dispara os solvers no cliente),
 *     apenas reporta quais coils estão prontos para simulação automática.
 *   - Mantido como server function para que a página do equipamento
 *     possa decidir, no SSR/loader, se deve sugerir auto-simulação.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/attach-auth";
import {
  REQUIRED_COND_FIELDS,
  REQUIRED_EVAP_FIELDS,
  computeCompleteness,
  deriveNextAction,
  missingFields,
  type EquipmentReadinessResult,
  type ReadinessItem,
} from "./equipmentReadiness.server";

export type {
  EquipmentReadinessResult,
  ReadinessItem,
  ReadinessItemKey,
  ReadinessLevel,
} from "./equipmentReadiness.server";

export const getEquipmentReadiness = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ equipmentProjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<EquipmentReadinessResult> => {
    const { supabase } = context;
    const eqId = data.equipmentProjectId;

    const { data: project, error: pe } = await supabase
      .from("equipment_projects")
      .select("id,refrigerant")
      .eq("id", eqId)
      .maybeSingle();
    if (pe) throw new Error(pe.message ?? "Erro ao carregar equipamento.");
    if (!project) throw new Error("Equipamento não encontrado.");

    const [{ data: items }, { data: links }, { data: sims }] = await Promise.all([
      supabase
        .from("component_items")
        .select("id,kind")
        .eq("equipment_project_id", eqId),
      supabase
        .from("equipment_component_links")
        .select("id,role,technical_component_id")
        .eq("equipment_project_id", eqId),
      supabase
        .from("coil_simulations")
        .select("id,coil_type,outputs,created_at")
        .eq("equipment_project_id", eqId)
        .order("created_at", { ascending: false }),
    ]);

    const evapItem = (items ?? []).find((i) => i.kind === "evaporador") ?? null;
    const condItem = (items ?? []).find((i) => i.kind === "condensador") ?? null;

    // Carrega coil_models só quando há item correspondente
    const [evapModelRes, condModelRes] = await Promise.all([
      evapItem
        ? supabase
            .from("evaporator_coil_models")
            .select("*")
            .eq("component_item_id", evapItem.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      condItem
        ? supabase
            .from("condenser_coil_models")
            .select("*")
            .eq("component_item_id", condItem.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const evapModel = (evapModelRes.data ?? null) as Record<string, unknown> | null;
    const condModel = (condModelRes.data ?? null) as Record<string, unknown> | null;

    const linkBy = (role: string) => (links ?? []).find((l) => l.role === role);

    const out: ReadinessItem[] = [];

    // 1) Evaporador
    {
      if (!evapItem) {
        out.push({
          key: "evaporator",
          label: "Evaporador",
          status: "blocked",
          message: "Nenhum evaporador vinculado ao equipamento.",
        });
      } else {
        const miss = missingFields(evapModel, REQUIRED_EVAP_FIELDS as never);
        out.push({
          key: "evaporator",
          label: "Evaporador",
          status: miss.length === 0 ? "ok" : "incomplete",
          message:
            miss.length === 0
              ? "Geometria e ponto nominal completos."
              : `Faltam ${miss.length} campo(s) no modelo do evaporador.`,
          missing: miss.length > 0 ? miss : undefined,
        });
      }
    }

    // 2) Condensador
    {
      if (!condItem) {
        out.push({
          key: "condenser",
          label: "Condensador",
          status: "blocked",
          message: "Nenhum condensador vinculado ao equipamento.",
        });
      } else {
        const miss = missingFields(condModel, REQUIRED_COND_FIELDS as never);
        out.push({
          key: "condenser",
          label: "Condensador",
          status: miss.length === 0 ? "ok" : "incomplete",
          message:
            miss.length === 0
              ? "Geometria e ponto nominal completos."
              : `Faltam ${miss.length} campo(s) no modelo do condensador.`,
          missing: miss.length > 0 ? miss : undefined,
        });
      }
    }

    // 3) Compressor
    {
      const link = linkBy("compressor");
      out.push({
        key: "compressor",
        label: "Compressor",
        status: link ? "ok" : "blocked",
        message: link ? "Compressor vinculado." : "Nenhum compressor vinculado.",
      });
    }

    // 4) Ventilador evaporador
    {
      const link = linkBy("fan_evaporator");
      out.push({
        key: "fan_evaporator",
        label: "Ventilador (evaporador)",
        status: link ? "ok" : "incomplete",
        message: link ? "Ventilador do evaporador vinculado." : "Sem ventilador no evaporador.",
      });
    }

    // 5) Ventilador condensador
    {
      const link = linkBy("fan_condenser");
      out.push({
        key: "fan_condenser",
        label: "Ventilador (condensador)",
        status: link ? "ok" : "incomplete",
        message: link ? "Ventilador do condensador vinculado." : "Sem ventilador no condensador.",
      });
    }

    // 6) Fluido refrigerante
    {
      const refrig = project.refrigerant as string | null;
      out.push({
        key: "refrigerant",
        label: "Fluido refrigerante",
        status: refrig ? "ok" : "blocked",
        message: refrig ? `Fluido: ${refrig}` : "Fluido refrigerante não definido.",
      });
    }

    // 7/8) Simulações de coil já gravadas
    const lastSimByType = new Map<string, (typeof sims extends Array<infer R> ? R : never)>();
    for (const s of sims ?? []) {
      const t = (s.coil_type as string) ?? "";
      if (!lastSimByType.has(t)) lastSimByType.set(t, s as never);
    }
    const evapItemReady =
      evapItem != null &&
      missingFields(evapModel, REQUIRED_EVAP_FIELDS as never).length === 0;
    const condItemReady =
      condItem != null &&
      missingFields(condModel, REQUIRED_COND_FIELDS as never).length === 0;

    {
      const sim = lastSimByType.get("evaporator") ?? lastSimByType.get("evaporador");
      if (sim) {
        out.push({
          key: "sim_evaporator",
          label: "Simulação evaporador",
          status: "ok",
          message: "Última simulação disponível.",
        });
      } else if (!evapItemReady) {
        out.push({
          key: "sim_evaporator",
          label: "Simulação evaporador",
          status: "blocked",
          message: "Complete os dados do evaporador antes de simular.",
        });
      } else {
        out.push({
          key: "sim_evaporator",
          label: "Simulação evaporador",
          status: "incomplete",
          message: "Pronto para simular — clique em 'Simular evaporador'.",
        });
      }
    }

    {
      const sim = lastSimByType.get("condenser") ?? lastSimByType.get("condensador");
      if (sim) {
        out.push({
          key: "sim_condenser",
          label: "Simulação condensador",
          status: "ok",
          message: "Última simulação disponível.",
        });
      } else if (!condItemReady) {
        out.push({
          key: "sim_condenser",
          label: "Simulação condensador",
          status: "blocked",
          message: "Complete os dados do condensador antes de simular.",
        });
      } else {
        out.push({
          key: "sim_condenser",
          label: "Simulação condensador",
          status: "incomplete",
          message: "Pronto para simular — clique em 'Simular condensador'.",
        });
      }
    }

    // 9) Simulação de sistema completo
    {
      const simEvapOk =
        out.find((i) => i.key === "sim_evaporator")?.status === "ok";
      const simCondOk =
        out.find((i) => i.key === "sim_condenser")?.status === "ok";
      const compOk = out.find((i) => i.key === "compressor")?.status === "ok";

      if (!simEvapOk || !simCondOk || !compOk) {
        const reasons: string[] = [];
        if (!simEvapOk) reasons.push("evaporador não simulado");
        if (!simCondOk) reasons.push("condensador não simulado");
        if (!compOk) reasons.push("compressor não vinculado");
        out.push({
          key: "sim_system",
          label: "Simulação de sistema",
          status: "blocked",
          message: `Bloqueado: ${reasons.join(", ")}.`,
        });
      } else {
        // Verifica se há simulação de sistema salva
        const { data: sysRuns } = await supabase
          .from("equipment_simulations")
          .select("id,created_at")
          .eq("equipment_project_id", eqId)
          .order("created_at", { ascending: false })
          .limit(1);
        const hasSys = sysRuns != null && sysRuns.length > 0;
        out.push({
          key: "sim_system",
          label: "Simulação de sistema",
          status: hasSys ? "ok" : "incomplete",
          message: hasSys
            ? "Última simulação de sistema disponível."
            : "Pronto para simular o sistema completo.",
        });
      }
    }

    // Carrega catalog model usado no auto-fill (se houver)
    let catalogModel: string | null = null;
    if (evapItem || condItem) {
      const { data: refItems } = await supabase
        .from("component_items")
        .select("raw_fields")
        .eq("equipment_project_id", eqId)
        .limit(5);
      for (const ri of refItems ?? []) {
        const rf = ri.raw_fields as Record<string, unknown> | null;
        const m = rf?.["catalog_model"];
        if (typeof m === "string") {
          catalogModel = m;
          break;
        }
      }
    }

    return {
      equipmentProjectId: eqId,
      refrigerant: (project.refrigerant as string | null) ?? null,
      catalogModel,
      completeness: computeCompleteness(out),
      nextAction: deriveNextAction(out),
      items: out,
    };
  });

// ============================================================================
// autoSimulateCoilsIfReady — reporta o que está pronto para simular.
// (A execução do solver acontece no cliente, com base nesta resposta.)
// ============================================================================

export const autoSimulateCoilsIfReady = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ equipmentProjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const eqId = data.equipmentProjectId;

    const { data: items } = await supabase
      .from("component_items")
      .select("id,kind")
      .eq("equipment_project_id", eqId);

    const evapItem = (items ?? []).find((i) => i.kind === "evaporador") ?? null;
    const condItem = (items ?? []).find((i) => i.kind === "condensador") ?? null;

    const [evapModelRes, condModelRes, simsRes] = await Promise.all([
      evapItem
        ? supabase
            .from("evaporator_coil_models")
            .select("*")
            .eq("component_item_id", evapItem.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      condItem
        ? supabase
            .from("condenser_coil_models")
            .select("*")
            .eq("component_item_id", condItem.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("coil_simulations")
        .select("coil_type")
        .eq("equipment_project_id", eqId),
    ]);

    const evapModel = (evapModelRes.data ?? null) as Record<string, unknown> | null;
    const condModel = (condModelRes.data ?? null) as Record<string, unknown> | null;
    const simTypes = new Set((simsRes.data ?? []).map((s) => (s.coil_type as string) ?? ""));

    const evapReady =
      evapItem != null &&
      missingFields(evapModel, REQUIRED_EVAP_FIELDS as never).length === 0;
    const condReady =
      condItem != null &&
      missingFields(condModel, REQUIRED_COND_FIELDS as never).length === 0;

    const evapAlreadySim = simTypes.has("evaporator") || simTypes.has("evaporador");
    const condAlreadySim = simTypes.has("condenser") || simTypes.has("condensador");

    return {
      evaporator: {
        ready: evapReady,
        alreadySimulated: evapAlreadySim,
        shouldRun: evapReady && !evapAlreadySim,
        componentItemId: evapItem?.id ?? null,
      },
      condenser: {
        ready: condReady,
        alreadySimulated: condAlreadySim,
        shouldRun: condReady && !condAlreadySim,
        componentItemId: condItem?.id ?? null,
      },
    };
  });
