import type { FluidPropsSinglePhase } from "./heatTransfer";

export interface RefrigerantLiquidProps extends FluidPropsSinglePhase {
  h_fg_kJkg: number;
  warnings: string[];
}

// Format: [T_°C, rho kg/m³, mu µPa·s, cp J/(kg·K), k mW/(m·K), h_fg kJ/kg]
const TABLES: Record<string, number[][]> = {
  R404A: [
    [-40, 1235, 310, 1340, 90.0, 218],
    [-30, 1195, 275, 1370, 86.0, 208],
    [-20, 1153, 245, 1400, 82.0, 197],
    [-10, 1120, 200, 1370, 83.0, 185],
    [  0, 1060, 194, 1490, 74.0, 172],
    [ 10, 1008, 172, 1560, 70.0, 157],
    [ 20,  950, 152, 1650, 65.0, 140],
    [ 30,  883, 133, 1790, 60.0, 120],
    [ 40,  800, 114, 2010, 54.0,  95],
  ],
  R410A: [
    [-40, 1280, 270, 1480, 106.0, 240],
    [-30, 1240, 238, 1510, 101.0, 229],
    [-20, 1196, 210, 1540,  96.0, 217],
    [-10, 1149, 185, 1580,  91.0, 204],
    [  0, 1088, 163, 1630,  86.0, 221],
    [ 10, 1044, 143, 1700,  80.0, 189],
    [ 20,  982, 124, 1800,  74.0, 172],
    [ 30,  910, 106, 1950,  67.0, 153],
    [ 40,  824,  88, 2200,  59.0, 131],
  ],
  R22: [
    [-40, 1283, 350, 1100, 110.0, 234],
    [-30, 1247, 305, 1115, 105.0, 224],
    [-20, 1209, 268, 1130, 100.0, 213],
    [-10, 1169, 236, 1150,  95.0, 201],
    [  0, 1127, 208, 1175,  90.0, 187],
    [ 10, 1082, 183, 1210,  85.0, 172],
    [ 20, 1033, 161, 1255,  79.0, 155],
    [ 30,  978, 140, 1320,  73.0, 135],
    [ 40,  916, 120, 1420,  66.0, 111],
  ],
  R134A: [
    [-40, 1294, 420, 1260,  97.0, 204],
    [-30, 1261, 360, 1275,  93.0, 196],
    [-20, 1226, 310, 1290,  89.0, 187],
    [-10, 1189, 268, 1310,  85.0, 177],
    [  0, 1150, 232, 1340,  81.0, 166],
    [ 10, 1108, 200, 1380,  77.0, 154],
    [ 20, 1063, 172, 1430,  72.0, 140],
    [ 30, 1013, 147, 1500,  67.0, 124],
    [ 40,  957, 124, 1600,  62.0, 105],
  ],
  R407C: [
    [-40, 1237, 340, 1380,  96.0, 228],
    [-30, 1197, 298, 1400,  92.0, 218],
    [-20, 1155, 262, 1430,  88.0, 207],
    [-10, 1110, 230, 1465,  83.0, 195],
    [  0, 1062, 202, 1510,  79.0, 181],
    [ 10, 1010, 177, 1570,  74.0, 166],
    [ 20,  952, 154, 1660,  68.0, 149],
    [ 30,  886, 132, 1800,  62.0, 129],
    [ 40,  808, 111, 2020,  55.0, 105],
  ],
  R507A: [
    [-40, 1230, 295, 1360,  90.0, 222],
    [-30, 1191, 260, 1385,  86.0, 212],
    [-20, 1150, 228, 1415,  82.0, 201],
    [-10, 1107, 200, 1450,  78.0, 189],
    [  0, 1060, 175, 1495,  74.0, 176],
    [ 10, 1009, 153, 1555,  69.0, 161],
    [ 20,  952, 132, 1640,  64.0, 144],
    [ 30,  887, 113, 1780,  58.0, 124],
    [ 40,  810,  95, 2000,  52.0,  99],
  ],
  R290: [
    [-40, 556, 210, 2300, 118.0, 420],
    [-30, 540, 188, 2340, 112.0, 405],
    [-20, 523, 168, 2390, 106.0, 389],
    [-10, 505, 150, 2450, 100.0, 371],
    [  0, 486, 133, 2520,  94.0, 352],
    [ 10, 466, 118, 2620,  87.0, 330],
    [ 20, 444, 104, 2750,  80.0, 306],
    [ 30, 420,  90, 2940,  73.0, 278],
    [ 40, 393,  77, 3230,  65.0, 246],
  ],
  R717: [
    [-40, 690, 255, 4380, 508.0, 1387],
    [-30, 677, 225, 4430, 493.0, 1357],
    [-20, 665, 199, 4480, 477.0, 1328],
    [-10, 652, 175, 4540, 461.0, 1297],
    [  0, 639, 154, 4600, 445.0, 1265],
    [ 10, 625, 135, 4670, 428.0, 1231],
    [ 20, 610, 118, 4760, 410.0, 1194],
  ],
  // M5 — Fluidos de baixo GWP adicionados conforme NIST ACSIM (2026)
  // Fonte: NIST REFPROP 10.0 / ASHRAE Fundamentals 2021
  // Formato: [T_°C, rho kg/m³, mu µPa·s, cp J/(kg·K), k mW/(m·K), h_fg kJ/kg]
  R32: [
    // R32 (HFC-32, difluorometano) — GWP=675, ODP=0
    // Substituto do R410A em sistemas de menor carga
    [-40, 1100, 280, 1680, 180.0, 390],
    [-30, 1070, 248, 1710, 172.0, 374],
    [-20, 1038, 220, 1745, 163.0, 357],
    [-10,  999, 194, 1790, 154.0, 338],
    [  0,  957, 171, 1845, 145.0, 317],
    [ 10,  911, 150, 1920, 135.0, 293],
    [ 20,  859, 131, 2020, 125.0, 265],
    [ 30,  799, 113, 2180, 113.0, 233],
    [ 40,  727,  96, 2450, 100.0, 195],
  ],
  R1234YF: [
    // R1234yf (HFO-1234yf) — GWP=4, ODP=0
    // Substituto do R134a em automotivo e sistemas de média temperatura
    [-40, 1175, 440, 1230,  95.0, 195],
    [-30, 1143, 380, 1250,  91.0, 187],
    [-20, 1109, 328, 1270,  87.0, 179],
    [-10, 1073, 283, 1295,  83.0, 170],
    [  0, 1034, 244, 1325,  79.0, 160],
    [ 10,  991, 210, 1365,  74.0, 148],
    [ 20,  944, 180, 1420,  69.0, 135],
    [ 30,  891, 153, 1500,  63.0, 120],
    [ 40,  829, 128, 1620,  57.0, 102],
  ],
  R452B: [
    // R452B (HFO/HFC blend: 67%R32+26%R125+7%R1234yf) — GWP=676
    // Substituto do R410A com menor GWP
    [-40, 1250, 278, 1470, 103.0, 235],
    [-30, 1211, 246, 1500,  98.0, 224],
    [-20, 1169, 217, 1535,  93.0, 212],
    [-10, 1124, 191, 1575,  88.0, 199],
    [  0, 1075, 168, 1625,  83.0, 184],
    [ 10, 1022, 147, 1690,  77.0, 168],
    [ 20,  963, 128, 1780,  71.0, 150],
    [ 30,  896, 110, 1920,  64.0, 129],
    [ 40,  817,  93, 2140,  57.0, 105],
  ],
  R454B: [
    // R454B (HFO/HFC blend: 68.9%R32+31.1%R1234yf) — GWP=466
    // Substituto do R410A com GWP ainda menor
    [-40, 1198, 272, 1540, 152.0, 330],
    [-30, 1163, 241, 1570, 145.0, 316],
    [-20, 1126, 213, 1605, 137.0, 300],
    [-10, 1086, 188, 1650, 129.0, 283],
    [  0, 1042, 165, 1705, 121.0, 264],
    [ 10,  993, 145, 1775, 112.0, 243],
    [ 20,  938, 126, 1870, 103.0, 219],
    [ 30,  875, 109, 2010,  93.0, 191],
    [ 40,  800,  92, 2250,  82.0, 159],
  ],
  R513A: [
    // R513A (HFO/HFC blend: 56%R1234yf+44%R134a) — GWP=573
    // Substituto do R134a de baixo GWP
    [-40, 1236, 430, 1245,  96.0, 200],
    [-30, 1203, 370, 1260,  92.0, 192],
    [-20, 1169, 319, 1280,  88.0, 183],
    [-10, 1132, 275, 1305,  84.0, 173],
    [  0, 1093, 237, 1335,  80.0, 162],
    [ 10, 1050, 204, 1375,  75.0, 150],
    [ 20, 1003, 175, 1430,  70.0, 136],
    [ 30,  950, 149, 1505,  65.0, 120],
    [ 40,  889, 125, 1620,  59.0, 102],
  ],
  R515B: [
    // R515B (HFO/HFE blend: 91.1%R1234ze(E)+8.9%R227ea) — GWP=299
    // Substituto do R134a de muito baixo GWP
    [-40, 1280, 500, 1200,  90.0, 185],
    [-30, 1246, 430, 1215,  86.0, 178],
    [-20, 1210, 370, 1235,  82.0, 170],
    [-10, 1172, 319, 1260,  78.0, 161],
    [  0, 1131, 275, 1290,  74.0, 151],
    [ 10, 1087, 237, 1330,  70.0, 140],
    [ 20, 1038, 203, 1385,  65.0, 127],
    [ 30,  983, 173, 1460,  60.0, 112],
    [ 40,  920, 146, 1580,  55.0,  95],
  ],
};

