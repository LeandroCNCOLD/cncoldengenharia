// VAPCYC importer — parses Bristol/Copeland v3/V4 + EBMPapst fans + cycle templates.
// Intended for server-side use (Node) when re-importing future VAPCYC dumps.
//
// Coefficient unit convention: VAPCYC datasheets use AHRI/ARI 540 in imperial
// system [degF, Btu/hr, A, lbm/hr, W]. We persist coefficients as-is (raw)
// and convert at runtime in compressorEngine. See refrigerantConvert below.
//
// This module is NOT a standalone runner — it exposes pure parsers used by
// either a server-fn (UI re-import) or the bootstrap python loader.

export type RefrigerantCode = string;

export interface VapcycCompressorRow {
  source_db: string;
  source_table_key: string; // unique row identifier inside the dump (e.g. "ZP154KCE-TFD-...")
  manufacturer: string | null;
  model: string;
  refrigerant: RefrigerantCode;
  application_type: string | null;
  units_system: string | null;
  motor_efficiency: number;
  massflow_correction: number;
  power_correction: number;
  displacement: number | null;
  voltage_v: number | null;
  frequency_hz: number | null;
  rpm: number | null;
  phase: number | null;
  subcooling_k: number | null;
  superheat_k: number | null;
  temp_evap_min_c: number | null;
  temp_evap_max_c: number | null;
  temp_cond_min_c: number | null;
  temp_cond_max_c: number | null;
  model_standard: string | null;
  raw: Record<string, unknown>;
}

export type CurveType = 'capacity' | 'power' | 'current' | 'mass_flow';

export interface VapcycPolynomial {
  source_table_key: string;
  curve_type: CurveType;
  unit_system: string; // e.g. "[degF,Btu_hr,A,lbm_hr,W]"
  coefficients: number[]; // length 10, AHRI 540 order
  temp_evap_min_c: number | null;
  temp_evap_max_c: number | null;
  temp_cond_min_c: number | null;
  temp_cond_max_c: number | null;
}

const F_TO_C = (f: number | null) => (f == null ? null : ((f - 32) * 5) / 9);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 || s === 'NULL' ? null : s;
}

/** Parse a Copeland V4-style flat row (all coefficients in the Models row). */
export function parseV4Row(
  row: Record<string, unknown>,
  sourceDb: string,
): { model: VapcycCompressorRow; polys: VapcycPolynomial[] } | null {
  const key = str(row.Key) ?? str(row.PerfSheet);
  const model = str(row.ModelName);
  if (!key || !model) return null;

  const refrigerant = str(row.Refrigerant) ?? 'UNKNOWN';
  const teMinC = F_TO_C(num(row.MinEvapF));
  const teMaxC = F_TO_C(num(row.MaxEvapF));
  const tcMinC = F_TO_C(num(row.MinCondF));
  const tcMaxC = F_TO_C(num(row.MaxCondF));
  const units = str(row.Units) ?? '[ft,degF,Btu_hr,A,lbm_hr,W]';

  const polys: VapcycPolynomial[] = [];
  const blocks: Array<[string, CurveType]> = [
    ['CCoeff', 'capacity'],
    ['PCoeff', 'power'],
    ['ACoeff', 'current'],
    ['MCoeff', 'mass_flow'],
  ];
  for (const [prefix, curveType] of blocks) {
    const coefs: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const v = num(row[`${prefix}${i}`]);
      if (v == null) {
        coefs.length = 0;
        break;
      }
      coefs.push(v);
    }
    if (coefs.length === 10) {
      polys.push({
        source_table_key: key,
        curve_type: curveType,
        unit_system: units,
        coefficients: coefs,
        temp_evap_min_c: teMinC,
        temp_evap_max_c: teMaxC,
        temp_cond_min_c: tcMinC,
        temp_cond_max_c: tcMaxC,
      });
    }
  }

  return {
    model: {
      source_db: sourceDb,
      source_table_key: key,
      manufacturer: str(row.Manufacturer),
      model,
      refrigerant,
      application_type: str(row.ApplicationType),
      units_system: units,
      motor_efficiency: num(row.MotorEfficiency) ?? 1,
      massflow_correction: num(row.MassflowCorrection) ?? 1,
      power_correction: num(row.PowerCorrection) ?? 1,
      displacement: num(row.Displacement),
      voltage_v: num(row.Voltage),
      frequency_hz: num(row.Frequency),
      rpm: num(row.RPM),
      phase: num(row.Phase) as number | null,
      subcooling_k: num(row.Subcooling),
      superheat_k: num(row.ConstantSuperHeat),
      temp_evap_min_c: teMinC,
      temp_evap_max_c: teMaxC,
      temp_cond_min_c: tcMinC,
      temp_cond_max_c: tcMaxC,
      model_standard: str(row.ModelStandard),
      raw: row,
    },
    polys,
  };
}

