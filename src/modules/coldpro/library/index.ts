/**
 * Biblioteca Técnica Universal — entrypoint público.
 *
 * Use este módulo (ou o adapter thermalcalc) ao invés de importar diretamente
 * tabelas brutas (`unilab_raw_tables`, `coil_geometry_factors`...) ou os
 * importadores legados.
 */

export * from "./types";
export * from "./mappers/universalMapper";
export * from "./mappers/registry";
