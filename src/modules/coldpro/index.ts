/**
 * Fachada pública do módulo ColdPro.
 *
 * Imports recomendados a partir de novo código:
 *   import { CoilEngines, simulateSystem } from "@/modules/coldpro/engines";
 *   import { EvaporatorTab } from "@/modules/coldpro/components";
 *   import { listEquipmentProjects } from "@/modules/coldpro/services";
 *   import type { SystemResult } from "@/modules/coldpro/types";
 *   import { parseUnilabCsv } from "@/modules/coldpro/data";
 */

export * as Engines from "./engines";
export * as Components from "./components";
export * as Services from "./services";
export * as Data from "./data";
export * as Types from "./types";
export * as Screens from "./screens";
