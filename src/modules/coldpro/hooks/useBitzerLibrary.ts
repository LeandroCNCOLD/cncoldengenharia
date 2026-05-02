// Lazy-load do catálogo Bitzer (compressores) gerado a partir de
// INDEX.xlsx + EQUATIONS.xlsx (BitzerPlatform.db).
// Arquivo grande (~2 MB) — fica em /public/data/equipment/compressors_bitzer.json
// e é carregado sob demanda quando a aba Compressor é aberta.

import { useEffect, useState } from "react";

export interface BitzerCompressor {
  id: string;
  manufacturer: string;
  model: string;
  refrigerant: string;
  rpm: number | null;
  equation_type: string;
  formula: string;
  /** Volumetric efficiency / Lambda — primeiros 3 coef (C1..C3). */
  coeff_lambda: number[] | null;
  /** Current draw — C4..C6. */
  coeff_current: number[] | null;
  /** Specific power — C7..C9. */
  coeff_specific_power: number[] | null;
  /** Deslocamento volumétrico (m³/h) — C10. */
  C10_displacement: number | null;
  variants_count: number;
}

export interface BitzerLibraryPayload {
  source: string;
  count: number;
  manufacturers: string[];
  refrigerants: string[];
  rpms: number[];
  models_count: number;
  compressors: BitzerCompressor[];
}

export interface BitzerLibraryState {
  loading: boolean;
  error: string | null;
  data: BitzerCompressor[];
  meta: Omit<BitzerLibraryPayload, "compressors"> | null;
}

let cache: BitzerLibraryPayload | null = null;
let inflight: Promise<BitzerLibraryPayload> | null = null;

async function loadBitzer(): Promise<BitzerLibraryPayload> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/equipment/compressors_bitzer.json", { cache: "force-cache" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} carregando compressores Bitzer`);
      const json = (await res.json()) as BitzerLibraryPayload;
      cache = json;
      return json;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useBitzerLibrary(): BitzerLibraryState {
  const [state, setState] = useState<BitzerLibraryState>({
    loading: true,
    error: null,
    data: [],
    meta: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadBitzer()
      .then((payload) => {
        if (cancelled) return;
        const { compressors, ...meta } = payload;
        setState({ loading: false, error: null, data: compressors, meta });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          data: [],
          meta: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Polinômio bicúbico parcial usado pela Bitzer com 9 coeficientes:
 * Y(te,tc) = c0 + c1·te + c2·tc + c3·te² + c4·te·tc + c5·tc² + c6·te³ + c7·te²·tc + c8·te·tc²
 * (formato compacto BITZER_NATIVE — soma 10 coef. com Vh = C10)
 */
export function bitzerPolynomial9(coef: number[], te: number, tc: number): number {
  if (coef.length < 9) return Number.NaN;
  const [c0, c1, c2, c3, c4, c5, c6, c7, c8] = coef;
  return (
    c0 +
    c1 * te +
    c2 * tc +
    c3 * te * te +
    c4 * te * tc +
    c5 * tc * tc +
    c6 * te * te * te +
    c7 * te * te * tc +
    c8 * te * tc * tc
  );
}

/** Agrupa Bitzer por modelo. Cada modelo tem várias entradas (refrigerante × rpm). */
export function groupBitzerByModel(items: BitzerCompressor[]): Map<string, BitzerCompressor[]> {
  const map = new Map<string, BitzerCompressor[]>();
  for (const it of items) {
    if (!map.has(it.model)) map.set(it.model, []);
    map.get(it.model)!.push(it);
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
