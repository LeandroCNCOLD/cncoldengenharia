import type { FluidPropsSinglePhase } from "./heatTransfer";

interface RefrigerantTableEntry {
  T_C: number;
  rho_liq: number;
  cp_liq: number;
  mu_liq: number;
  k_liq: number;
  h_fg: number;
}

const TABLES: Record<string, RefrigerantTableEntry[]> = {
  R22: [
    { T_C: -40, rho_liq: 1316, cp_liq: 1100, mu_liq: 2.8e-4, k_liq: 0.115, h_fg: 234 },
    { T_C: -20, rho_liq: 1267, cp_liq: 1130, mu_liq: 2.3e-4, k_liq: 0.107, h_fg: 222 },
    { T_C: -10, rho_liq: 1241, cp_liq: 1160, mu_liq: 2.1e-4, k_liq: 0.102, h_fg: 216 },
    { T_C: 0,   rho_liq: 1213, cp_liq: 1190, mu_liq: 1.9e-4, k_liq: 0.097, h_fg: 209 },
    { T_C: 10,  rho_liq: 1183, cp_liq: 1230, mu_liq: 1.7e-4, k_liq: 0.092, h_fg: 201 },
    { T_C: 30,  rho_liq: 1116, cp_liq: 1340, mu_liq: 1.4e-4, k_liq: 0.080, h_fg: 182 },
  ],
  R134A: [
    { T_C: -40, rho_liq: 1295, cp_liq: 1260, mu_liq: 4.2e-4, k_liq: 0.112, h_fg: 225 },
    { T_C: -20, rho_liq: 1225, cp_liq: 1310, mu_liq: 3.2e-4, k_liq: 0.102, h_fg: 212 },
    { T_C: -10, rho_liq: 1187, cp_liq: 1350, mu_liq: 2.8e-4, k_liq: 0.097, h_fg: 205 },
    { T_C: 0,   rho_liq: 1147, cp_liq: 1400, mu_liq: 2.5e-4, k_liq: 0.092, h_fg: 197 },
    { T_C: 10,  rho_liq: 1104, cp_liq: 1460, mu_liq: 2.2e-4, k_liq: 0.086, h_fg: 188 },
    { T_C: 30,  rho_liq: 1009, cp_liq: 1620, mu_liq: 1.7e-4, k_liq: 0.074, h_fg: 167 },
  ],
  R404A: [
    { T_C: -40, rho_liq: 1218, cp_liq: 1280, mu_liq: 2.8e-4, k_liq: 0.097, h_fg: 200 },
    { T_C: -20, rho_liq: 1155, cp_liq: 1330, mu_liq: 2.3e-4, k_liq: 0.088, h_fg: 188 },
    { T_C: -10, rho_liq: 1120, cp_liq: 1370, mu_liq: 2.0e-4, k_liq: 0.083, h_fg: 181 },
    { T_C: 0,   rho_liq: 1083, cp_liq: 1420, mu_liq: 1.8e-4, k_liq: 0.078, h_fg: 173 },
    { T_C: 10,  rho_liq: 1043, cp_liq: 1480, mu_liq: 1.6e-4, k_liq: 0.073, h_fg: 164 },
    { T_C: 30,  rho_liq: 950,  cp_liq: 1660, mu_liq: 1.2e-4, k_liq: 0.060, h_fg: 141 },
  ],
  R410A: [
    { T_C: -40, rho_liq: 1245, cp_liq: 1510, mu_liq: 2.8e-4, k_liq: 0.108, h_fg: 256 },
    { T_C: -20, rho_liq: 1171, cp_liq: 1570, mu_liq: 2.2e-4, k_liq: 0.097, h_fg: 240 },
    { T_C: -10, rho_liq: 1131, cp_liq: 1620, mu_liq: 1.9e-4, k_liq: 0.091, h_fg: 231 },
    { T_C: 0,   rho_liq: 1088, cp_liq: 1680, mu_liq: 1.7e-4, k_liq: 0.085, h_fg: 221 },
    { T_C: 10,  rho_liq: 1041, cp_liq: 1760, mu_liq: 1.5e-4, k_liq: 0.079, h_fg: 210 },
    { T_C: 30,  rho_liq: 934,  cp_liq: 2010, mu_liq: 1.1e-4, k_liq: 0.065, h_fg: 182 },
  ],
  R407C: [
    { T_C: -40, rho_liq: 1223, cp_liq: 1330, mu_liq: 3.0e-4, k_liq: 0.103, h_fg: 218 },
    { T_C: -20, rho_liq: 1154, cp_liq: 1390, mu_liq: 2.4e-4, k_liq: 0.093, h_fg: 204 },
    { T_C: -10, rho_liq: 1117, cp_liq: 1430, mu_liq: 2.1e-4, k_liq: 0.088, h_fg: 196 },
    { T_C: 0,   rho_liq: 1078, cp_liq: 1480, mu_liq: 1.9e-4, k_liq: 0.083, h_fg: 188 },
    { T_C: 10,  rho_liq: 1036, cp_liq: 1550, mu_liq: 1.7e-4, k_liq: 0.077, h_fg: 178 },
    { T_C: 30,  rho_liq: 940,  cp_liq: 1760, mu_liq: 1.2e-4, k_liq: 0.063, h_fg: 154 },
  ],
  R507A: [
    { T_C: -40, rho_liq: 1207, cp_liq: 1270, mu_liq: 2.7e-4, k_liq: 0.095, h_fg: 196 },
    { T_C: -20, rho_liq: 1141, cp_liq: 1320, mu_liq: 2.2e-4, k_liq: 0.086, h_fg: 183 },
    { T_C: -10, rho_liq: 1105, cp_liq: 1360, mu_liq: 1.9e-4, k_liq: 0.081, h_fg: 176 },
    { T_C: 0,   rho_liq: 1067, cp_liq: 1410, mu_liq: 1.7e-4, k_liq: 0.076, h_fg: 168 },
    { T_C: 10,  rho_liq: 1025, cp_liq: 1470, mu_liq: 1.5e-4, k_liq: 0.070, h_fg: 158 },
    { T_C: 30,  rho_liq: 929,  cp_liq: 1660, mu_liq: 1.1e-4, k_liq: 0.057, h_fg: 135 },
  ],
  R290: [
    { T_C: -40, rho_liq: 567,  cp_liq: 2380, mu_liq: 1.8e-4, k_liq: 0.117, h_fg: 430 },
    { T_C: -20, rho_liq: 540,  cp_liq: 2450, mu_liq: 1.5e-4, k_liq: 0.108, h_fg: 408 },
    { T_C: -10, rho_liq: 525,  cp_liq: 2490, mu_liq: 1.4e-4, k_liq: 0.103, h_fg: 396 },
    { T_C: 0,   rho_liq: 509,  cp_liq: 2540, mu_liq: 1.3e-4, k_liq: 0.098, h_fg: 383 },
    { T_C: 10,  rho_liq: 491,  cp_liq: 2600, mu_liq: 1.2e-4, k_liq: 0.092, h_fg: 369 },
    { T_C: 30,  rho_liq: 451,  cp_liq: 2760, mu_liq: 1.0e-4, k_liq: 0.079, h_fg: 337 },
  ],
  R717: [
    { T_C: -40, rho_liq: 690,  cp_liq: 4600, mu_liq: 2.5e-4, k_liq: 0.540, h_fg: 1388 },
    { T_C: -20, rho_liq: 665,  cp_liq: 4700, mu_liq: 2.1e-4, k_liq: 0.510, h_fg: 1328 },
    { T_C: -10, rho_liq: 651,  cp_liq: 4760, mu_liq: 1.9e-4, k_liq: 0.494, h_fg: 1296 },
    { T_C: 0,   rho_liq: 638,  cp_liq: 4820, mu_liq: 1.7e-4, k_liq: 0.478, h_fg: 1262 },
    { T_C: 10,  rho_liq: 624,  cp_liq: 4890, mu_liq: 1.5e-4, k_liq: 0.461, h_fg: 1226 },
    { T_C: 30,  rho_liq: 595,  cp_liq: 5060, mu_liq: 1.2e-4, k_liq: 0.425, h_fg: 1148 },
  ],
};

