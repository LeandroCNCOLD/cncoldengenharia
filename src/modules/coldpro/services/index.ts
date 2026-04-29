/**
 * Services — integração com Supabase / server functions.
 * Toda chamada de rede / persistência ColdPro deve passar por aqui.
 */

// CRUD / queries (cliente Supabase)
export * from "@/lib/coldpro/coil-calibrations";
export * from "@/lib/coldpro/coil-performance-maps";
export * from "@/lib/coldpro/coil-row-mapper";
export * from "@/lib/coldpro/coil-simulations";
export * from "@/lib/coldpro/component-items";
export * from "@/lib/coldpro/equipment-projects";
export * from "@/lib/coldpro/labels";
export * from "@/lib/coldpro/unilab-import";

// Server functions (createServerFn) — invocáveis a partir de componentes
export * as ColdproImport from "@/server/coldproImport.functions";
export * as ColdproMappers from "@/server/coldproMappers.functions";
export * as VapcycServices from "@/server/vapcyc.functions";
