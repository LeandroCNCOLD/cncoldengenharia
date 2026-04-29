import type { MapperInput, MapperResult, TechnicalMapper } from "../types";

/** vapcycMapper — exports VAPCYC (compressores e sistemas). */
export const vapcycMapper: TechnicalMapper = {
  name: "vapcyc",

  canHandle(input) {
    const hay = (
      (input.sourceFile ?? "") +
      " " +
      (input.sourceTable ?? "") +
      " " +
      JSON.stringify(input.raw ?? {})
    ).toLowerCase();
    return hay.includes("vapcyc");
  },

  map(input: MapperInput): MapperResult {
    const r = input.raw as Record<string, unknown>;
    const model = (r.model as string) ?? (r.Model as string) ?? null;

    return {
      entityType: "compressor",
      manufacturer: (r.manufacturer as string) ?? "Generic",
      model,
      code: model,
      normalized: {
        model,
        refrigerant: r.refrigerant ?? null,
        units_system: r.units_system ?? "SI",
        raw: r,
      },
      confidence: model ? 0.55 : 0.25,
      errors: model ? [] : ["Modelo VAPCYC ausente."],
      warnings: [],
      mapperName: "vapcyc",
    };
  },
};
