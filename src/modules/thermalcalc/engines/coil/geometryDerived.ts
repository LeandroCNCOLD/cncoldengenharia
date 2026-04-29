/**
 * Cálculos geométricos derivados da bateria aletada.
 * Entrada: campos brutos (mm, contagens). Saída: áreas, volume, razões.
 *
 * Convenções:
 *  - tubeSpacingMm  = passo transversal (Pt) entre tubos na mesma fileira
 *  - rowSpacingMm   = passo longitudinal (Pl) entre fileiras
 *  - coilLengthMm   = comprimento útil do tubo dentro da bateria
 *  - finPitchMm     = distância centro-a-centro entre aletas
 */

import type { CoilGeometry } from "./coilSimulatorTypes";

export interface GeometryDerived {
  faceAreaM2: number | null;       // altura × largura útil
  finnedHeightM: number | null;
  finnedWidthM: number | null;
  externalAreaTubesM2: number | null;
  externalAreaFinsM2: number | null;
  externalAreaM2: number | null;   // total (lado do ar)
  internalAreaM2: number | null;   // lado refrigerante
  internalVolumeL: number | null;
  finRatio: number | null;         // A_aletas / A_tubos
  finsCount: number | null;
  totalTubes: number | null;
}

const PI = Math.PI;

export function deriveCoilGeometry(g: CoilGeometry): GeometryDerived {
  const tubesPerRow = g.tubesPerRow ?? null;
  const rows = g.rows ?? null;
  const Pt = g.tubeSpacingMm ? g.tubeSpacingMm / 1000 : null;
  const Pl = g.rowSpacingMm ? g.rowSpacingMm / 1000 : null;
  const L = g.coilLengthMm ? g.coilLengthMm / 1000 : null;
  const od = g.tubeOdMm ? g.tubeOdMm / 1000 : null;
  const id = g.tubeIdMm ? g.tubeIdMm / 1000 : null;
  const fp = g.finPitchMm ? g.finPitchMm / 1000 : null;
  const ft = g.finThicknessMm ? g.finThicknessMm / 1000 : 0.00012; // 0.12mm default

  const finnedHeightM = tubesPerRow && Pt ? tubesPerRow * Pt : null;
  const finnedWidthM = rows && Pl ? rows * Pl : null;
  const faceAreaM2 = finnedHeightM && L ? finnedHeightM * L : null;

  const totalTubes = tubesPerRow && rows
    ? tubesPerRow * rows - (g.skippedTubes ?? 0)
    : null;

  // Área externa dos tubos (sem desconto da área coberta pelas aletas — simplificação)
  const externalAreaTubesM2 = totalTubes && od && L
    ? totalTubes * PI * od * L
    : null;

  // Aletas: número e área (aleta plana, ambos os lados)
  let finsCount: number | null = null;
  let externalAreaFinsM2: number | null = null;
  if (L && fp && fp > 0) {
    finsCount = Math.floor(L / fp);
    if (finnedHeightM && finnedWidthM) {
      // área útil das aletas = 2 lados, descontando furos dos tubos
      const grossPerFin = finnedHeightM * finnedWidthM;
      const holeAreaPerFin = totalTubes && od ? totalTubes * (PI * od * od) / 4 : 0;
      externalAreaFinsM2 = 2 * finsCount * Math.max(grossPerFin - holeAreaPerFin, 0);
    }
  }

  const externalAreaM2 =
    externalAreaTubesM2 != null || externalAreaFinsM2 != null
      ? (externalAreaTubesM2 ?? 0) + (externalAreaFinsM2 ?? 0)
      : null;

  const internalAreaM2 = totalTubes && id && L
    ? totalTubes * PI * id * L
    : null;

  const internalVolumeL = totalTubes && id && L
    ? totalTubes * PI * (id * id) / 4 * L * 1000
    : null;

  const finRatio =
    externalAreaTubesM2 && externalAreaFinsM2 && externalAreaTubesM2 > 0
      ? externalAreaFinsM2 / externalAreaTubesM2
      : null;

  return {
    faceAreaM2,
    finnedHeightM,
    finnedWidthM,
    externalAreaTubesM2,
    externalAreaFinsM2,
    externalAreaM2,
    internalAreaM2,
    internalVolumeL,
    finRatio,
    finsCount,
    totalTubes,
  };
}