function normalizeId(id: string): string {
  return id.replace(/^REF_/i, "").replace(/-/g, "").toUpperCase();
}

function interpolate(table: RefrigerantTableEntry[], T: number): RefrigerantTableEntry {
  if (T <= table[0].T_C) return table[0];
  if (T >= table[table.length - 1].T_C) return table[table.length - 1];
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i], b = table[i + 1];
    if (T >= a.T_C && T <= b.T_C) {
      const f = (T - a.T_C) / (b.T_C - a.T_C);
      return {
        T_C: T,
        rho_liq: a.rho_liq + f * (b.rho_liq - a.rho_liq),
        cp_liq:  a.cp_liq  + f * (b.cp_liq  - a.cp_liq),
        mu_liq:  a.mu_liq  + f * (b.mu_liq  - a.mu_liq),
        k_liq:   a.k_liq   + f * (b.k_liq   - a.k_liq),
        h_fg:    a.h_fg    + f * (b.h_fg    - a.h_fg),
      };
    }
  }
  return table[table.length - 1];
}

export interface RefrigerantLiquidProps extends FluidPropsSinglePhase {
  h_fg_kJkg: number;
  warnings: string[];
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
      `Refrigerante "${refrigerantId}" não disponível nas tabelas NIST. Usando R404A como fallback.`,
    );
    table = TABLES.R404A;
  }

  const entry = interpolate(table, T_sat_C);

  return {
    rho_kg_m3: entry.rho_liq,
    mu_Pa_s: entry.mu_liq,
    cp_J_kgK: entry.cp_liq,
    k_W_mK: entry.k_liq,
    h_fg_kJkg: entry.h_fg,
    warnings,
  };
}

export const AVAILABLE_REFRIGERANTS_V2 = Object.keys(TABLES);
