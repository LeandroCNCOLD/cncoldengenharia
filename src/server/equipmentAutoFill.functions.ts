/**
 * Auto-preenchimento da ficha do equipamento a partir do Catálogo CN.
 *
 * Fluxo:
 *  1. previewAutoFillFromCnCatalog(equipmentProjectId)
 *     - busca o equipment_project
 *     - tenta achar a curva CN equivalente (modelo === code; fallback ilike)
 *     - lista o que será criado (evap/cond/compressor/fan_evap/fan_cond)
 *     - lista conflitos (componentes/links já existentes)
 *  2. commitAutoFillFromCnCatalog(equipmentProjectId, overwrite)
 *     - cria component_items (evap, cond) com evaporator_coil_models /
 *       condenser_coil_models pré-preenchidos
 *     - vincula compressor + ventiladores (top-1 das sugestões CN)
 *     - cria equipment_component_links
 *
 * Regras:
 *  - Se overwrite=false e houver conflito, NADA é criado/sobrescrito.
 *  - Se overwrite=true, links/component_items existentes daquela "role" são
 *    apagados antes de inserir o novo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/attach-auth";
import {
  suggestComponentsForCatalogModel,
  type ComponentSuggestion,
} from "@/lib/coldpro/cn-catalog-suggestions";
import {
  extractGeometry,
  extractMidPointOps,
  findCurveForEquipment,
  type AutoFillItemPreview,
  type AutoFillPreview,
  type AutoFillRoleKey,
  type CnCurveRow,
} from "./equipmentAutoFill.server";

export type {
  AutoFillItemPreview,
  AutoFillPreview,
  AutoFillRoleKey,
} from "./equipmentAutoFill.server";

// ============================================================================
// 1. PREVIEW
// ============================================================================

export const previewAutoFillFromCnCatalog = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ equipmentProjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AutoFillPreview> => {
    const { supabase } = context;
    const warnings: string[] = [];

    const { data: project, error: pe } = await supabase
      .from("equipment_projects")
      .select("id,code,commercial_name,refrigerant")
      .eq("id", data.equipmentProjectId)
      .maybeSingle();
    if (pe) throw new Error(pe.message ?? "Erro ao carregar equipamento.");
    if (!project) throw new Error("Equipamento não encontrado.");

    const curve = await findCurveForEquipment(
      supabase as never,
      project.code as string | null,
      project.commercial_name as string | null,
    );

    if (!curve) {
      return {
        matched: false,
        catalogModelId: null,
        catalogModel: null,
        refrigerante: null,
        items: [],
        warnings: [
          `Nenhum modelo do catálogo CN casa com "${project.code ?? project.commercial_name}".`,
        ],
      };
    }

    const raw = (curve.raw_json as Record<string, unknown>) ?? {};
    const evapGeo = extractGeometry(raw, "evaporador");
    const condGeo = extractGeometry(raw, "condensador");

    // Componentes existentes
    const { data: existingItems } = await supabase
      .from("component_items")
      .select("id,kind,manufacturer,model,code")
      .eq("equipment_project_id", data.equipmentProjectId);
    const { data: existingLinks } = await supabase
      .from("equipment_component_links")
      .select("id,role,technical_component_id")
      .eq("equipment_project_id", data.equipmentProjectId);

    const itemBy = (kind: string) =>
      (existingItems ?? []).find((i) => i.kind === kind);
    const linkBy = (role: string) => (existingLinks ?? []).find((l) => l.role === role);

    const items: AutoFillItemPreview[] = [];

    // Evaporador
    {
      const existing = itemBy("evaporador");
      const hasGeo = evapGeo.rows != null || evapGeo.tubesPerRow != null;
      items.push({
        role: "evaporator",
        label: "Evaporador",
        description: hasGeo
          ? `${evapGeo.rows ?? "?"}×${evapGeo.tubesPerRow ?? "?"} · ${evapGeo.circuits ?? "?"} circ. · aleta ${evapGeo.finPitchMm ?? "?"}mm · ${evapGeo.coilLengthMm ?? "?"}mm`
          : "Sem geometria no catálogo CN.",
        conflict: !!existing,
        existing: existing
          ? { kind: "evaporador", label: existing.model ?? existing.code ?? "(sem modelo)" }
          : null,
        available: hasGeo,
        unavailableReason: hasGeo ? undefined : "Geometria do evaporador ausente no raw_json.",
      });
    }

    // Condensador
    {
      const existing = itemBy("condensador");
      const hasGeo = condGeo.rows != null || condGeo.tubesPerRow != null;
      items.push({
        role: "condenser",
        label: "Condensador",
        description: hasGeo
          ? `${condGeo.rows ?? "?"}×${condGeo.tubesPerRow ?? "?"} · ${condGeo.circuits ?? "?"} circ. · aleta ${condGeo.finPitchMm ?? "?"}mm · ${condGeo.coilLengthMm ?? "?"}mm`
          : "Sem geometria no catálogo CN.",
        conflict: !!existing,
        existing: existing
          ? { kind: "condensador", label: existing.model ?? existing.code ?? "(sem modelo)" }
          : null,
        available: hasGeo,
        unavailableReason: hasGeo ? undefined : "Geometria do condensador ausente no raw_json.",
      });
    }

    // Sugestões CN (compressor + fan)
    const suggResult = await suggestComponentsForCatalogModel(curve as never, {
      fanCount: 2,
      airflowM3h: evapGeo.airflowM3h ?? undefined,
    }).catch((e: unknown) => {
      warnings.push(`Falha ao sugerir compressor/ventiladores: ${(e as Error).message}`);
      return null;
    });

    const topComp = suggResult?.compressor_suggestions?.[0] ?? null;
    const topFan = suggResult?.fan_suggestions?.[0] ?? null;

    // Compressor
    {
      const existing = linkBy("compressor");
      items.push({
        role: "compressor",
        label: "Compressor",
        description: topComp
          ? `${topComp.label} · score ${(topComp.score * 100).toFixed(0)}% · ${topComp.tier}`
          : "Sem sugestão de compressor.",
        conflict: !!existing,
        existing: existing ? { kind: "link", label: "compressor já vinculado" } : null,
        available: !!topComp,
        unavailableReason: topComp ? undefined : "Nenhum compressor compatível na biblioteca.",
      });
    }

    // Ventilador evap
    {
      const existing = linkBy("fan_evaporator");
      items.push({
        role: "fan_evaporator",
        label: "Ventilador (evaporador)",
        description: topFan
          ? `${topFan.label} · ${topFan.tier}`
          : "Sem sugestão de ventilador.",
        conflict: !!existing,
        existing: existing ? { kind: "link", label: "ventilador evap. já vinculado" } : null,
        available: !!topFan,
        unavailableReason: topFan ? undefined : "Nenhum ventilador na biblioteca.",
      });
    }

    // Ventilador cond — usa o mesmo top, ou o segundo se houver
    {
      const existing = linkBy("fan_condenser");
      const candidate = suggResult?.fan_suggestions?.[1] ?? topFan;
      items.push({
        role: "fan_condenser",
        label: "Ventilador (condensador)",
        description: candidate
          ? `${candidate.label} · ${candidate.tier}`
          : "Sem sugestão de ventilador.",
        conflict: !!existing,
        existing: existing ? { kind: "link", label: "ventilador cond. já vinculado" } : null,
        available: !!candidate,
        unavailableReason: candidate ? undefined : "Nenhum ventilador na biblioteca.",
      });
    }

    return {
      matched: true,
      catalogModelId: curve.id as string,
      catalogModel: curve.modelo as string,
      refrigerante: (curve.refrigerante as string | null) ?? null,
      items,
      warnings: [...warnings, ...(suggResult?.warnings ?? [])],
    };
  });

// ============================================================================
// 2. COMMIT
// ============================================================================

export const commitAutoFillFromCnCatalog = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        equipmentProjectId: z.string().uuid(),
        overwrite: z.boolean().optional(),
        roles: z
          .array(
            z.enum([
              "evaporator",
              "condenser",
              "compressor",
              "fan_evaporator",
              "fan_condenser",
            ]),
          )
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const overwrite = !!data.overwrite;
      const rolesAllowed = new Set<AutoFillRoleKey>(
        (data.roles as AutoFillRoleKey[] | undefined) ?? [
          "evaporator",
          "condenser",
          "compressor",
          "fan_evaporator",
          "fan_condenser",
        ],
      );

      const { data: project, error: pe } = await supabase
        .from("equipment_projects")
        .select("id,code,commercial_name,refrigerant")
        .eq("id", data.equipmentProjectId)
        .maybeSingle();
      if (pe) throw new Error(pe.message ?? "Erro ao carregar equipamento.");
      if (!project) throw new Error("Equipamento não encontrado.");

      const curve = await findCurveForEquipment(
        supabase as never,
        project.code as string | null,
        project.commercial_name as string | null,
      );
      if (!curve) throw new Error("Modelo CN não encontrado para este equipamento.");
      const c: CnCurveRow = curve;

      const raw = (c.raw_json as Record<string, unknown>) ?? {};
      const evapGeo = extractGeometry(raw, "evaporador");
      const condGeo = extractGeometry(raw, "condensador");
      const ops = extractMidPointOps(c.curva_json);
      const refrig = c.refrigerante ?? (project.refrigerant as string | null) ?? null;

      const created: { role: AutoFillRoleKey; id: string }[] = [];
      const skipped: { role: AutoFillRoleKey; reason: string }[] = [];

      // ---------- helper: cria/substitui component_item ----------
      async function ensureComponentItem(
        kind: "evaporador" | "condensador",
      ): Promise<string | null> {
        const { data: existing } = await supabase
          .from("component_items")
          .select("id")
          .eq("equipment_project_id", data.equipmentProjectId)
          .eq("kind", kind);
        if (existing && existing.length > 0) {
          if (!overwrite) return null;
          await supabase
            .from("component_items")
            .delete()
            .in(
              "id",
              existing.map((e) => e.id as string),
            );
        }
        const { data: item, error: ie } = await supabase
          .from("component_items")
          .insert({
            equipment_project_id: data.equipmentProjectId,
            kind: kind as never,
            description: `Pré-preenchido pelo catálogo CN (${c.modelo}).`,
            status: "draft" as never,
            raw_fields: {
              source: "cn_catalog",
              catalog_model_id: c.id,
              catalog_model: c.modelo,
            } as never,
            validated_fields: {} as never,
            created_by: userId,
          })
          .select("id")
          .single();
        if (ie) throw new Error(ie.message ?? `Erro ao criar ${kind}.`);
        return item.id as string;
      }

      // ---------- EVAPORADOR ----------
      if (rolesAllowed.has("evaporator")) {
        if (evapGeo.rows == null && evapGeo.tubesPerRow == null) {
          skipped.push({ role: "evaporator", reason: "geometria ausente" });
        } else {
          const itemId = await ensureComponentItem("evaporador");
          if (itemId) {
            const { error: me } = await supabase.from("evaporator_coil_models").upsert(
              {
                component_item_id: itemId,
                refrigerant: refrig,
                rows: evapGeo.rows,
                tubes_per_row: evapGeo.tubesPerRow,
                circuits: evapGeo.circuits,
                length_mm: evapGeo.coilLengthMm,
                fin_pitch_mm: evapGeo.finPitchMm,
                tube_od_mm: evapGeo.tubeOdMm,
                fin_thickness_mm: evapGeo.finThicknessMm,
                nominal_airflow_m3h: evapGeo.airflowM3h ?? ops.airflowM3h,
                nominal_evap_temp_c: ops.tempEvapC,
                nominal_capacity_w:
                  ops.capacityKcalh != null ? ops.capacityKcalh * 1.163 : null,
                rh_in_pct: ops.rhInPct,
                superheat_k: ops.superheatK,
                subcooling_k: ops.subcoolingK,
                raw_fields: { source: "cn_catalog", catalog_model: c.modelo } as never,
              },
              { onConflict: "component_item_id" },
            );
            if (me) throw new Error(me.message ?? "Erro ao gravar evaporator_coil_models.");
            created.push({ role: "evaporator", id: itemId });
          } else {
            skipped.push({ role: "evaporator", reason: "já existia (sem overwrite)" });
          }
        }
      }

      // ---------- CONDENSADOR ----------
      if (rolesAllowed.has("condenser")) {
        if (condGeo.rows == null && condGeo.tubesPerRow == null) {
          skipped.push({ role: "condenser", reason: "geometria ausente" });
        } else {
          const itemId = await ensureComponentItem("condensador");
          if (itemId) {
            const { error: me } = await supabase.from("condenser_coil_models").upsert(
              {
                component_item_id: itemId,
                refrigerant: refrig,
                rows: condGeo.rows,
                tubes_per_row: condGeo.tubesPerRow,
                circuits: condGeo.circuits,
                length_mm: condGeo.coilLengthMm,
                fin_pitch_mm: condGeo.finPitchMm,
                tube_od_mm: condGeo.tubeOdMm,
                fin_thickness_mm: condGeo.finThicknessMm,
                nominal_airflow_m3h: condGeo.airflowM3h,
                nominal_cond_temp_c: ops.tempCondC,
                raw_fields: { source: "cn_catalog", catalog_model: c.modelo } as never,
              },
              { onConflict: "component_item_id" },
            );
            if (me) throw new Error(me.message ?? "Erro ao gravar condenser_coil_models.");
            created.push({ role: "condenser", id: itemId });
          } else {
            skipped.push({ role: "condenser", reason: "já existia (sem overwrite)" });
          }
        }
      }

      // ---------- LINKS (compressor + ventiladores) ----------
      // Precisamos que as sugestões existam em technical_components
      // (a função suggest retorna ids de compressor_models / fan_models, NÃO de
      // technical_components). Por isso buscamos um TC equivalente por
      // manufacturer+model. Se não houver, criamos um TC.
      const suggResult = await suggestComponentsForCatalogModel(curve as never, {
        fanCount: 2,
        airflowM3h: evapGeo.airflowM3h ?? undefined,
      }).catch(() => null);

      async function ensureTechnicalComponent(
        s: ComponentSuggestion,
        entityType: "compressor" | "fan",
      ): Promise<string | null> {
        const { data: existing } = await supabase
          .from("technical_components")
          .select("id")
          .eq("entity_type", entityType)
          .ilike("manufacturer", s.manufacturer ?? "")
          .ilike("model", s.model)
          .limit(1)
          .maybeSingle();
        if (existing) return existing.id as string;

        const { data: tc, error: te } = await supabase
          .from("technical_components")
          .insert({
            entity_type: entityType as never,
            manufacturer: s.manufacturer,
            model: s.model,
            code: s.model,
            status: "approved" as never,
            context: "reference",
            source: "cn_catalog_suggestion",
            normalized_json: s.simulatedValues as never,
            compatible_refrigerants_json: refrig ? ([refrig] as never) : ([] as never),
          })
          .select("id")
          .single();
        if (te) throw new Error(te.message ?? "Erro ao criar technical_component.");
        return tc.id as string;
      }

      async function ensureLink(
        role: AutoFillRoleKey,
        s: ComponentSuggestion | null,
        entityType: "compressor" | "fan",
      ) {
        if (!rolesAllowed.has(role)) return;
        if (!s) {
          skipped.push({ role, reason: "sem sugestão disponível" });
          return;
        }
        const { data: existing } = await supabase
          .from("equipment_component_links")
          .select("id")
          .eq("equipment_project_id", data.equipmentProjectId)
          .eq("role", role);
        if (existing && existing.length > 0) {
          if (!overwrite) {
            skipped.push({ role, reason: "link existente (sem overwrite)" });
            return;
          }
          await supabase
            .from("equipment_component_links")
            .delete()
            .in(
              "id",
              existing.map((e) => e.id as string),
            );
        }
        const tcId = await ensureTechnicalComponent(s, entityType);
        if (!tcId) {
          skipped.push({ role, reason: "falha ao registrar componente técnico" });
          return;
        }
        const { data: link, error: le } = await supabase
          .from("equipment_component_links")
          .insert({
            equipment_project_id: data.equipmentProjectId,
            technical_component_id: tcId,
            role: role as never,
            quantity: 1,
            notes: `Auto-vinculado pelo catálogo CN (${c.modelo}).`,
            created_by: userId,
          })
          .select("id")
          .single();
        if (le) throw new Error(le.message ?? `Erro ao vincular ${role}.`);
        created.push({ role, id: link.id as string });
      }

      await ensureLink("compressor", suggResult?.compressor_suggestions?.[0] ?? null, "compressor");
      await ensureLink("fan_evaporator", suggResult?.fan_suggestions?.[0] ?? null, "fan");
      await ensureLink(
        "fan_condenser",
        suggResult?.fan_suggestions?.[1] ?? suggResult?.fan_suggestions?.[0] ?? null,
        "fan",
      );

      return {
        ok: true,
        catalogModel: c.modelo,
        created,
        skipped,
      };
    } catch (err) {
      console.error("commitAutoFillFromCnCatalog failed:", err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  });
