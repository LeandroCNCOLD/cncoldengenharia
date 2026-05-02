// Lazy-load dos catálogos UNILAB via fetch().
// Nunca importa JSON pelo bundle. Falhas viram erros expostos ao consumidor —
// nunca substituídas por mocks ou defaults.

import { useEffect, useState } from "react";
import type {
  AirVelocityCorrectionItem,
  CatalogLoadState,
  CoilGeometryCatalogItem,
  FinPitchItem,
  FinThicknessItem,
  PressureDropFanItem,
  RefrigerantItem,
  TubeMaterialItem,
} from "../types/unilab.types";

const CATALOG_FILES = {
  coilGeometries: "coilGeometries.json",
  tubeMaterials: "tubeMaterials.json",
  finPitches: "finPitches.json",
  finThicknesses: "finThicknesses.json",
  refrigerantsPure: "refrigerantsPure.json",
  refrigerantsMixtures: "refrigerantsMixtures.json",
  coilCorrectionCoefficients: "coilCorrectionCoefficients.json",
  pressureDropFan: "pressureDropFan.json",
} as const;

export const REQUIRED_CATALOG_FILES = Object.values(CATALOG_FILES);

export interface UnilabCatalogs {
  geometries: CoilGeometryCatalogItem[];
  tubeMaterials: TubeMaterialItem[];
  finPitches: FinPitchItem[];
  finThicknesses: FinThicknessItem[];
  refrigerants: RefrigerantItem[];
  correctionCoefficients: AirVelocityCorrectionItem[];
  pressureDropFan: PressureDropFanItem[];
}

const EMPTY_CATALOGS: UnilabCatalogs = {
  geometries: [],
  tubeMaterials: [],
  finPitches: [],
  finThicknesses: [],
  refrigerants: [],
  correctionCoefficients: [],
  pressureDropFan: [],
};

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`/data/catalogs/${file}`, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function ensureArray<T>(value: unknown, file: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Conteúdo inválido em ${file}: esperado array.`);
  }
  return value as T[];
}

export interface UseUnilabCatalogsReturn extends UnilabCatalogs, CatalogLoadState {}

export function useUnilabCatalogs(): UseUnilabCatalogsReturn {
  const [data, setData] = useState<UnilabCatalogs>(EMPTY_CATALOGS);
  const [state, setState] = useState<CatalogLoadState>({
    loading: true,
    ready: false,
    errors: {},
    missing: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const errors: Record<string, string> = {};
      const missing: string[] = [];
      const next: UnilabCatalogs = { ...EMPTY_CATALOGS };

      const tasks: Array<[keyof UnilabCatalogs, string, (raw: unknown) => unknown]> = [
        [
          "geometries",
          CATALOG_FILES.coilGeometries,
          (raw) => ensureArray<CoilGeometryCatalogItem>(raw, CATALOG_FILES.coilGeometries),
        ],
        [
          "tubeMaterials",
          CATALOG_FILES.tubeMaterials,
          (raw) => ensureArray<TubeMaterialItem>(raw, CATALOG_FILES.tubeMaterials),
        ],
        [
          "finPitches",
          CATALOG_FILES.finPitches,
          (raw) => {
            const arr = ensureArray<Record<string, unknown>>(raw, CATALOG_FILES.finPitches);
            return arr.map((r): FinPitchItem => {
              // Aceita tanto o shape novo (UNILAB IT) quanto o legado.
              const pitch =
                typeof r.PassoAletta === "number"
                  ? r.PassoAletta
                  : typeof r.pitchMm === "number"
                    ? r.pitchMm
                    : Number(r.PassoAletta ?? r.pitchMm ?? 0);
              const id = String(r.PassiAletteID ?? r.id ?? pitch);
              const fpi =
                typeof r.FinsPerInch === "number" ? r.FinsPerInch : undefined;
              return {
                id,
                pitchMm: pitch,
                label:
                  typeof r.label === "string"
                    ? r.label
                    : `${pitch} mm${fpi ? ` (${fpi} FPI)` : ""}`,
              };
            });
          },
        ],
        [
          "finThicknesses",
          CATALOG_FILES.finThicknesses,
          (raw) => {
            const arr = ensureArray<Record<string, unknown>>(raw, CATALOG_FILES.finThicknesses);
            return arr.map((r): FinThicknessItem => {
              const thickness =
                typeof r.SpessoreAletta === "number"
                  ? r.SpessoreAletta
                  : typeof r.thicknessMm === "number"
                    ? r.thicknessMm
                    : Number(r.SpessoreAletta ?? r.thicknessMm ?? 0);
              const id = String(r.SpessoreAlettaID ?? r.id ?? thickness);
              return {
                id,
                thicknessMm: thickness,
                label: typeof r.label === "string" ? r.label : `${thickness} mm`,
              };
            });
          },
        ],
        [
          "correctionCoefficients",
          CATALOG_FILES.coilCorrectionCoefficients,
          (raw) =>
            ensureArray<AirVelocityCorrectionItem>(
              raw,
              CATALOG_FILES.coilCorrectionCoefficients,
            ),
        ],
        [
          "pressureDropFan",
          CATALOG_FILES.pressureDropFan,
          (raw) => ensureArray<PressureDropFanItem>(raw, CATALOG_FILES.pressureDropFan),
        ],
      ];

      // Carrega arrays simples
      for (const [key, file, parse] of tasks) {
        try {
          const raw = await fetchJson<unknown>(file);
          (next as unknown as Record<string, unknown>)[key] = parse(raw);
        } catch (err) {
          errors[file] = err instanceof Error ? err.message : String(err);
          missing.push(file);
        }
      }

      // Refrigerantes: combina puros + misturas em uma lista única, marcando kind
      try {
        const pure = await fetchJson<unknown>(CATALOG_FILES.refrigerantsPure);
        const pureArr = ensureArray<Record<string, unknown>>(
          pure,
          CATALOG_FILES.refrigerantsPure,
        );
        next.refrigerants.push(
          ...pureArr.map((r) => ({
            id: String(r.id ?? r.name ?? ""),
            name: String(r.name ?? r.id ?? ""),
            kind: "pure" as const,
            raw: r,
          })),
        );
      } catch (err) {
        errors[CATALOG_FILES.refrigerantsPure] =
          err instanceof Error ? err.message : String(err);
        missing.push(CATALOG_FILES.refrigerantsPure);
      }

      try {
        const mix = await fetchJson<unknown>(CATALOG_FILES.refrigerantsMixtures);
        const mixArr = ensureArray<Record<string, unknown>>(
          mix,
          CATALOG_FILES.refrigerantsMixtures,
        );
        next.refrigerants.push(
          ...mixArr.map((r) => ({
            id: String(r.id ?? r.name ?? ""),
            name: String(r.name ?? r.id ?? ""),
            kind: "mixture" as const,
            raw: r,
          })),
        );
      } catch (err) {
        errors[CATALOG_FILES.refrigerantsMixtures] =
          err instanceof Error ? err.message : String(err);
        missing.push(CATALOG_FILES.refrigerantsMixtures);
      }

      if (cancelled) return;

      setData(next);
      setState({
        loading: false,
        ready: missing.length === 0,
        errors,
        missing,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, ...state };
}
