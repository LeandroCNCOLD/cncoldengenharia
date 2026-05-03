import type {
  ARI540Coefficients,
  CompressorInputs,
  CompressorRecord,
} from "./compressorModel";
import { evaluateCompressor } from "./compressorModel";

export interface CompressorSearchParams {
  refrigerant: string;
  minCapacity_kW?: number;
  maxCapacity_kW?: number;
  Te_C: number;
  Tc_C: number;
  manufacturer?: "BITZER" | "COPELAND" | "EMBRACO" | string;
}

export interface CompressorSearchResult {
  compressor: CompressorRecord;
  estimated_Q_kW: number;
  estimated_W_kW: number;
  estimated_COP: number;
}

async function readJson<T>(url: string, fsPath: string): Promise<T> {
  try {
    const response = await fetch(url);
    return (await response.json()) as T;
  } catch {
    const [{ readFile }, { resolve }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    return JSON.parse(await readFile(resolve(process.cwd(), fsPath), "utf-8")) as T;
  }
}

export async function loadBitzerCatalog(): Promise<CompressorRecord[]> {
  const data = await readJson<{ compressors?: Array<Record<string, unknown>> }>(
    "/data/equipment/compressors_bitzer.json",
    "public/data/equipment/compressors_bitzer.json",
  );
  const compressors = Array.isArray(data.compressors) ? data.compressors : [];

  return compressors.map((c) => ({
    id: String(c.id),
    model: String(c.model ?? c.id),
    manufacturer: String(c.manufacturer ?? "BITZER"),
    refrigerant: String(c.refrigerant ?? ""),
    modelType: "bitzer_native" as const,
    bitzerNative: {
      displacement_m3h: Number(c.displacement_m3h ?? 0),
      coeff_lambda: toTriple(c.coeff_lambda),
      coeff_current: toTriple(c.coeff_current),
      coeff_specific_power: toTriple(c.coeff_specific_power),
      rpm: Number(c.rpm ?? 0),
    },
  }));
}

export async function loadCnCoilsCompressorCatalog(): Promise<CompressorRecord[]> {
  const data = await readJson<Array<Record<string, unknown>>>(
    "/data/catalogs/compressors.json",
    "public/data/catalogs/compressors.json",
  );
  const refMap: Record<number, string> = {
    7: "R22",
    9: "R32",
    16: "R125",
    18: "R134a",
    25: "R290",
    40: "R236fa",
    45: "iso-pentane",
  };

  return data.map((c) => {
    const refrigerantId = Number(c.refrigerantId);
    return {
      id: `CNCOILS_${String(c.id)}`,
      model: String(c.model ?? `Compressor_${String(c.id)}`),
      manufacturer: "CNCOILS",
      refrigerant: refMap[refrigerantId] ?? `ID_${refrigerantId}`,
      modelType: "ari540" as const,
      ari540: {
        ...toAri(c.capacityCoeffs as Record<string, unknown> | undefined, "c"),
        powerCoeffs: toAri(c.powerCoeffs as Record<string, unknown> | undefined, "p"),
        shRef: Number(c.shRef ?? 0),
        scRef: Number(c.scRef ?? 0),
        tcRef: Number(c.tcondRef ?? 0),
        teRef: Number(c.tevapRef ?? 0),
      },
    };
  });
}

export const loadUnilabCompressorCatalog = loadCnCoilsCompressorCatalog;

export async function searchCompressors(
  params: CompressorSearchParams,
): Promise<CompressorSearchResult[]> {
  const [bitzer, cncoils] = await Promise.all([
    loadBitzerCatalog(),
    loadCnCoilsCompressorCatalog(),
  ]);

  const inputs: CompressorInputs = {
    Te_C: params.Te_C,
    Tc_C: params.Tc_C,
    superheat_K: 5,
    subcooling_K: 5,
    refrigerantId: params.refrigerant,
  };

  const filtered = [...bitzer, ...cncoils].filter(
    (compressor) =>
      compressor.refrigerant.toLowerCase() === params.refrigerant.toLowerCase() &&
      (!params.manufacturer || compressor.manufacturer === params.manufacturer),
  );

  const evaluated = await Promise.all(
    filtered.slice(0, 200).map(async (compressor) => {
      const result = await evaluateCompressor(inputs, compressor);
      return {
        compressor,
        estimated_Q_kW: result.Q_evap_W / 1000,
        estimated_W_kW: result.W_comp_W / 1000,
        estimated_COP: result.COP,
      };
    }),
  );

  return evaluated
    .filter((item) => {
      if (params.minCapacity_kW !== undefined && item.estimated_Q_kW < params.minCapacity_kW) {
        return false;
      }
      if (params.maxCapacity_kW !== undefined && item.estimated_Q_kW > params.maxCapacity_kW) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.estimated_Q_kW - a.estimated_Q_kW)
    .slice(0, 20);
}

function toTriple(value: unknown): [number, number, number] {
  const arr = Array.isArray(value) ? value : [];
  return [Number(arr[0] ?? 0), Number(arr[1] ?? 0), Number(arr[2] ?? 0)];
}

function toAri(
  value: Record<string, unknown> | undefined,
  prefix: "c" | "p",
): Omit<ARI540Coefficients, "shRef" | "scRef" | "tcRef" | "teRef"> {
  const get = (i: number) => Number(value?.[`${prefix}${i}`] ?? 0);
  return {
    c1: get(1),
    c2: get(2),
    c3: get(3),
    c4: get(4),
    c5: get(5),
    c6: get(6),
    c7: get(7),
    c8: get(8),
    c9: get(9),
    c10: get(10),
  };
}
