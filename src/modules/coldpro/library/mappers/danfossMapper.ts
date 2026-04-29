import type { MapperInput, MapperResult, TechnicalMapper } from "../types";

/**
 * danfossMapper — compressores e válvulas Danfoss.
 * Implementação inicial: detecção + campos básicos.
 */
export const danfossMapper: TechnicalMapper = {
  name: "danfoss",

  canHandle(input) {
    const hay = (
      (input.sourceFile ?? "") +
      " " +
      (input.sourceTable ?? "") +
      " " +
      JSON.stringify(input.raw ?? {})
    ).toLowerCase();
    return hay.includes("danfoss");
  },

  map(input: MapperInput): MapperResult {
    const r = input.raw as Record<string, unknown>;
    const errors: string[] = [];
    const warnings: string[] = [];

    const model = (r.model as string) ?? (r.Model as string) ?? null;
    if (!model) errors.push("Campo 'model' ausente.");

    // Heurística simples: tipo da entidade
    const text = JSON.stringify(r).toLowerCase();
    let entityType: MapperResult["entityType"] = "compressor";
    if (text.includes("valve") || text.includes("ets") || text.includes("tgex")) {
      entityType = "expansion_valve";
    } else if (text.includes("solenoid") || text.includes("evr")) {
      entityType = "solenoid_valve";
    }

    return {
      entityType,
      manufacturer: "Danfoss",
      model,
      code: model,
      normalized: {
        model,
        refrigerant: r.refrigerant ?? null,
        kv: r.kv ?? r.Kv ?? null,
        capacity: r.capacity ?? null,
        raw: r,
      },
      confidence: model ? 0.6 : 0.3,
      errors,
      warnings,
      mapperName: "danfoss",
    };
  },
};
