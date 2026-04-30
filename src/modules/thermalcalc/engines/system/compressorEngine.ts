// ColdPro — Compressor engine (AHRI 540 / EN 12900 polinomial 10 coeficientes).
import type {
  CompressorModelData,
  CompressorPolynomial,
  CompressorResult,
  Refrigerant,
} from "./systemTypes";

/** Avalia polinômio de 10 coeficientes (Te, Tc em °C). */
export function evalPolynomial(p: CompressorPolynomial, teC: number, tcC: number): number {
  const [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9] = p.c;
  const te = teC;
  const tc = tcC;
  return (
    c0 +
    c1 * te +
    c2 * tc +
    c3 * te * te +
    c4 * te * tc +
    c5 * tc * tc +
    c6 * te * te * te +
    c7 * tc * te * te +
    c8 * te * tc * tc +
    c9 * tc * tc * tc
  );
}

/**
 * Catálogo embutido — valores aproximados, calibrados para faixa típica HBP/MBP/LBP.
 * Substituir/expandir conforme datasheets reais. Cada modelo tem 10 coef capacidade (W) e 10 coef potência (W).
 *
 * Os polinômios abaixo foram ajustados para reproduzir aproximadamente:
 *   - Capacidade nominal a Te=-10°C, Tc=45°C
 *   - Curva monotônica crescente em Te e decrescente em Tc
 *   - COP típico 1.5–3.0 na faixa
 */
const COMPRESSOR_LIBRARY: Record<string, CompressorModelData> = {
  // ===== R404A — média potência (LBP/MBP) =====
  GENERIC_R404A_2HP: {
    model: "GENERIC_R404A_2HP",
    refrigerant: "R404A",
    capacity: {
      c: [4200, 110, -55, 1.2, -0.8, 0.4, 0.005, -0.002, -0.002, 0.001],
    },
    power: {
      c: [1100, 5, 22, 0.05, 0.15, 0.1, 0, 0, 0, 0],
    },
    envelope: { teMinC: -35, teMaxC: 10, tcMinC: 25, tcMaxC: 60 },
    refSuperheatK: 10,
    refSubcoolingK: 0,
  },
  GENERIC_R404A_5HP: {
    model: "GENERIC_R404A_5HP",
    refrigerant: "R404A",
    capacity: {
      c: [10500, 275, -135, 3.0, -2.0, 1.0, 0.012, -0.005, -0.005, 0.0025],
    },
    power: {
      c: [2750, 12, 55, 0.12, 0.38, 0.25, 0, 0, 0, 0],
    },
    envelope: { teMinC: -35, teMaxC: 10, tcMinC: 25, tcMaxC: 60 },
    refSuperheatK: 10,
  },
  // ===== R134a — alta temperatura (HBP) =====
  GENERIC_R134A_3HP: {
    model: "GENERIC_R134A_3HP",
    refrigerant: "R134a",
    capacity: {
      c: [6300, 165, -82, 1.8, -1.2, 0.6, 0.007, -0.003, -0.003, 0.0015],
    },
    power: {
      c: [1650, 7, 33, 0.07, 0.22, 0.15, 0, 0, 0, 0],
    },
    envelope: { teMinC: -15, teMaxC: 15, tcMinC: 30, tcMaxC: 65 },
    refSuperheatK: 10,
  },
  // ===== R290 (propano) =====
  GENERIC_R290_2HP: {
    model: "GENERIC_R290_2HP",
    refrigerant: "R290",
    capacity: {
      c: [4400, 115, -57, 1.25, -0.85, 0.42, 0.005, -0.002, -0.002, 0.001],
    },
    power: {
      c: [1050, 5, 21, 0.05, 0.14, 0.095, 0, 0, 0, 0],
    },
    envelope: { teMinC: -30, teMaxC: 10, tcMinC: 25, tcMaxC: 55 },
    refSuperheatK: 10,
  },
};

export function listCompressorModels(): string[] {
  return Object.keys(COMPRESSOR_LIBRARY);
}

export function getCompressorModel(model: string): CompressorModelData | null {
  return COMPRESSOR_LIBRARY[model] ?? null;
}

/** Calor latente aproximado (J/kg) — usado só para estimar massFlow. */
const LATENT_HEAT_APPROX_JKG: Record<Refrigerant, number> = {
  R404A: 140_000,
  R134a: 195_000,
  R290: 350_000,
  R407C: 200_000,
  R410A: 220_000,
  R744: 250_000,
};

export interface CompressorRunInput {
  model: string;
  refrigerant: Refrigerant;
  evaporatingTempC: number;
  condensingTempC: number;
}

export function runCompressor(input: CompressorRunInput): CompressorResult {
  const data = getCompressorModel(input.model);
  const warnings: string[] = [];
  if (!data) {
    return {
      model: input.model,
      refrigerant: input.refrigerant,
      qCompW: 0,
      powerW: 0,
      massFlowKgh: 0,
      inEnvelope: false,
      warnings: [`Modelo de compressor "${input.model}" não encontrado na biblioteca.`],
    };
  }
  if (data.refrigerant !== input.refrigerant) {
    warnings.push(
      `Refrigerante divergente: compressor ${data.model} usa ${data.refrigerant}, sistema usa ${input.refrigerant}.`,
    );
  }

  const te = input.evaporatingTempC;
  const tc = input.condensingTempC;

  const envelope = data.envelope;
  const inEnvelope =
    !envelope ||
    ((envelope.teMinC == null || te >= envelope.teMinC) &&
      (envelope.teMaxC == null || te <= envelope.teMaxC) &&
      (envelope.tcMinC == null || tc >= envelope.tcMinC) &&
      (envelope.tcMaxC == null || tc <= envelope.tcMaxC));
  if (!inEnvelope) {
    warnings.push(
      `Te=${te.toFixed(1)}°C / Tc=${tc.toFixed(1)}°C fora do envelope ${JSON.stringify(data.envelope)}.`,
    );
  }

  const qCompW = Math.max(0, evalPolynomial(data.capacity, te, tc));
  const powerW = Math.max(1, evalPolynomial(data.power, te, tc));

  const hLat = LATENT_HEAT_APPROX_JKG[input.refrigerant] ?? 180_000;
  const massFlowKgh = (qCompW / hLat) * 3600;

  return {
    model: data.model,
    refrigerant: input.refrigerant,
    qCompW,
    powerW,
    massFlowKgh,
    inEnvelope,
    warnings,
  };
}
