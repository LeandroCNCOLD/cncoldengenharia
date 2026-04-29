import type { MapperInput, MapperResult, TechnicalMapper } from "../types";

/**
 * fanMapper — fallback genérico para ventiladores (CSV/Excel sem fabricante
 * conhecido). É registrado depois dos mappers de fabricante específicos.
 */
export const fanMapper: TechnicalMapper = {
  name: "fan-generic",

  canHandle(input) {
    const hay = (
      (input.sourceFile ?? "") +
      " " +
      (input.sourceTable ?? "")
    ).toLowerCase();
    return hay.includes("fan") || hay.includes("vent");
  },

  map(input: MapperInput): MapperResult {
    const r = input.raw as Record<string, unknown>;
    const model = (r.model as string) ?? null;

    return {
      entityType: "fan",
      manufacturer: (r.manufacturer as string) ?? null,
      model,
      code: model,
      normalized: {
        model,
        diameter_mm: r.diameter_mm ?? null,
        nominal_airflow_m3h: r.nominal_airflow_m3h ?? null,
        nominal_pressure_pa: r.nominal_pressure_pa ?? null,
        nominal_power_w: r.nominal_power_w ?? null,
        raw: r,
      },
      confidence: model ? 0.5 : 0.2,
      errors: model ? [] : ["Modelo de ventilador ausente."],
      warnings: ["Mapeado por fan-generic — verifique fabricante manualmente."],
      mapperName: "fan-generic",
    };
  },
};
