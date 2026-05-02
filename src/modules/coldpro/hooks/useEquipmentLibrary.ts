// Lazy-load das bibliotecas de equipamentos (compressors / fans) via fetch.
// Os JSONs ficam em /public/data/equipment/ — nunca importados pelo bundle.

import { useEffect, useState } from "react";

export interface LibraryCompressor {
  id: string;
  source: string;
  manufacturer: string;
  model: string;
  type?: string;
  refrigerant: string[];
  application_type?: string;
  cooling_capacity_kw: number;
  cooling_capacity_kcal_h?: number;
  power_input_kw: number;
  cop?: number;
  min_evap_temp_c?: number;
  max_evap_temp_c?: number;
  min_cond_temp_c?: number;
  max_cond_temp_c?: number;
  nominal_conditions?: {
    te_c?: number;
    tc_c?: number;
    subcooling_k?: number;
    superheat_k?: number;
  };
  capacity_coefficients?: number[];
  power_coefficients?: number[];
  coefficient_units?: string;
  standard?: string;
  data_quality?: string;
}

export interface LibraryFan {
  id: string;
  source: string;
  manufacturer: string;
  model: string;
  sph_coefficients: number[];
  power_coefficients: number[];
  coefficient_count: number;
  data_quality?: string;
}

export interface EquipmentLibraryState<T> {
  loading: boolean;
  error: string | null;
  data: T[];
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} carregando ${url}`);
  const json = (await res.json()) as T[];
  if (!Array.isArray(json)) throw new Error(`Conteúdo inválido em ${url}`);
  return json;
}

export function useCompressorLibrary(): EquipmentLibraryState<LibraryCompressor> {
  const [state, setState] = useState<EquipmentLibraryState<LibraryCompressor>>({
    loading: true,
    error: null,
    data: [],
  });

  useEffect(() => {
    let cancelled = false;
    fetchJson<LibraryCompressor>("/data/equipment/compressors.json")
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          data: [],
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useFanLibrary(): EquipmentLibraryState<LibraryFan> {
  const [state, setState] = useState<EquipmentLibraryState<LibraryFan>>({
    loading: true,
    error: null,
    data: [],
  });

  useEffect(() => {
    let cancelled = false;
    fetchJson<LibraryFan>("/data/equipment/fans.json")
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          data: [],
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Agrupa por fabricante, ordenado alfabeticamente. */
export function groupByManufacturer<T extends { manufacturer: string }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = it.manufacturer || "Desconhecido";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
