import type { MapperInput, MapperResult, TechnicalMapper } from "../types";

/**
 * bitzerMapper — mapeia planilhas/exports BITZER e BITZER/SW.
 *
 * IMPLEMENTAÇÃO INICIAL: detecção + extração mínima. Expandir com
 * polinômios e envelope conforme amostras reais forem importadas.
 */
export const bitzerMapper: TechnicalMapper = {
  name: "bitzer",

  canHandle(input) {
    const hay = (
      (input.sourceFile ?? "") +
      " " +
      (input.sourceTable ?? "") +
      " " +
      JSON.stringify(input.raw ?? {})
    ).toLowerCase();
    return hay.includes("bitzer") || hay.includes("/sw");
  },

  map(input: MapperInput): MapperResult {
    const r = input.raw as Record<string, unknown>;
    const errors: string[] = [];
    const warnings: string[] = [];

    const model =
      (r.model as string) ?? (r.Model as string) ?? (r.modello as string) ?? null;
    if (!model) errors.push("Campo 'model' ausente.");

    const refrigerant =
      (r.refrigerant as string) ?? (r.Refrigerant as string) ?? null;
    if (!refrigerant) warnings.push("Refrigerante não identificado.");

    return {
      entityType: "compressor",
      manufacturer: "BITZER",
      model,
      code: model,
      normalized: {
        model,
        refrigerant,
        compressor_type: r.compressor_type ?? r.Type ?? null,
        displacement: r.displacement ?? r.Displacement ?? null,
        voltage: r.voltage ?? null,
        frequency: r.frequency ?? null,
        rpm: r.rpm ?? null,
        temp_evap_min_c: r.temp_evap_min_c ?? null,
        temp_evap_max_c: r.temp_evap_max_c ?? null,
        temp_cond_min_c: r.temp_cond_min_c ?? null,
        temp_cond_max_c: r.temp_cond_max_c ?? null,
        raw: r,
      },
      confidence: model ? 0.7 : 0.3,
      errors,
      warnings,
      mapperName: "bitzer",
    };
  },
};
