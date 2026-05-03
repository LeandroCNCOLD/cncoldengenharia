export type FinType = "plain" | "wavy" | "louver";

export interface CoilGeometryInput {
  finType: FinType;
  D_o: number;       // Diâmetro externo do tubo [m]
  P_t: number;       // Passo transversal [m]
  P_l: number;       // Passo longitudinal [m]
  F_p: number;       // Passo das aletas [m]
  N: number;         // Número de filas
  V_face: number;    // Velocidade de face [m/s]
  T_air_C: number;   // Temperatura média do ar [°C]
  Re?: number;        // Override para testes/validação de faixa
  Pr?: number;        // Override para testes/validação de faixa
  L_fin?: number;    // Comprimento da aleta [m]
  L_p?: number;      // Passo do louver [m] — obrigatório para louver
  theta_L?: number;  // Ângulo do louver [°] — obrigatório para louver
  A_w?: number;      // Amplitude da ondulação [m] — obrigatório para wavy
}

export interface CorrelationResult {
  j: number;
  f: number;
  h_air_W_m2K: number;
  Re_Dc: number;
  correlation: string;
  outOfRange?: string;
}

// Propriedades do ar por temperatura (ASHRAE 2021)
// Colunas: [T_°C, rho, mu×1e6, cp, k×1e3, Pr]
const AIR_TABLE: number[][] = [
  [-40,1.514,15.7,1005,21.9,0.728],[-30,1.452,16.2,1005,22.7,0.720],
  [-20,1.394,16.7,1005,23.4,0.716],[-10,1.341,17.2,1005,24.1,0.712],
  [0,1.293,17.7,1005,24.8,0.711],[10,1.247,18.2,1005,25.5,0.712],
  [20,1.204,18.6,1005,26.2,0.713],[25,1.184,18.8,1005,26.5,0.713],
  [30,1.165,19.1,1005,26.8,0.714],[40,1.127,19.5,1006,27.5,0.716],
  [50,1.093,19.9,1007,28.2,0.718],
];

function interpAir(T: number, col: number): number {
  const t = AIR_TABLE;
  if (T <= t[0][0]) return t[0][col];
  if (T >= t[t.length-1][0]) return t[t.length-1][col];
  for (let i = 0; i < t.length-1; i++) {
    if (T >= t[i][0] && T <= t[i+1][0]) {
      const f = (T - t[i][0]) / (t[i+1][0] - t[i][0]);
      return t[i][col] + f * (t[i+1][col] - t[i][col]);
    }
  }
  return t[t.length-1][col];
}

function getAir(T: number) {
  return {
    rho: interpAir(T,1), mu: interpAir(T,2)*1e-6,
    cp:  interpAir(T,3), k:  interpAir(T,4)*1e-3, Pr: interpAir(T,5),
  };
}

function reynoldsWarning(Re: number): string | undefined {
  if (Re < 100 || Re > 15000) {
    return `Re=${Re.toFixed(0)} muito fora da faixa — resultado extrapolado`;
  }
  if (Re > 10000) {
    return `Re=${Re.toFixed(0)} acima de 10000 — extrapolação moderada`;
  }
  return undefined;
}

function gnielinskiNu(Re: number, Pr: number): number {
  const f = Math.pow(0.790 * Math.log(Re) - 1.64, -2);
  return (
    ((f / 8) * (Re - 1000) * Pr) /
    (1 + 12.7 * Math.sqrt(f / 8) * (Math.pow(Pr, 2 / 3) - 1))
  );
}

