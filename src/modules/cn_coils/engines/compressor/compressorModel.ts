import type { RefrigerantSatProps } from "../refrigerant/refrigerantProperties";
import { getRefrigerantSatProps } from "../refrigerant/refrigerantProperties";

export type CompressorModelType =
  | "ari540"
  | "bitzer_native"
  | "constant_efficiency";

export interface ARI540Coefficients {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
  c7: number;
  c8: number;
  c9: number;
  c10: number;
  shRef: number;
  scRef: number;
  tcRef: number;
  teRef: number;
}

export type ARI540PowerCoefficients = {
  [K in `p${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`]: number;
};

export interface BitzerNativeCoefficients {
  displacement_m3h: number;
  coeff_lambda: [number, number, number];
  coeff_current: [number, number, number];
  coeff_specific_power: [number, number, number];
  rpm: number;
}

export interface ConstantEfficiencyCoefficients {
  eta_vol: number;
  eta_is: number;
  displacement_m3h: number;
}

export interface CompressorRecord {
  id: string;
  model: string;
  manufacturer: string;
  refrigerant: string;
  modelType: CompressorModelType;
  ari540?: ARI540Coefficients;
  ari540Power?: ARI540PowerCoefficients;
  bitzerNative?: BitzerNativeCoefficients;
  constantEfficiency?: ConstantEfficiencyCoefficients;
}

export interface CompressorInputs {
  Te_C: number;
  Tc_C: number;
  superheat_K: number;
  subcooling_K: number;
  refrigerantId: string;
}

export interface CompressorResult {
  Q_evap_W: number;
  W_comp_W: number;
  Q_cond_W: number;
  m_dot_kgS: number;
  COP: number;
  compressionRatio: number;
  mode: CompressorModelType;
  warnings: string[];
}

function eval10(coeffs: number[], Te_C: number, Tc_C: number): number {
  const [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10] = coeffs;
  return (
    c1 +
    c2 * Te_C +
    c3 * Tc_C +
    c4 * Te_C * Te_C +
    c5 * Te_C * Tc_C +
    c6 * Tc_C * Tc_C +
    c7 * Te_C * Te_C * Te_C +
    c8 * Tc_C * Te_C * Te_C +
    c9 * Te_C * Tc_C * Tc_C +
    c10 * Tc_C * Tc_C * Tc_C
  );
}

function compressionRatio(satProps: {
  evap: RefrigerantSatProps;
  cond: RefrigerantSatProps;
}): number {
  return satProps.evap.P_kPa > 0
    ? satProps.cond.P_kPa / satProps.evap.P_kPa
    : 0;
}

function massFlowFromCapacity(
  Q_W: number,
  satProps: { evap: RefrigerantSatProps },
): number {
  const h_fg_Jkg = (satProps.evap.h_g_kJkg - satProps.evap.h_f_kJkg) * 1000;
  return h_fg_Jkg > 0 ? Q_W / h_fg_Jkg : 0;
}

function evaluateARI540(
  inputs: CompressorInputs,
  coeffs: ARI540Coefficients,
  satProps: { evap: RefrigerantSatProps; cond: RefrigerantSatProps },
  powerCoeffs?: ARI540PowerCoefficients,
): CompressorResult {
  const warnings: string[] = [];
  const { Te_C, Tc_C } = inputs;
  const Q_W =
    eval10(
      [
        coeffs.c1,
        coeffs.c2,
        coeffs.c3,
        coeffs.c4,
        coeffs.c5,
        coeffs.c6,
        coeffs.c7,
        coeffs.c8,
        coeffs.c9,
        coeffs.c10,
      ],
      Te_C,
      Tc_C,
    ) * 1000;

  if (Q_W <= 0) {
    warnings.push(
      "ARI 540: Q_evap calculado <= 0 — verifique Te/Tc fora da faixa dos coeficientes",
    );
  }

  let W_comp_W = 0;
  if (powerCoeffs) {
    W_comp_W =
      eval10(
        [
          powerCoeffs.p1,
          powerCoeffs.p2,
          powerCoeffs.p3,
          powerCoeffs.p4,
          powerCoeffs.p5,
          powerCoeffs.p6,
          powerCoeffs.p7,
          powerCoeffs.p8,
          powerCoeffs.p9,
          powerCoeffs.p10,
        ],
        Te_C,
        Tc_C,
      ) * 1000;
  } else {
    warnings.push("ARI 540 sem coeficientes de potência — W_comp não calculado.");
  }

  const m_dot_kgS = massFlowFromCapacity(Math.max(Q_W, 0), satProps);
  const Q_cond_W = Q_W + W_comp_W;

  return {
    Q_evap_W: Q_W,
    W_comp_W,
    Q_cond_W,
    m_dot_kgS,
    COP: W_comp_W > 0 ? Q_W / W_comp_W : 0,
    compressionRatio: compressionRatio(satProps),
    mode: "ari540",
    warnings,
  };
}

