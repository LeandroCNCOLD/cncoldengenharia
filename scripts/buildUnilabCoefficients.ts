import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonRecord = Record<string, unknown>;

type DiscardedEntry = {
  source: string;
  reason: string;
  index?: number;
  id?: unknown;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const catalogsDir = path.join(rootDir, "public", "data", "catalogs");

const OUTPUT_FILE = path.join(catalogsDir, "unilabCoefficients.json");
const REPORT_FILE = path.join(catalogsDir, "unilabCoefficients.report.json");

const INPUT_FILES = {
  coilCorrectionCoefficients_principal: "coilCorrectionCoefficients_principal.json",
  coilCorrectionCoefficients_fluids: "coilCorrectionCoefficients_fluids.json",
  coilCorrectionCoefficients_backup: "coilCorrectionCoefficients_backup.json",
  coilSubcoolingCoefficients_principal: "coilSubcoolingCoefficients_principal.json",
  coilSubcoolingCoefficients_fluids: "coilSubcoolingCoefficients_fluids.json",
  fanAxial_type0_config1: "fanAxial_type0_config1_principal.json",
  fanAxial_type0_config2: "fanAxial_type0_config2_principal.json",
  fanAxial_type1_config1: "fanAxial_type1_config1_principal.json",
  fanAxial_type1_config2: "fanAxial_type1_config2_principal.json",
  fanCentrifugal_curves: "fanCentrifugal_curves_principal.json",
  fanCentrifugal_data: "fanCentrifugal_data_principal.json",
  vapcyc_coildesigner_correlations: "vapcyc_coildesigner_correlations.json",
  vapcyc_hx_correlations: "vapcyc_hx_correlations.json",
} as const;

const AXIAL_SOURCES = [
  ["fanAxial_type0_config1", "type0_config1"],
  ["fanAxial_type0_config2", "type0_config2"],
  ["fanAxial_type1_config1", "type1_config1"],
  ["fanAxial_type1_config2", "type1_config2"],
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function rowsFromJson(value: unknown, source: string): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value)) {
    for (const key of ["data", "items", "records", "rows", "correlations"]) {
      const candidate = value[key];
      if (Array.isArray(candidate)) {
        return candidate.filter(isRecord);
      }
    }
  }

  throw new Error(`Entrada ${source} nao contem um array JSON reconhecivel.`);
}

async function readJsonRows(fileName: string): Promise<JsonRecord[]> {
  const fullPath = path.join(catalogsDir, fileName);
  const raw = await readFile(fullPath, "utf8");
  return rowsFromJson(JSON.parse(raw), fileName);
}