// Wang-Chi-Chang 2000 — aletas PLANAS
// Int. J. Heat Mass Transfer 43(15):2693–2700
function plain(input: CoilGeometryInput): CorrelationResult {
  const air = getAir(input.T_air_C);
  const Pr = input.Pr ?? air.Pr;
  const sigma = 1 - input.D_o / input.P_t;
  const V_max = input.V_face / sigma;
  const Re = input.Re ?? (air.rho * V_max * input.D_o) / air.mu;

  if (Re < 300) {
    const Nu = 3.66;
    const h = (Nu * air.k) / input.D_o;
    const j = (h / (air.rho * V_max * air.cp)) * Math.pow(Pr, 2 / 3);
    const rangeWarning = reynoldsWarning(Re);
    const laminarWarning = `Re=${Re.toFixed(0)} em regime laminar — usando Nu=3.66`;
    return {
      j,
      f: 0,
      h_air_W_m2K: h,
      Re_Dc: Re,
      correlation: "Laminar-Nu-3.66-fallback",
      outOfRange: rangeWarning ? `${rangeWarning}; ${laminarWarning}` : laminarWarning,
    };
  }

  const j = 0.394 * Math.pow(Re,-0.392) * Math.pow(input.F_p/input.D_o,0.798)
    * Math.pow(input.P_t/input.P_l,-0.198) * Math.pow(input.N,-0.290) * Math.pow(input.P_l/input.D_o,-0.0978);
  const f = 0.764 * Math.pow(Re,-0.739) * Math.pow(input.F_p/input.D_o,-0.177)
    * Math.pow(input.P_t/input.P_l,0.058) * Math.pow(input.N,0.965) * Math.pow(input.P_l/input.D_o,0.708);
  let h = (j * air.rho * V_max * air.cp) / Math.pow(Pr, 2/3);
  let outOfRange = reynoldsWarning(Re);

  if (Re > 10000 && Number.isFinite(Pr) && Pr > 0) {
    const nuLimit = gnielinskiNu(Re, Pr);
    const hLimit = (nuLimit * air.k) / input.D_o;
    if (Number.isFinite(hLimit) && hLimit > 0 && h > hLimit) {
      h = hLimit;
    }
  }

  return { j, f, h_air_W_m2K: h, Re_Dc: Re, correlation: "Wang-Chi-Chang-2000-plain",
    outOfRange };
}

// Chang-Wang 1997 — aletas PERSIANADAS (louver)
// Int. J. Heat Mass Transfer 40(3):533–544
function louver(input: CoilGeometryInput): CorrelationResult {
  if (!input.L_p || !input.theta_L) return plain(input);
  const air = getAir(input.T_air_C);
  const sigma = 1 - input.D_o / input.P_t;
  const V_max = input.V_face / sigma;
  const Re_Lp = (air.rho * V_max * input.L_p) / air.mu;
  const Lf = input.L_fin ?? input.P_l * input.N;
  const j = 0.49 * Math.pow(input.theta_L/90,0.27) * Math.pow(input.F_p/input.L_p,-0.14)
    * Math.pow(Lf/input.L_p,-0.29) * Math.pow(input.D_o/input.L_p,-0.23)
    * Math.pow(input.L_p/input.P_t,0.66) * Math.pow(input.P_t/input.P_l,0.18)
    * Math.pow(Re_Lp,-0.49);
  const f = 14.39 * Math.pow(Re_Lp, -0.805*Math.pow(input.F_p/input.L_p,0.72))
    * Math.pow(Math.log(1.0+input.F_p/input.L_p),3.04)
    * Math.pow(Math.log(0.9+(input.L_p/input.P_t)*input.N),-3.01)
    * Math.pow(input.F_p/input.D_o,-0.308) * Math.pow(Lf/input.D_o,-0.308)
    * Math.pow(Math.exp(-0.1167*input.P_t/input.D_o),0.35) * Math.pow(input.theta_L,0.0688);
  const h = (j * air.rho * V_max * air.cp) / Math.pow(air.Pr, 2/3);
  return { j, f, h_air_W_m2K: h, Re_Dc: Re_Lp, correlation: "Chang-Wang-1997-louver",
    outOfRange: Re_Lp < 100 || Re_Lp > 3000 ? `Re_Lp=${Re_Lp.toFixed(0)} fora da faixa 100–3000` : undefined };
}