function evaluateBitzerNative(
  inputs: CompressorInputs,
  coeffs: BitzerNativeCoefficients,
  satProps: { evap: RefrigerantSatProps; cond: RefrigerantSatProps },
): CompressorResult {
  const warnings: string[] = [];
  const { Te_C, Tc_C } = inputs;

  const eta_vol =
    coeffs.coeff_lambda[0] +
    coeffs.coeff_lambda[1] * Te_C +
    coeffs.coeff_lambda[2] * Te_C * Te_C;

  if (eta_vol <= 0 || eta_vol > 1.2) {
    warnings.push(
      `Bitzer: eta_vol = ${eta_vol.toFixed(3)} fora da faixa esperada (0-1.2) para Te=${Te_C}°C`,
    );
  }

  const rho_vapor = satProps.evap.vapor.rho_kgm3;
  const m_dot_kgS =
    (coeffs.displacement_m3h * Math.max(eta_vol, 0) * rho_vapor) / 3600;
  const h_fg_Jkg = (satProps.evap.h_g_kJkg - satProps.evap.h_f_kJkg) * 1000;
  const Q_evap_W = m_dot_kgS * h_fg_Jkg;

  const w_sp =
    coeffs.coeff_specific_power[0] +
    coeffs.coeff_specific_power[1] * Tc_C +
    coeffs.coeff_specific_power[2] * Tc_C * Tc_C;

  if (w_sp <= 1) {
    warnings.push(
      `Bitzer: índice de desempenho específico = ${w_sp.toFixed(3)} fora da faixa esperada (>1).`,
    );
  }

  const W_comp_W = Q_evap_W / Math.max(w_sp, 0.1);
  const Q_cond_W = Q_evap_W + W_comp_W;

  return {
    Q_evap_W,
    W_comp_W,
    Q_cond_W,
    m_dot_kgS,
    COP: W_comp_W > 0 ? Q_evap_W / W_comp_W : 0,
    compressionRatio: compressionRatio(satProps),
    mode: "bitzer_native",
    warnings,
  };
}

function evaluateConstantEfficiency(
  _inputs: CompressorInputs,
  coeffs: ConstantEfficiencyCoefficients,
  satProps: { evap: RefrigerantSatProps; cond: RefrigerantSatProps },
): CompressorResult {
  const warnings: string[] = [
    `Usando eficiências constantes (eta_vol=${coeffs.eta_vol}, eta_is=${coeffs.eta_is}). Para maior precisão, forneça coeficientes ARI 540 ou Bitzer Nativo.`,
  ];

  const rho_vapor = satProps.evap.vapor.rho_kgm3;
  const m_dot_kgS = (coeffs.displacement_m3h * coeffs.eta_vol * rho_vapor) / 3600;
  const h_fg_Jkg = (satProps.evap.h_g_kJkg - satProps.evap.h_f_kJkg) * 1000;
  const Q_evap_W = m_dot_kgS * h_fg_Jkg;
  const ratio = compressionRatio(satProps) || 1;
  const gamma = 1.15;
  // CORREÇÃO: trabalho isentrópico para gás ideal.
  // Antes: h_is = h_g × ratio^((gamma-1)/gamma) — mistura entalpia com temperatura (ERRADO, erro de 57%).
  // Correto: w_is = cp × T1 × (ratio^((gamma-1)/gamma) - 1)  [J/kg]
  // onde T1 = temperatura de sucção [K] e cp = calor específico do vapor.
  // Referência: Incropera 7ª ed., Eq. 9.28; ASHRAE Fundamentals 2017, Cap. 2.
  const cp_vapor_Jkg = satProps.evap.vapor.cp_kJkgK * 1000; // J/(kg·K)
  const T1_K = satProps.evap.T_C + 273.15; // temperatura de saturação (sucção)
  const w_is_Jkg = cp_vapor_Jkg * T1_K * (Math.pow(ratio, (gamma - 1) / gamma) - 1);
  const W_is_W = m_dot_kgS * w_is_Jkg;
  const W_comp_W = coeffs.eta_is > 0 ? W_is_W / coeffs.eta_is : W_is_W;

  return {
    Q_evap_W,
    W_comp_W,
    Q_cond_W: Q_evap_W + W_comp_W,
    m_dot_kgS,
    COP: W_comp_W > 0 ? Q_evap_W / W_comp_W : 0,
    compressionRatio: ratio,
    mode: "constant_efficiency",
    warnings,
  };
}

export async function evaluateCompressor(
  inputs: CompressorInputs,
  compressor: CompressorRecord,
): Promise<CompressorResult> {
  const { Te_C, Tc_C, refrigerantId } = inputs;
  const warnings: string[] = [];

  if (Te_C >= Tc_C) {
    return {
      Q_evap_W: 0,
      W_comp_W: 0,
      Q_cond_W: 0,
      m_dot_kgS: 0,
      COP: 0,
      compressionRatio: 0,
      mode: compressor.modelType,
      warnings: [`Te (${Te_C}°C) deve ser menor que Tc (${Tc_C}°C)`],
    };
  }

  const [evapProps, condProps] = await Promise.all([
    getRefrigerantSatProps(refrigerantId, Te_C),
    getRefrigerantSatProps(refrigerantId, Tc_C),
  ]);
  warnings.push(...evapProps.warnings, ...condProps.warnings);
  const satProps = { evap: evapProps, cond: condProps };

  if (compressor.ari540) {
    const result = evaluateARI540(inputs, compressor.ari540, satProps, compressor.ari540Power);
    return { ...result, warnings: [...warnings, ...result.warnings] };
  }

  if (compressor.bitzerNative) {
    const result = evaluateBitzerNative(inputs, compressor.bitzerNative, satProps);
    return { ...result, warnings: [...warnings, ...result.warnings] };
  }

  if (compressor.constantEfficiency) {
    const result = evaluateConstantEfficiency(inputs, compressor.constantEfficiency, satProps);
    return { ...result, warnings: [...warnings, ...result.warnings] };
  }

  return {
    Q_evap_W: 0,
    W_comp_W: 0,
    Q_cond_W: 0,
    m_dot_kgS: 0,
    COP: 0,
    compressionRatio: 0,
    mode: "constant_efficiency",
    warnings: [
      ...warnings,
      "Nenhum modelo de compressor disponível. Forneça coeficientes ARI 540, Bitzer Nativo ou eficiências constantes.",
    ],
  };
}
