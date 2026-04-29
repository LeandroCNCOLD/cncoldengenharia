import { parseCsv } from './csv';
import { mapUnilabGeometryRow } from './unilabGeometryFactorMapper';
import type { UnilabCalculationMode, UnilabGeometryFactor } from './types';

export type UnilabCsvFile = {
  filename: string;
  text: string;
};

const MODE_BY_FILENAME: Array<[RegExp, UnilabCalculationMode]> = [
  [/GeometrieEspansioneDiretta/i, 'direct_expansion'],
  [/GeometrieCondensazione/i, 'condensing'],
  [/GeometrieRaffreddamento/i, 'cooling'],
  [/GeometrieRiscaldamento/i, 'heating'],
  [/GeometrieEvaporatoriaPompa/i, 'pump_evaporator'],
  [/GeometrieVapore/i, 'steam'],
];

export function detectModeFromFilename(filename: string): UnilabCalculationMode | null {
  return MODE_BY_FILENAME.find(([re]) => re.test(filename))?.[1] ?? null;
}

export function importUnilabGeometryFactors(files: UnilabCsvFile[]): UnilabGeometryFactor[] {
  const factors: UnilabGeometryFactor[] = [];
  for (const file of files) {
    const mode = detectModeFromFilename(file.filename);
    if (!mode) continue;
    const sourceTable = file.filename.split('/').pop()?.replace(/\.csv$/i, '') || file.filename;
    const rows = parseCsv(file.text);
    for (const row of rows) {
      const factor = mapUnilabGeometryRow(row, mode, sourceTable);
      if (factor.geometryCode || factor.sigla || factor.description) factors.push(factor);
    }
  }
  return factors;
}
