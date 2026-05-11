/**
 * useApplicationEngineering.ts
 *
 * Zustand store para o módulo Application Engineering.
 * Orquestra o fluxo completo: ponto de operação → compressor → coils → validação.
 */
import { create } from "zustand";
import { resolveOperatingPoint } from "../services/operatingPointService";
import { sizeEvaporator, sizeCondenser } from "../services/coilSizingService";
import { selectFan } from "../services/fanSelectionService";
import { validateSystem } from "../services/applicationValidationService";
import {
  loadCompressorIndex,
  loadManufacturerData,
} from "@/modules/coldpro_catalog/data/compressorCatalog.service";
import {
  evaluateCompressorAtPoint,
} from "../services/compressorPerformanceService";
import type { CompressorRecord } from "@/modules/coldpro_catalog/engines/compressorSelector";
import type {
  ApplicationEngineeringState,
  OperatingPointInput,
  CompressorSelectionInput,
  EvaporatorSizingInput,
  CondenserSizingInput,
  CompressorSelectionResult,
  EvaporatorSizingResult,
  CondenserSizingResult,
} from "../types/application-engineering.types";

// ─── Estado inicial ───────────────────────────────────────────────────────────

const INITIAL_STATE: ApplicationEngineeringState = {
  operatingPointInput: {
    mode: "B",
    t_room_c: -18,
    t_ambient_c: 32,
    dt_evap_k: 8,
    dt_cond_k: 12,
    superheat_k: 10,
    subcooling_k: 5,
  },
  operatingPointResult: null,

  compressorInput: {
    refrigerant: "R404A",
    required_capacity_w: 5000,
    application: "LT",
  },
  compressorResult: null,

  evaporatorInput: {
    required_capacity_w: 5000,
    t_air_in_c: -15,
    rh_air_pct: 85,
    airflow_m3h: 1800,
    rows: 4,
    tubes_per_row: 20,
    fin_spacing_mm: 4.5,
    length_mm: 1000,
    tube_diameter_mm: 9.52,
    circuits: 4,
  },
  evaporatorResult: null,

  condenserInput: {
    t_ambient_c: 32,
    airflow_m3h: 4000,
    rows: 2,
    tubes_per_row: 20,
    fin_spacing_mm: 2.0,
    length_mm: 1200,
    tube_diameter_mm: 9.52,
    circuits: 2,
  },
  condenserResult: null,

  evapFanResult: null,
  condFanResult: null,
  validationResult: null,

  isCalculating: false,
  lastError: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface ApplicationEngineeringStore extends ApplicationEngineeringState {
  setOperatingPointInput: (input: OperatingPointInput) => void;
  setCompressorInput: (input: Partial<CompressorSelectionInput>) => void;
  setEvaporatorInput: (input: Partial<EvaporatorSizingInput>) => void;
  setCondenserInput: (input: Partial<CondenserSizingInput>) => void;
  runCalculation: () => Promise<void>;
  reset: () => void;
}

export const useApplicationEngineering = create<ApplicationEngineeringStore>(
  (set, get) => ({
    ...INITIAL_STATE,

    setOperatingPointInput: (input) => set({ operatingPointInput: input }),

    setCompressorInput: (input) =>
      set((s) => ({
        compressorInput: { ...s.compressorInput, ...input },
      })),

    setEvaporatorInput: (input) =>
      set((s) => ({
        evaporatorInput: { ...s.evaporatorInput, ...input },
      })),

    setCondenserInput: (input) =>
      set((s) => ({
        condenserInput: { ...s.condenserInput, ...input },
      })),

    runCalculation: async () => {
      set({ isCalculating: true, lastError: null });

      try {
        const state = get();

        // 1. Resolver ponto de operação
        const opResult = resolveOperatingPoint(state.operatingPointInput);
        set({ operatingPointResult: opResult });

        // 2. Selecionar compressor
        const compInput = state.compressorInput;
        let compResult: CompressorSelectionResult | null = null;

        if (compInput.refrigerant && compInput.required_capacity_w) {
          try {
            const index = await loadCompressorIndex();
            // Filtrar por refrigerante e aplicação
            const filtered = index.filter((r) => {
              const refMatch =
                !compInput.refrigerant ||
                r.refrigerant === compInput.refrigerant ||
                (r.all_refrigerants ?? []).includes(compInput.refrigerant ?? "");
              const appMatch =
                !compInput.application || r.application === compInput.application;
              return refMatch && appMatch;
            });

            // Carregar dados completos dos primeiros 3 fabricantes encontrados
            const manufacturers = [
              ...new Set(filtered.slice(0, 50).map((r) => r.manufacturer)),
            ].slice(0, 3) as Array<"Copeland" | "Bitzer" | "Danfoss" | "Dorin">;

            const records: CompressorRecord[] = [];
            for (const mfr of manufacturers) {
              try {
                const data = await loadManufacturerData(mfr);
                const matching = data.filter((r) => {
                  const refMatch =
                    !compInput.refrigerant ||
                    r.refrigerant === compInput.refrigerant ||
                    (r.all_refrigerants ?? []).includes(compInput.refrigerant ?? "");
                  const appMatch =
                    !compInput.application || r.application === compInput.application;
                  return refMatch && appMatch;
                });
                records.push(
                  ...matching.slice(0, 20).map((r) => ({
                    id: r.id,
                    model: r.model,
                    manufacturer: r.manufacturer,
                    refrigerant: r.all_refrigerants ?? [r.refrigerant],
                    cooling_capacity_kw: r.nominal_cooling_capacity_w
                      ? r.nominal_cooling_capacity_w / 1000
                      : undefined,
                    power_input_kw: r.nominal_power_w
                      ? r.nominal_power_w / 1000
                      : undefined,
                    min_evap_temp_c: r.min_evap_temp_c ?? undefined,
                    max_evap_temp_c: r.max_evap_temp_c ?? undefined,
                    min_cond_temp_c: r.min_cond_temp_c ?? undefined,
                    max_cond_temp_c: r.max_cond_temp_c ?? undefined,
                  })),
                );
              } catch {
                // Ignorar erros de carregamento de fabricante individual
              }
            }

            if (records.length > 0) {
              const selInput = {
                refrigerant: compInput.refrigerant,
                operating_point: opResult,
                required_capacity_w: compInput.required_capacity_w,
                application: compInput.application,
              };

              // Avaliar todos e selecionar o melhor
              const evaluated = records
                .map((r) => evaluateCompressorAtPoint(r, selInput))
                .filter((r) => r.capacity_w > 0)
                .sort((a, b) => {
                  const excessA = Math.abs(a.capacity_w - selInput.required_capacity_w);
                  const excessB = Math.abs(b.capacity_w - selInput.required_capacity_w);
                  return excessA - excessB;
                });

              compResult = evaluated[0] ?? null;
            }
          } catch (e) {
            // Fallback: usar dados nominais
            compResult = {
              model: "Compressor Nominal",
              manufacturer: "—",
              capacity_w: compInput.required_capacity_w ?? 5000,
              power_w: (compInput.required_capacity_w ?? 5000) / 2.5,
              cop_compressor: 2.5,
              te_used_c: opResult.te_c,
              tc_used_c: opResult.tc_c,
              current_a: null,
              status: "ok_nominal",
              warnings: [`Catálogo indisponível: ${String(e)}`],
            };
          }
        }

        set({ compressorResult: compResult });

        // 3. Dimensionar evaporador
        const evapInput = state.evaporatorInput;
        let evapResult: EvaporatorSizingResult | null = null;

        if (
          evapInput.required_capacity_w &&
          evapInput.t_air_in_c !== undefined &&
          evapInput.airflow_m3h
        ) {
          evapResult = await sizeEvaporator({
            required_capacity_w: evapInput.required_capacity_w,
            te_c: opResult.te_c,
            refrigerant: compInput.refrigerant ?? "R404A",
            t_air_in_c: evapInput.t_air_in_c,
            rh_air_pct: evapInput.rh_air_pct,
            airflow_m3h: evapInput.airflow_m3h,
            rows: evapInput.rows,
            tubes_per_row: evapInput.tubes_per_row,
            fin_spacing_mm: evapInput.fin_spacing_mm,
            length_mm: evapInput.length_mm,
            tube_diameter_mm: evapInput.tube_diameter_mm,
            circuits: evapInput.circuits,
          });
        }

        set({ evaporatorResult: evapResult });

        // 4. Dimensionar condensador
        const condInput = state.condenserInput;
        let condResult: CondenserSizingResult | null = null;
        const heatRejectionW = compResult
          ? (evapResult?.capacity_w ?? compInput.required_capacity_w ?? 5000) +
            compResult.power_w
          : (compInput.required_capacity_w ?? 5000) * 1.4;

        if (condInput.airflow_m3h && condInput.t_ambient_c !== undefined) {
          condResult = await sizeCondenser({
            heat_rejection_w: heatRejectionW,
            tc_c: opResult.tc_c,
            t_ambient_c: condInput.t_ambient_c,
            airflow_m3h: condInput.airflow_m3h,
            refrigerant: compInput.refrigerant ?? "R404A",
            rows: condInput.rows,
            tubes_per_row: condInput.tubes_per_row,
            fin_spacing_mm: condInput.fin_spacing_mm,
            length_mm: condInput.length_mm,
            tube_diameter_mm: condInput.tube_diameter_mm,
            circuits: condInput.circuits,
          });
        }

        set({ condenserResult: condResult });

        // 5. Selecionar ventiladores
        const evapFan = evapInput.airflow_m3h
          ? selectFan({
              airflow_m3h: evapInput.airflow_m3h,
              static_pressure_pa: evapResult?.dp_air_pa ?? 100,
              application_type: "evaporator",
            })
          : null;

        const condFan = condInput.airflow_m3h
          ? selectFan({
              airflow_m3h: condInput.airflow_m3h,
              static_pressure_pa: condResult?.dp_air_pa ?? 150,
              application_type: "condenser",
            })
          : null;

        set({ evapFanResult: evapFan, condFanResult: condFan });

        // 6. Validar sistema
        let validationResult = null;
        if (compResult && evapResult && condResult) {
          validationResult = validateSystem({
            compressor: compResult,
            evaporator: evapResult,
            condenser: condResult,
            required_capacity_w: compInput.required_capacity_w ?? 5000,
          });
        }

        set({ validationResult, isCalculating: false });
      } catch (e) {
        set({
          isCalculating: false,
          lastError: String(e),
        });
      }
    },

    reset: () => set(INITIAL_STATE),
  }),
);
