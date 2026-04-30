/**
 * Adapter para simulação de compressor a partir de um `TechnicalComponent`
 * da Biblioteca Técnica.
 *
 * Estratégia (fallback automático):
 *   1. Tenta `vapcycCompressorEngine` (polinômios AHRI 540 da tabela
 *      `compressor_polynomials` ligada ao `compressor_models` referenciado
 *      pelo componente).
 *   2. Se não houver curva VAPCYC, tenta `compressorEngine` clássico
 *      apenas quando houver uma chave de catálogo ARI explícita.
 *   3. Se nada existir, retorna alerta "sem dados de performance".
 *
 * Não faz cálculo no React — toda matemática vem do `thermalcalc`.
 */
import type { TechnicalComponent } from "@/modules/coldpro/library/types";
import {
  evaluateCompressor,
  type SimulateCompressorResult,
} from "@/modules/thermalcalc/engines/system/vapcycCompressorEngine";
import {
  runCompressor,
  type CompressorRunInput,
} from "@/modules/thermalcalc/engines/system/compressorEngine";
import type {
  CompressorResult,
  Refrigerant,
} from "@/modules/thermalcalc/engines/system/systemTypes";
import { resolveCompressorComponent } from "@/modules/coldpro/biblioteca/technicalComponentResolver";

export interface CompressorSimulationInput {
  component: TechnicalComponent;
  evaporatingTempC: number;
  condensingTempC: number;
}

export type CompressorSimulationOutput =
  | {
      kind: "vapcyc";
      result: SimulateCompressorResult;
      warnings: string[];
    }
  | {
      kind: "ari";
      result: CompressorResult;
      warnings: string[];
    }
  | {
      kind: "no_data";
      warnings: string[];
    };

function tryAriFromNormalized(
  component: TechnicalComponent,
  evaporatingTempC: number,
  condensingTempC: number,
): { ok: true; result: CompressorResult } | { ok: false; reason: string } {
  const norm = component.normalized_json ?? {};
  const ariModelKey = (norm["ari_model"] ?? norm["library_model"]) as string | undefined;
  const refrigerant = (component.compatible_refrigerants_json?.[0] ??
    (norm["refrigerant"] as string | undefined)) as Refrigerant | undefined;
  if (!ariModelKey || !refrigerant) {
    return { ok: false, reason: "Sem chave de catálogo ARI ou refrigerante." };
  }
  const input: CompressorRunInput = {
    model: ariModelKey,
    refrigerant,
    evaporatingTempC,
    condensingTempC,
  };
  const result = runCompressor(input);
  if (result.qCompW <= 0 && result.warnings.some((w) => w.includes("não encontrado"))) {
    return { ok: false, reason: result.warnings[0] };
  }
  return { ok: true, result };
}

export async function simulateLibraryCompressor(
  input: CompressorSimulationInput,
): Promise<CompressorSimulationOutput> {
  const { component, evaporatingTempC, condensingTempC } = input;
  const warnings: string[] = [];

  // 1) VAPCYC
  const resolved = await resolveCompressorComponent(component.id);
  warnings.push(...resolved.warnings);
  if (resolved.data) {
    const { vapcycModel, vapcycPolynomials } = resolved.data.thermalcalc;
    if (resolved.data.hasCapacityPolynomial && resolved.data.hasPowerPolynomial) {
      const result = evaluateCompressor(
        vapcycModel,
        vapcycPolynomials,
        evaporatingTempC,
        condensingTempC,
      );
      return { kind: "vapcyc", result, warnings: [...warnings, ...result.warnings] };
    }
  } else {
    warnings.push("Compressor não resolvido nas tabelas técnicas.");
  }

  // 2) ARI clássico (catálogo embutido)
  const ari = tryAriFromNormalized(component, evaporatingTempC, condensingTempC);
  if (ari.ok) {
    return { kind: "ari", result: ari.result, warnings };
  }
  warnings.push(ari.reason);

  // 3) sem dados
  warnings.push(
    "Sem dados de performance: o componente selecionado não possui polinômios VAPCYC completos nem chave de catálogo ARI.",
  );
  return { kind: "no_data", warnings };
}