function normalizeId(id: string): string {
  return id.replace(/^REF_/i, "").replace(/-/g, "").toUpperCase();
}

function interpolate(table: number[][], T: number, col: number): number {
  if (T <= table[0][0]) return table[0][col];
  if (T >= table[table.length - 1][0]) return table[table.length - 1][col];
  for (let i = 0; i < table.length - 1; i++) {
    const T0 = table[i][0], T1 = table[i + 1][0];
    if (T >= T0 && T <= T1) {
      const f = (T - T0) / (T1 - T0);
      return table[i][col] + f * (table[i + 1][col] - table[i][col]);
    }
  }
  return table[table.length - 1][col];
}

export function getRefrigerantLiquidProps(
  refrigerantId: string,
  T_sat_C: number,
): RefrigerantLiquidProps {
  const warnings: string[] = [];
  const key = normalizeId(refrigerantId);
  let table = TABLES[key];

  if (!table) {
    warnings.push(
      `Refrigerante "${refrigerantId}" não encontrado nas tabelas NIST. Usando R404A como fallback.`,
    );
    table = TABLES.R404A;
  }

  return {
    rho_kg_m3: interpolate(table, T_sat_C, 1),
    mu_Pa_s:   interpolate(table, T_sat_C, 2) * 1e-6,
    cp_J_kgK:  interpolate(table, T_sat_C, 3),
    k_W_mK:    interpolate(table, T_sat_C, 4) * 1e-3,
    h_fg_kJkg: interpolate(table, T_sat_C, 5),
    warnings,
  };
}

