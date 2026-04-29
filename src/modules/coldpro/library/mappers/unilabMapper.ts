import type { MapperInput, MapperResult, TechnicalMapper } from "../types";

/**
 * unilabMapper — geometrias e fatores Unilab. Espelha a normalização que
 * `src/modules/thermalcalc/engines/coil/unilab/unilabMapper.ts` faz, mas
 * a partir do raw_json importado, sem dependência da query do banco.
 */
export const unilabMapper: TechnicalMapper = {
  name: "unilab",

  canHandle(input) {
    const hay = (
      (input.sourceFile ?? "") +
      " " +
      (input.sourceTable ?? "") +
      " " +
      JSON.stringify(input.raw ?? {})
    ).toLowerCase();
    return (
      hay.includes("unilab") ||
      hay.includes("tbl_geometrie") ||
      hay.includes("geometry_code")
    );
  },

  map(input: MapperInput): MapperResult {
    const r = input.raw as Record<string, unknown>;
    const errors: string[] = [];

    const geometryCode =
      (r.geometry_code as string) ?? (r.GeometryCode as string) ?? (r.codice as string) ?? null;
    if (!geometryCode) errors.push("Geometria sem geometry_code.");

    const isFactor =
      "factor_a0" in r || "fattore_attr_aria" in r || "fat_cor_al" in r;

    return {
      entityType: isFactor ? "evaporator_coil" : "evaporator_coil",
      manufacturer: "Unilab",
      model: geometryCode,
      code: geometryCode,
      normalized: {
        geometry_code: geometryCode,
        mode: r.mode ?? null,
        is_factor: isFactor,
        raw: r,
      },
      confidence: geometryCode ? 0.85 : 0.2,
      errors,
      warnings: [],
      mapperName: "unilab",
    };
  },
};
