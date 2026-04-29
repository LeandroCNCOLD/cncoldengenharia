// Wrapper de alto nível: dado um geometryCode + condições operacionais,
// busca o bundle Unilab no banco, mescla com a geometria fornecida pela UI
// (dimensões, rows, circuitos) e roda o motor híbrido.
//
// Compatível com o fluxo antigo: se geometryCode não existir no catálogo,
// cai no fallback e marca isEstimated=true sem bloquear a simulação.

import { createServerFn } from '@tanstack/react-start';
import { simulateHybridCoil } from '../engines/hybridCoilEngine';
import type {
  CoilCalculationInput,
  CoilCalculationResult,
  GeometryInput,
} from '../engines/types';
import { getUnilabBundle } from './unilabRepository';

export interface SimulateWithUnilabInput {
  geometryCode?: string | null;
  geometryOverride: GeometryInput;
  base: Omit<CoilCalculationInput, 'geometry' | 'factors' | 'unilabSource'>;
}

export const simulateHybridCoilWithUnilab = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => data as SimulateWithUnilabInput)
  .handler(async ({ data }): Promise<CoilCalculationResult> => {
    const { geometryCode, geometryOverride, base } = data;
    const warnings: string[] = [];

    let mergedGeometry: GeometryInput = geometryOverride;
    let factors = undefined as CoilCalculationInput['factors'];
    let source: 'unilab' | 'partial' | 'fallback' = 'fallback';

    if (geometryCode) {
      const bundle = await getUnilabBundle({ data: { code: geometryCode } });
      warnings.push(...bundle.warnings);
      source = bundle.source;
      if (bundle.geometry) {
        // a UI ainda manda dimensões físicas (length/height/rows/circuits) —
        // apenas catálogo (passos, fin/tube type) vem do Unilab.
        mergedGeometry = {
          ...geometryOverride,
          code: bundle.geometry.geometryCode,
          finType: bundle.geometry.finType !== 'unknown'
            ? bundle.geometry.finType
            : geometryOverride.finType,
          tubeType: bundle.geometry.tubeType !== 'unknown'
            ? bundle.geometry.tubeType
            : geometryOverride.tubeType,
          tubeOuterDiameterMm:
            bundle.geometry.tubeOuterDiameterMm || geometryOverride.tubeOuterDiameterMm,
          tubeInnerDiameterMm:
            bundle.geometry.tubeInnerDiameterMm || geometryOverride.tubeInnerDiameterMm,
          tubePitchMm: bundle.geometry.tubePitchMm || geometryOverride.tubePitchMm,
          rowPitchMm: bundle.geometry.rowPitchMm || geometryOverride.rowPitchMm,
          finPitchMm: bundle.geometry.finPitchMm || geometryOverride.finPitchMm,
          finThicknessMm: bundle.geometry.finThicknessMm || geometryOverride.finThicknessMm,
        };
      }
      if (bundle.factors) {
        factors = {
          fatCorAl: bundle.factors.fatCorAl,
          fatCoeflattub: bundle.factors.fatCoeflattub,
          fatRidAumSup: bundle.factors.fatRidAumSup,
          fattoreAttrAria: bundle.factors.fattoreAttrAria,
          fattoreAttrAriaLatente: bundle.factors.fattoreAttrAriaLatente,
          fatCorrFatAttr: bundle.factors.fatCorrFatAttr,
          slopeFatCorAl: bundle.factors.slopeFatCorAl,
          slopeFatCoeflattub: bundle.factors.slopeFatCoeflattub,
          slopeFattoreAttrAria: bundle.factors.slopeFattoreAttrAria,
          securityFactor: bundle.factors.securityFactor,
        };
      }
    } else {
      warnings.push('geometryCode ausente — simulação roda sem catálogo Unilab.');
    }

    const result = simulateHybridCoil({
      ...base,
      geometry: mergedGeometry,
      factors,
      unilabSource: source,
    });

    return {
      ...result,
      warnings: [...warnings, ...result.warnings],
    };
  });
