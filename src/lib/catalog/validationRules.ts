import {
  CatalogValidationError,
  type CompressorCatalogItem,
  type HeatExchangerCatalogItem,
} from "./types";

function log(scope: string, msg: string, ctx?: Record<string, unknown>) {
  // Log técnico estruturado.
  console.warn(`[catalog:${scope}] ${msg}`, ctx ?? {});
}

export function validateHeatExchanger(item: HeatExchangerCatalogItem): void {
  const errors: string[] = [];

  if (!(item.nominalCapacityW > 0)) errors.push("nominalCapacityW deve ser > 0");
  if (!(item.nominalDeltaT > 0)) errors.push("nominalDeltaT deve ser > 0");
  if (!(item.airFlowM3h > 0)) errors.push("airFlowM3h deve ser > 0");
  if (!(item.exchangeAreaM2 > 0)) errors.push("exchangeAreaM2 deve ser > 0");

  if (item.type === "evaporator") {
    // Ar entra mais quente que a temperatura de evaporação.
    if (!(item.nominalAirInletTempC > item.nominalExchangeTempC)) {
      errors.push(
        `evaporador: Tar (${item.nominalAirInletTempC}) deve ser > Tevap (${item.nominalExchangeTempC})`,
      );
    }
  } else {
    // Condensação ocorre acima da temperatura do ar.
    if (!(item.nominalExchangeTempC > item.nominalAirInletTempC)) {
      errors.push(
        `condensador: Tcond (${item.nominalExchangeTempC}) deve ser > Tar (${item.nominalAirInletTempC})`,
      );
    }
  }

  if (errors.length) {
    log("heat-exchanger", `Falha em ${item.model}`, { errors });
    throw new CatalogValidationError(
      `Validação falhou para ${item.type} ${item.model}: ${errors.join("; ")}`,
      { item, errors },
    );
  }
}

export function validateCompressor(item: CompressorCatalogItem): void {
  const errors: string[] = [];
  if (item.polynomialCoefficients.length !== 10) {
    errors.push(
      `coeficientes incompletos: esperado 10, recebido ${item.polynomialCoefficients.length}`,
    );
  }
  if (item.polynomialCoefficients.some((c) => Number.isNaN(c) || !Number.isFinite(c))) {
    errors.push("coeficientes contêm NaN ou Infinity");
  }
  if (!item.refrigerant) errors.push("refrigerant ausente");
  if (!item.model) errors.push("model ausente");

  if (errors.length) {
    log("compressor", `Falha em ${item.model}`, { errors });
    throw new CatalogValidationError(
      `Validação falhou para compressor ${item.model}: ${errors.join("; ")}`,
      { item, errors },
    );
  }
}
