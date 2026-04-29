import type { MapperInput, MapperResult, TechnicalMapper } from "../types";

/** torinMapper — ventiladores Torin / Torin-Sifan. */
export const torinMapper: TechnicalMapper = {
  name: "torin",

  canHandle(input) {
    const hay = (
      (input.sourceFile ?? "") +
      " " +
      (input.sourceTable ?? "") +
      " " +
      JSON.stringify(input.raw ?? {})
    ).toLowerCase();
    return hay.includes("torin");
  },

  map(input: MapperInput): MapperResult {
    const r = input.raw as Record<string, unknown>;
    const errors: string[] = [];
    const model = (r.model as string) ?? (r.Model as string) ?? null;
    if (!model) errors.push("Campo 'model' ausente.");

    return {
      entityType: "fan",
      manufacturer: "Torin",
      model,
      code: model,
      normalized: {
        model,
        diameter_mm: r.diameter_mm ?? null,
        rpm: r.rpm ?? null,
        nominal_airflow_m3h: r.nominal_airflow_m3h ?? r.airflow ?? null,
        nominal_pressure_pa: r.nominal_pressure_pa ?? r.pressure ?? null,
        nominal_power_w: r.nominal_power_w ?? r.power ?? null,
        raw: r,
      },
      confidence: model ? 0.65 : 0.3,
      errors,
      warnings: [],
      mapperName: "torin",
    };
  },
};