// Kim-Youn-Webb 1997 — aletas ONDULADAS (wavy)
// Int. J. Heat Mass Transfer 40(13):3009–3017
function wavy(input: CoilGeometryInput): CorrelationResult {
  if (!input.A_w) return plain(input);
  const air = getAir(input.T_air_C);
  const sigma = 1 - input.D_o / input.P_t;
  const V_max = input.V_face / sigma;
  const Re = (air.rho * V_max * input.D_o) / air.mu;
  const j = 0.394 * Math.pow(Re,-0.392) * Math.pow(input.F_p/input.D_o,0.798)
    * Math.pow(input.P_t/input.P_l,-0.198) * Math.pow(input.N,-0.290)
    * Math.pow(input.P_l/input.D_o,-0.0978) * Math.pow(input.A_w/input.F_p,0.195);
  const f = 0.764 * Math.pow(Re,-0.739) * Math.pow(input.F_p/input.D_o,-0.177)
    * Math.pow(input.P_t/input.P_l,0.058) * Math.pow(input.N,0.965)
    * Math.pow(input.P_l/input.D_o,0.708) * Math.pow(input.A_w/input.F_p,0.257);
  const h = (j * air.rho * V_max * air.cp) / Math.pow(air.Pr, 2/3);
  return { j, f, h_air_W_m2K: h, Re_Dc: Re, correlation: "Kim-Youn-Webb-1997-wavy",
    outOfRange: Re < 400 || Re > 6000 ? `Re=${Re.toFixed(0)} fora da faixa 400–6000` : undefined };
}

/**
 * Correlação de Mihailovic (2019) para evaporadores industriais.
 * Válida para: D_o = 10–22mm, Re_D = 500–12000, aletas planas e onduladas.
 * Fonte: Mihailovic et al., Int. J. Refrigeration, 2019.
 */
export function mihailovic2019(input: CoilGeometryInput): CorrelationResult {
  const air = getAir(input.T_air_C);
  const sigma = (input.P_t - input.D_o) / input.P_t;
  const V_max = input.V_face / sigma;
  const Re_D = (air.rho * V_max * input.D_o) / air.mu;

  const j =
    0.394 *
    Math.pow(Re_D, -0.392) *
    Math.pow(input.P_t / input.D_o, -0.181) *
    Math.pow(input.P_l / input.D_o, -0.108) *
    Math.pow(input.F_p / input.D_o, -0.107) *
    Math.pow(input.N, -0.058);

  const f =
    1.211 *
    Math.pow(Re_D, -0.214) *
    Math.pow(input.P_t / input.D_o, 0.372) *
    Math.pow(input.P_l / input.D_o, -0.432) *
    Math.pow(input.F_p / input.D_o, 0.198) *
    Math.pow(input.N, 0.052);

  const h_air = (j * air.rho * V_max * air.cp) / Math.pow(air.Pr, 2 / 3);

  return {
    j, f, h_air_W_m2K: h_air, Re_Dc: Re_D, correlation: "Mihailovic-2019-industrial",
    outOfRange: Re_D < 500 || Re_D > 12000 ? `Re_D=${Re_D.toFixed(0)} fora da faixa 500–12000` : undefined,
  };
}

/**
 * Correlação de Granryd (1965) — fallback conservador para qualquer geometria.
 * Fonte: Granryd, E., Int. J. Refrigeration, 1965.
 */
export function granryd1965(input: CoilGeometryInput): CorrelationResult {
  const air = getAir(input.T_air_C);
  const sigma = (input.P_t - input.D_o) / input.P_t;
  const V_max = input.V_face / sigma;
  const Re_D = (air.rho * V_max * input.D_o) / air.mu;

  const Nu =
    0.30 *
    Math.pow(Re_D, 0.625) *
    Math.pow(air.Pr, 1 / 3) *
    Math.pow(input.P_t / input.P_l, 0.2);

  const h_air = (Nu * air.k) / input.D_o;
  const j = (h_air / (air.rho * V_max * air.cp)) * Math.pow(air.Pr, 2 / 3);

  return {
    j, f: 0, h_air_W_m2K: h_air, Re_Dc: Re_D, correlation: "Granryd-1965-fallback",
    outOfRange: undefined,
  };
}

export function calcAirSideHeatTransfer(input: CoilGeometryInput): CorrelationResult {
  const D_o_mm = input.D_o * 1000;

  if (D_o_mm > 12.0) {
    if (D_o_mm <= 22.0) {
      return mihailovic2019(input);
    } else {
      return granryd1965(input);
    }
  }

  switch (input.finType) {
    case "louver": return louver(input);
    case "wavy":   return wavy(input);
    default:       return plain(input);
  }
}

