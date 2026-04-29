import type { MapperInput, MapperResult, TechnicalEntityType, TechnicalMapper } from "../types";

/** valveMapper — fallback genérico para válvulas (expansão, solenoide, hot gas). */
export const valveMapper: TechnicalMapper = {
  name: "valve-generic",

  canHandle(input) {
    const hay = (
      (input.sourceFile ?? "") +
      " " +
      (input.sourceTable ?? "")
    ).toLowerCase();
    return hay.includes("valve") || hay.includes("valv");
  },

  map(input: MapperInput): MapperResult {
    const r = input.raw as Record<string, unknown>;
    const text = JSON.stringify(r).toLowerCase();

    let entityType: TechnicalEntityType = "expansion_valve";
    if (text.includes("solenoid")) entityType = "solenoid_valve";
    else if (text.includes("hot gas") || text.includes("hotgas") || text.includes("hot_gas"))
      entityType = "hot_gas_valve";

    const model = (r.model as string) ?? null;
    return {
      entityType,
      manufacturer: (r.manufacturer as string) ?? null,
      model,
      code: model,
      normalized: {
        model,
        refrigerant: r.refrigerant ?? null,
        kv: r.kv ?? null,
        capacity: r.capacity ?? null,
        pressure_min: r.pressure_min ?? null,
        pressure_max: r.pressure_max ?? null,
        temperature_min: r.temperature_min ?? null,
        temperature_max: r.temperature_max ?? null,
        application: r.application ?? null,
        raw: r,
      },
      confidence: model ? 0.5 : 0.2,
      errors: model ? [] : ["Modelo de válvula ausente."],
      warnings: ["Mapeado por valve-generic — verifique fabricante manualmente."],
      mapperName: "valve-generic",
    };
  },
};