export const AVAILABLE_REFRIGERANTS_V2 = Object.keys(TABLES);

// ============================================================================
// M6 — Parâmetros de correção (multiplicadores) — NIST ACSIM Sect. 3.5
// ============================================================================

/**
 * Multiplicadores de correção para calibração com dados experimentais.
 * Permite ajustar os coeficientes calculados para corresponder a medidas laboratoriais.
 *
 * Fonte: NIST ACSIM v1.0 (2026), Seção 3.5 — Correction Parameters.
 * Cada multiplicador é aplicado diretamente ao coeficiente correspondente.
 * Valor 1.0 = sem correção (comportamento padrão).
 */
export interface CorrectionMultipliers {
  /** Multiplicador do coeficiente de transferência de calor do lado ar h_o. Padrão: 1.0 */
  airSideH?: number;
  /** Multiplicador do coeficiente de transferência de calor do lado fluido h_i. Padrão: 1.0 */
  fluidSideH?: number;
  /** Multiplicador da queda de pressão do ar ΔP_ar. Padrão: 1.0 */
  airPressureDrop?: number;
  /** Multiplicador da queda de pressão do fluido ΔP_fluido. Padrão: 1.0 */
  fluidPressureDrop?: number;
  /** Multiplicador da área total de transferência de calor A_total. Padrão: 1.0 */
  heatTransferArea?: number;
}

/**
 * Aplica os multiplicadores de correção a um valor calculado.
 * Retorna o valor original se o multiplicador não for definido ou for inválido.
 */
export function applyCorrection(value: number, multiplier?: number): number {
  if (!Number.isFinite(multiplier) || multiplier! <= 0) return value;
  return value * multiplier!;
}

/**
 * Valida os multiplicadores de correção e retorna warnings para valores suspeitos.
 */
export function validateCorrectionMultipliers(
  m: CorrectionMultipliers,
): string[] {
  const warnings: string[] = [];
  const fields: [keyof CorrectionMultipliers, string][] = [
    ["airSideH", "h_o (lado ar)"],
    ["fluidSideH", "h_i (lado fluido)"],
    ["airPressureDrop", "ΔP ar"],
    ["fluidPressureDrop", "ΔP fluido"],
    ["heatTransferArea", "A_total"],
  ];
  for (const [key, label] of fields) {
    const v = m[key];
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v <= 0) {
      warnings.push(`Multiplicador de ${label} inválido (${v}) — ignorado.`);
    } else if (v < 0.5 || v > 2.0) {
      warnings.push(
        `Multiplicador de ${label} = ${v.toFixed(2)} fora da faixa recomendada [0.5, 2.0].`,
      );
    }
  }
  return warnings;
}