function numberValue(row: JsonRecord, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const normalized = value.replace(",", ".");
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function stringValue(row: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function coefficients(row: JsonRecord, prefix: string, count: number): number[] {
  return Array.from({ length: count }, (_, i) => numberValue(row, `${prefix}${i + 1}`) ?? 0);
}

function indexedValues(row: JsonRecord, prefix: string, count: number): number[] {
  return Array.from({ length: count }, (_, i) => numberValue(row, `${prefix}${i + 1}`)).filter(
    (value): value is number => value !== undefined,
  );
}

function isAllZero(values: Array<number | undefined>): boolean {
  return values.every((value) => value === undefined || value === 0);
}

function hasAnyValue(row: JsonRecord): boolean {
  return Object.values(row).some((value) => {
    if (value === null || value === undefined || value === "") return false;
    if (typeof value === "number") return Number.isFinite(value) && value !== 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  });
}

function consolidateCoilCorrections(rows: JsonRecord[], discarded: DiscardedEntry[]) {
  return rows.flatMap((row, index) => {
    const idCorr = numberValue(row, "IdCorr", "idCorr", "id");
    const coeffs = coefficients(row, "Coeff", 8);
    const vMin = numberValue(row, "Vamin", "VaMin", "vMin", "vamin");
    const vMax = numberValue(row, "Vamax", "VaMax", "vMax", "vamax");

    if (idCorr === 0 && isAllZero([...coeffs, vMin, vMax])) {
      discarded.push({
        source: "coilCorrectionCoefficients_principal",
        reason: "IdCorr zero com coeficientes e velocidades zerados",
        index,
        id: idCorr,
      });
      return [];
    }

    if (idCorr === undefined) {
      discarded.push({
        source: "coilCorrectionCoefficients_principal",
        reason: "Registro sem IdCorr valido",
        index,
      });
      return [];
    }

    return [
      {
        id: `coil_corr_${idCorr}`,
        idCorr,
        idTipologia: numberValue(row, "IdTipologia", "idTipologia", "geometryId"),
        serie: stringValue(row, "Serie", "serie") ?? "",
        velocityRange_m_s: {
          min: vMin ?? 0,
          max: vMax ?? 0,
        },
        coefficients: coeffs,
      },
    ];
  });
}

function consolidateSubcooling(rows: JsonRecord[], discarded: DiscardedEntry[]) {
  return rows.flatMap((row, index) => {
    const idCoeffSotto = numberValue(row, "IdCoeffSotto", "idCoeffSotto", "id");

    if (idCoeffSotto === undefined && !hasAnyValue(row)) {
      discarded.push({
        source: "coilSubcoolingCoefficients_principal",
        reason: "Registro totalmente vazio",
        index,
      });
      return [];
    }

    if (idCoeffSotto === undefined) {
      discarded.push({
        source: "coilSubcoolingCoefficients_principal",
        reason: "Registro sem IdCoeffSotto valido",
        index,
      });
      return [];
    }

    return [
      {
        id: `subcooling_${idCoeffSotto}`,
        idCoeffSotto,
        serie: stringValue(row, "Serie", "serie") ?? "",
        fatCoeflattub: numberValue(row, "FatCoeflattub", "fatCoeflattub") ?? 0,
        securityFactor: numberValue(row, "SecurityFactor", "securityFactor") ?? 0,
      },
    ];
  });
}

function consolidateAxialFans(
  inputs: Record<keyof typeof INPUT_FILES, JsonRecord[]>,
  discarded: DiscardedEntry[],
) {
  let sequence = 1;

  return AXIAL_SOURCES.flatMap(([inputKey, sourceType]) =>
    inputs[inputKey].flatMap((row, index) => {
      if (!hasAnyValue(row)) {
        discarded.push({
          source: inputKey,
          reason: "Registro totalmente vazio",
          index,
        });
        return [];
      }

      const x = indexedValues(row, "X", 11);
      const y = indexedValues(row, "Y", 11);
      const idFanModel = numberValue(row, "IdFanModel", "idFanModel", "id");

      return [
        {
          id: `axial_${sequence++}`,
          sourceType,
          idFanModel,
          model: stringValue(row, "Model", "Modello", "model") ?? "",
          voltage: numberValue(row, "Voltage", "Tensione", "voltage") ?? 0,
          frequency: numberValue(row, "Frequency", "Frequenza", "frequency") ?? 0,
          rpm: numberValue(row, "Rpm", "RPM", "rpm") ?? 0,
          power_W: numberValue(row, "Power", "Power_W", "Potenza", "power_W") ?? 0,
          current_A: numberValue(row, "Current", "Current_A", "Corrente", "current_A") ?? 0,
          airflowRange_m3h: {
            min: x.length > 0 ? Math.min(...x) : 0,
            max: x.length > 0 ? Math.max(...x) : 0,
          },
          curve: { x, y },
          polynomial: {
            coefficients: coefficients(row, "Coeff", 5),
          },
        },
      ];
    }),
  );
}

function consolidateCentrifugalFans(dataRows: JsonRecord[], curveRows: JsonRecord[], discarded: DiscardedEntry[]) {
  const curvesByCode = new Map<number, JsonRecord[]>();

  for (const curve of curveRows) {
    const code = numberValue(curve, "CodVentRif", "codVentRif");
    if (code === undefined) continue;
    const current = curvesByCode.get(code) ?? [];
    current.push(curve);
    curvesByCode.set(code, current);
  }

  return dataRows.flatMap((row, index) => {
    if (!hasAnyValue(row)) {
      discarded.push({
        source: "fanCentrifugal_data",
        reason: "Registro totalmente vazio",
        index,
      });
      return [];
    }

    const codVentRif = numberValue(row, "CodVentRif", "codVentRif");
    const curveMatches = codVentRif === undefined ? [] : curvesByCode.get(codVentRif) ?? [];
    const rawCurve =
      curveMatches.length === 1
        ? extractVetValues(curveMatches[0])
        : curveMatches.map((curve) => extractVetValues(curve));

    return [
      {
        id: `centrifugal_${index + 1}`,
        idFanModel: numberValue(row, "IdFanModel", "idFanModel", "id"),
        model: stringValue(row, "Model", "Modello", "model") ?? "",
        areaBocca_m2: numberValue(row, "AreaBocca", "areaBocca_m2") ?? 0,
        codVentRif,
        density_kg_m3: numberValue(row, "Density", "Rho", "density_kg_m3") ?? 0,
        rpmRange: {
          min: numberValue(row, "RpmMin", "RPMMin", "rpmMin") ?? 0,
          max: numberValue(row, "RpmMax", "RPMMax", "rpmMax") ?? 0,
        },
        pressureRange_Pa: {
          min: numberValue(row, "PressureMin", "Pmin", "pressureMin") ?? 0,
          max: numberValue(row, "PressureMax", "Pmax", "pressureMax") ?? 0,
        },
        capacityRange_m3h: {
          min: numberValue(row, "CapacityMin", "Qmin", "capacityMin") ?? 0,
          max: numberValue(row, "CapacityMax", "Qmax", "capacityMax") ?? 0,
        },
        rawCurve,
      },
    ];
  });
}

function extractVetValues(row: JsonRecord): JsonRecord {
  const rawCurve: JsonRecord = {};
  for (let i = 1; i <= 43; i += 1) {
    const key = `Vet${i}`;
    if (key in row) rawCurve[key] = row[key];
  }
  return rawCurve;
}

function consolidateCorrelations(rows: JsonRecord[]) {
  return rows.map((row) => ({
    tag: stringValue(row, "tag", "Tag") ?? "correlationinfo",
    name: stringValue(row, "name", "Name") ?? "",
    value: stringValue(row, "value", "Value", "text", "Text") ?? JSON.stringify(row),
  }));
}

async function main() {
  const missingFiles: string[] = [];
  const inputs = {} as Record<keyof typeof INPUT_FILES, JsonRecord[]>;

  for (const [key, fileName] of Object.entries(INPUT_FILES) as Array<
    [keyof typeof INPUT_FILES, string]
  >) {
    try {
      inputs[key] = await readJsonRows(fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ENOENT")) missingFiles.push(fileName);
      else throw error;
    }
  }

  if (missingFiles.length > 0) {
    console.error("Nao foi possivel consolidar coeficientes UNILAB.");
    console.error("Arquivos obrigatorios ausentes:");
    for (const fileName of missingFiles) console.error(`- ${path.join("public/data/catalogs", fileName)}`);
    process.exitCode = 1;
    return;
  }

  const generatedAt = new Date().toISOString();
  const discarded: DiscardedEntry[] = [];

  const coilCorrections = consolidateCoilCorrections(
    inputs.coilCorrectionCoefficients_principal,
    discarded,
  );
  const subcoolingCorrections = consolidateSubcooling(
    inputs.coilSubcoolingCoefficients_principal,
    discarded,
  );
  const axialFans = consolidateAxialFans(inputs, discarded);
  const centrifugalFans = consolidateCentrifugalFans(
    inputs.fanCentrifugal_data,
    inputs.fanCentrifugal_curves,
    discarded,
  );
  const coilDesignerCorrelations = consolidateCorrelations(
    inputs.vapcyc_coildesigner_correlations,
  );
  const heatExchangerCorrelations = consolidateCorrelations(inputs.vapcyc_hx_correlations);

  const output = {
    generatedAt,
    source: "UNILAB_COILS6_VAPCYC",
    coilCorrections,
    subcoolingCorrections,
    fans: {
      axial: axialFans,
      centrifugal: centrifugalFans,
    },
    correlations: {
      coilDesigner: coilDesignerCorrelations,
      heatExchanger: heatExchangerCorrelations,
    },
  };

  const report = {
    generatedAt,
    inputs: {
      coilCorrectionCoefficients_principal: inputs.coilCorrectionCoefficients_principal.length,
      coilSubcoolingCoefficients_principal: inputs.coilSubcoolingCoefficients_principal.length,
      fanAxial_type0_config1: inputs.fanAxial_type0_config1.length,
      fanAxial_type0_config2: inputs.fanAxial_type0_config2.length,
      fanAxial_type1_config1: inputs.fanAxial_type1_config1.length,
      fanAxial_type1_config2: inputs.fanAxial_type1_config2.length,
      fanCentrifugal_curves: inputs.fanCentrifugal_curves.length,
      fanCentrifugal_data: inputs.fanCentrifugal_data.length,
      vapcyc_coildesigner_correlations: inputs.vapcyc_coildesigner_correlations.length,
      vapcyc_hx_correlations: inputs.vapcyc_hx_correlations.length,
    },
    outputs: {
      coilCorrections: coilCorrections.length,
      subcoolingCorrections: subcoolingCorrections.length,
      fansAxial: axialFans.length,
      fansCentrifugal: centrifugalFans.length,
      coilDesignerCorrelations: coilDesignerCorrelations.length,
      heatExchangerCorrelations: heatExchangerCorrelations.length,
    },
    discarded,
    status: "OK",
  };

  await mkdir(catalogsDir, { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.info("Coeficientes UNILAB consolidados com sucesso.");
  console.info(`Arquivo: ${path.relative(rootDir, OUTPUT_FILE)}`);
  console.info(`Relatorio: ${path.relative(rootDir, REPORT_FILE)}`);
  console.info(JSON.stringify(report.outputs, null, 2));
  console.info(`Descartados: ${discarded.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
