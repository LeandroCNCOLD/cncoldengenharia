// Mapeia o tipo de componente do workspace UNILAB para o filtro de
// tipo_serpentina (pt-BR) usado no catálogo de geometrias.

import type { UnilabComponentType } from "../types/unilab.types";
import type { TipoSerpentina } from "../services/coilGeometryCatalogService";

export function tipoSerpentinaForComponent(
  t: UnilabComponentType,
): TipoSerpentina | undefined {
  switch (t) {
    case "condenser_air":
    case "condenser_shell_tube":
      return "Condensação";
    case "evaporator_dx":
      return "Expansão Direta";
    case "evaporator_pumped":
      return "Evaporador Bomba";
    case "cooling_coil":
      return "Resfriamento";
    case "heating_coil":
      return "Aquecimento";
    case "defrost_steam_coil":
      return "Vapor";
    default:
      return undefined;
  }
}
