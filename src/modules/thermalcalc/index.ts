/**
 * thermalcalc — Motor matemático oficial da CN COLD.
 *
 * Princípios:
 *  - Funções puras (sem React, sem Supabase, sem I/O).
 *  - Testável isoladamente.
 *  - Única fonte de verdade para qualquer cálculo de:
 *      geometria, área, volume, carga de fluido, capacidade térmica,
 *      coeficientes (h_air, h_ref, U), perda de carga, ciclo completo.
 *
 * Consumidores (ColdPro UI, server functions, performance map UI, etc.)
 * NÃO devem importar internals — sempre usar:
 *
 *   import { ... } from "@/modules/thermalcalc";
 *   import { ... } from "@/modules/thermalcalc/engines/coil";
 *   import { ... } from "@/modules/thermalcalc/engines/system";
 *   import type { ... } from "@/modules/thermalcalc/types";
 *
 * Camada de orquestração no ColdPro:
 *   @/modules/coldpro/adapters/thermalcalcAdapter
 */

export * as Coil from './engines/coil';
export * as System from './engines/system';
export * as Types from './types';