/** Parse a V3-style Models row (coefficients live in a separate per-model CSV). */
export function parseV3ModelRow(
  row: Record<string, unknown>,
  sourceDb: string,
  manufacturerFromDb: string | null,
): VapcycCompressorRow | null {
  const tableName = str(row.TableName);
  const model = str(row.ModelName);
  if (!tableName || !model) return null;
  const teMinC = F_TO_C(num(row.TMin_Evap) ?? num(row.TLower_limit));
  const teMaxC = F_TO_C(num(row.TMax_Evap) ?? num(row.TUpper_limit));
  const tcMinC = F_TO_C(num(row.TMin_Cond));
  const tcMaxC = F_TO_C(num(row.TMax_Cond));
  return {
    source_db: sourceDb,
    source_table_key: `${sourceDb}/${tableName}`,
    manufacturer: manufacturerFromDb,
    model,
    refrigerant: str(row.Refrigerant) ?? 'UNKNOWN',
    application_type: str(row.ApplicationType),
    units_system: str(row.Units) ?? '[degF,Btu_hr,A,lbm_hr,W]',
    motor_efficiency: num(row.MotorEfficiency) ?? 1,
    massflow_correction: num(row.MassflowCorrection) ?? 1,
    power_correction: num(row.PowerCorrection) ?? 1,
    displacement: num(row.Displacement),
    voltage_v: null,
    frequency_hz: num(row.Frequency),
    rpm: null,
    phase: null,
    subcooling_k: null,
    superheat_k: null,
    temp_evap_min_c: teMinC,
    temp_evap_max_c: teMaxC,
    temp_cond_min_c: tcMinC,
    temp_cond_max_c: tcMaxC,
    model_standard: str(row.ModelStandard),
    raw: row,
  };
}

/** Parse a per-model V3 coefficient CSV (10 rows × {AmpsCoeffs, CapCoeffs, MFCoeffs, PowCoeffs}). */
export function parseV3CoefficientCsv(
  rows: Array<Record<string, unknown>>,
  meta: {
    source_table_key: string;
    unit_system: string;
    teMinC: number | null;
    teMaxC: number | null;
    tcMinC: number | null;
    tcMaxC: number | null;
  },
): VapcycPolynomial[] {
  const cols: Array<[string, CurveType]> = [
    ['CapCoeffs', 'capacity'],
    ['PowCoeffs', 'power'],
    ['AmpsCoeffs', 'current'],
    ['MFCoeffs', 'mass_flow'],
  ];
  const polys: VapcycPolynomial[] = [];
  for (const [col, curveType] of cols) {
    const coefs = rows.map((r) => num(r[col]));
    if (coefs.length !== 10 || coefs.some((c) => c == null)) continue;
    polys.push({
      source_table_key: meta.source_table_key,
      curve_type: curveType,
      unit_system: meta.unit_system,
      coefficients: coefs as number[],
      temp_evap_min_c: meta.teMinC,
      temp_evap_max_c: meta.teMaxC,
      temp_cond_min_c: meta.tcMinC,
      temp_cond_max_c: meta.tcMaxC,
    });
  }
  return polys;
}
