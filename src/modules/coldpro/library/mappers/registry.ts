import type { TechnicalMapper } from "../types";
import { bitzerMapper } from "./bitzerMapper";
import { danfossMapper } from "./danfossMapper";
import { torinMapper } from "./torinMapper";
import { unilabMapper } from "./unilabMapper";
import { vapcycMapper } from "./vapcycMapper";
import { fanMapper } from "./fanMapper";
import { valveMapper } from "./valveMapper";

/**
 * Ordem importa: o universalMapper percorre a lista e usa o primeiro
 * `canHandle()` que retornar true. Coloque mappers mais específicos antes
 * dos mais genéricos.
 */
export const MAPPER_REGISTRY: TechnicalMapper[] = [
  bitzerMapper,
  danfossMapper,
  torinMapper,
  unilabMapper,
  vapcycMapper,
  fanMapper,
  valveMapper,
];
