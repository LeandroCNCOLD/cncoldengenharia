/**
 * Server functions para o formulário Unilab-style do Coil Simulator.
 *
 * NOTA: As funções relacionadas ao Catálogo CN (`cn_catalog_performance_curves`)
 * foram desativadas após a remoção do Catálogo 480 / pipeline CN.
 * Mantemos a mesma assinatura para que `unilab-coil-form-panel.tsx` continue
 * compilando — todas devolvem listas vazias / null.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CoilMaterialRow = {
  id: string;
  name: string;
  category: "tube" | "fin" | "both";
  thermal_conductivity_w_mk: number;
};

export const listCoilMaterials = createServerFn({ method: "GET" }).handler(
  async (): Promise<CoilMaterialRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("coil_materials")
      .select("id,name,category,thermal_conductivity_w_mk")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CoilMaterialRow[];
  },
);

export type CnCatalogModelLite = {
  id: string;
  modelo: string;
  refrigerante: string | null;
  linha: string | null;
  hp: string | null;
  totalPontos: number | null;
  curvaIndice: number | null;
};

export const listCnCatalogModelsLite = createServerFn({ method: "GET" }).handler(
  async (): Promise<CnCatalogModelLite[]> => [],
);

export type CnCatalogGeometry = {
  tubesPerRow: number | null;
  rows: number | null;
  coilLengthMm: number | null;
  circuits: number | null;
  finPitchMm: number | null;
  tubeOdMm: number | null;
  tubeWallMm: number | null;
  tubePitchMm: number | null;
  rowPitchMm: number | null;
  finThicknessMm: number | null;
  skippedTubes: number | null;
  airflowM3h: number | null;
};

export type CnCatalogPoint = {
  id: string;
  modelo: string;
  refrigerante: string | null;
  curvaIndice: number | null;
  totalPontos: number | null;
  capacityKcalh: number | null;
  capacityW: number | null;
  tempEvapC: number | null;
  tempCondC: number | null;
  superheatK: number | null;
  subcoolingK: number | null;
  airflowM3h: number | null;
  rhInPct: number | null;
  evaporatorGeometry: CnCatalogGeometry;
  condenserGeometry: CnCatalogGeometry;
  raw: Record<string, string | number | boolean | null>;
};

export const getCnCatalogPointByModelId = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ modelId: z.string().uuid() }).parse(data))
  .handler(async (): Promise<CnCatalogPoint | null> => null);

export const findCnCatalogPointByCode = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        code: z.string().min(1).optional(),
        commercialName: z.string().min(1).optional(),
      })
      .parse(data),
  )
  .handler(async (): Promise<CnCatalogPoint | null> => null);

export const listCnCatalogPointsByModelo = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ modelo: z.string().min(1), refrigerante: z.string().optional() }).parse(data),
  )
  .handler(
    async (): Promise<
      Array<{
        id: string;
        curvaIndice: number | null;
        refrigerante: string | null;
        tempEvapC: number | null;
        tempCondC: number | null;
        capacityKcalh: number | null;
      }>
    > => [],
  );
