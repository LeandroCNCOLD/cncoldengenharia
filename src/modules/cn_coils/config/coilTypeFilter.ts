// Mapeia o tipo de componente do workspace CN Coils para o filtro de
// tipo_serpentina (pt-BR) usado no catálogo de geometrias.

import type { CnCoilsComponentType } from "../types/cncoils.types";
import type { TipoSerpentina } from "../services/coilGeometryCatalogService";

export function tipoSerpentinaForComponent(
  t: CnCoilsComponentType,
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