export function mapUnilabFinType(code: number | null | undefined): FinType {
  if (code === 3) return "louver";
  if (code === 2) return "wavy";
  return "plain";
}

// --------------------------------------------------------------------------
// Compatibilidade com chamadas existentes (simulatorCore V1)
// --------------------------------------------------------------------------

export interface WangChiChangParams {
  tubeOdMm: number;
  finThicknessMm: number;
  finPitchMm: number;
  rowPitchMm: number;
  tubePitchMm: number;
  numberOfRows: number;
  airFaceVelocityMs: number;
  /** Temperatura do ar de entrada [°C] — padrão 20°C. Afeta rho, mu, Pr. */
  airTempC?: number;
  Re?: number;
  Pr?: number;
  finConductivityWmK?: number;
  hRefInternalWm2K?: number;
  areaRatioExtToInt?: number;
  finAreaRatio?: number;
}

export interface WangChiChangResult {
  hAirWm2K: number;
  finEfficiency: number;
  surfaceEfficiency: number;
  uGlobalWm2K: number;
  reynoldsDc: number;
  jColburn: number;
  warnings: string[];
}

export function calculateWangChiChang(p: WangChiChangParams): WangChiChangResult {
  const warnings: string[] = [];

  const Do = p.tubeOdMm / 1000;
  const delta_f = p.finThicknessMm / 1000;
  const Dc = Do + 2 * delta_f;
  const Fp = p.finPitchMm / 1000;
  const Pl = p.rowPitchMm / 1000;
  const Pt = p.tubePitchMm / 1000;
  const N = Math.max(1, Math.round(p.numberOfRows));
  const v = p.airFaceVelocityMs;

  if (Do <= 0 || Fp <= 0 || Pl <= 0 || Pt <= 0 || delta_f <= 0 || v <= 0) {
    warnings.push("Wang-Chi-Chang: geometria/velocidade inválida.");
    return { hAirWm2K: 0, finEfficiency: 0, surfaceEfficiency: 0, uGlobalWm2K: 0, reynoldsDc: 0, jColburn: 0, warnings };
  }

  const res = plain({
    finType: "plain",
    D_o: Dc,
    P_t: Pt,
    P_l: Pl,
    F_p: Fp,
    N,
    V_face: v,
    T_air_C: p.airTempC ?? 20,
    Re: p.Re,
    Pr: p.Pr,
  });

  if (!Number.isFinite(res.h_air_W_m2K) || res.h_air_W_m2K <= 0) {
    warnings.push("Wang-Chi-Chang: h_ar inválido.");
    return { hAirWm2K: 0, finEfficiency: 0, surfaceEfficiency: 0, uGlobalWm2K: 0, reynoldsDc: res.Re_Dc, jColburn: res.j, warnings };
  }

  const h_ar = res.h_air_W_m2K;
  const k_fin = p.finConductivityWmK ?? 200;
  const Lf = Math.max((Pt - Dc) / 2, 1e-4);
  const m = Math.sqrt((2 * h_ar) / (k_fin * delta_f));
  const mLf = m * Lf;
  const eta_fin = mLf > 0 ? Math.tanh(mLf) / mLf : 1;

  const finAreaRatio = p.finAreaRatio ?? 0.9;
  const eta_o = 1 - finAreaRatio * (1 - eta_fin);

  const h_ref = p.hRefInternalWm2K ?? 3000;
  const Ar = p.areaRatioExtToInt ?? 20;
  const uGlobal = 1 / (1 / (eta_o * h_ar) + Ar / h_ref);

  if (!Number.isFinite(uGlobal) || uGlobal <= 0) {
    warnings.push("Wang-Chi-Chang: U global inválido.");
  }

  if (res.outOfRange) warnings.push(res.outOfRange);

  return {
    hAirWm2K: h_ar,
    finEfficiency: eta_fin,
    surfaceEfficiency: eta_o,
    uGlobalWm2K: uGlobal,
    reynoldsDc: res.Re_Dc,
    jColburn: res.j,
    warnings,
  };
}

export function wangChiChang(input: Omit<CoilGeometryInput, "finType" | "T_air_C"> & { T_air_C?: number }): CorrelationResult {
  return plain({ ...input, finType: "plain", T_air_C: input.T_air_C ?? 25 });
}
