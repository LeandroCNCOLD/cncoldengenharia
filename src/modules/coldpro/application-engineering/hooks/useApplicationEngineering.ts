/**
 * useApplicationEngineering.ts
 *
 * Zustand store para o módulo Application Engineering.
 * Orquestra o fluxo completo: ponto de operação → compressor → coils → validação.
 *
 * Lógica de cobertura de pontos (v2):
 *   - Após selecionar o compressor, gera a grade Te×Tc completa
 *   - Para cada ponto avalia se o evaporador e o condensador atendem
 *   - Armazena compressorOperatingPoints + evaporatorCoverageRatio + condenserCoverageRatio
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
import {
  evaluateCompressorAtPoint as evalAtPointRaw,
  generateOperatingGrid,
} from "@/modules/coldpro_catalog/engines/compressorSelector";
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
  CompressorOperatingPoint,
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

  compressorOperatingPoints: null,
  evaporatorCoverageRatio: null,
  condenserCoverageRatio: null,

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
        let selectedRecord: CompressorRecord | null = null;

        if (compInput.refrigerant && compInput.required_capacity_w) {
          try {
            const index = await loadCompressorIndex();
            const filtered = index.filter((r) => {
              const refMatch =
                !compInput.refrigerant ||
                r.refrigerant === compInput.refrigerant ||
                (r.all_refrigerants ?? []).includes(compInput.refrigerant ?? "");
              const appMatch =
                !compInput.application || r.application === compInput.application;
              return refMatch && appMatch;
            });

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
                    capacity_coefficients: r.capacity_coefficients,
                    power_coefficients: r.power_coefficients,
                    current_coefficients: r.current_coefficients,
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

              const evaluated = records
                .map((r) => ({ result: evaluateCompressorAtPoint(r, selInput), record: r }))
                .filter((e) => e.result.capacity_w > 0)
                .sort((a, b) => {
                  const excessA = Math.abs(a.result.capacity_w - selInput.required_capacity_w);
                  const excessB = Math.abs(b.result.capacity_w - selInput.required_capacity_w);
                  return excessA - excessB;
                });

              if (evaluated.length > 0) {
                compResult = evaluated[0].result;
                selectedRecord = evaluated[0].record;
              }
            }
          } catch (e) {
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

        // 3. Dimensionar evaporador no ponto de design
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

        // 4. Dimensionar condensador no ponto de design
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

        // 5. Varredura de pontos Te×Tc para cobertura
        let compressorOperatingPoints: CompressorOperatingPoint[] | null = null;
        let evaporatorCoverageRatio: number | null = null;
        let condenserCoverageRatio: number | null = null;

        if (selectedRecord && evapResult && condResult) {
          try {
            // Grade: Te de (opResult.te_c - 10) a (opResult.te_c + 5), passo 2.5 K
            //        Tc de (opResult.tc_c - 5) a (opResult.tc_c + 15), passo 2.5 K
            const teMin = Math.round((opResult.te_c - 10) * 2) / 2;
            const teMax = Math.round((opResult.te_c + 5) * 2) / 2;
            const tcMin = Math.round((opResult.tc_c - 5) * 2) / 2;
            const tcMax = Math.round((opResult.tc_c + 15) * 2) / 2;
            const grid = generateOperatingGrid(
              [teMin, teMax, 2.5],
              [tcMin, tcMax, 2.5],
            );

            // Para cada ponto da grade, avaliar compressor e verificar coils
            const points: CompressorOperatingPoint[] = [];
            for (const { te, tc } of grid) {
              const evalComp = evalAtPointRaw(selectedRecord, te, tc);
              const compCapW = evalComp.cooling_capacity_kw * 1000;
              const compPowW = evalComp.power_input_kw * 1000;
              const heatRejW = compCapW + compPowW;

              // Verificar evaporador: capacidade calculada no ponto >= capacidade do compressor × 0.95
              const evapMeets = evapResult.capacity_w >= compCapW * 0.95;

              // Verificar condensador: calor rejeitado calculado >= heatRejW × 0.95
              const condMeets = condResult.heat_rejection_w >= heatRejW * 0.95;

              points.push({
                te_c: te,
                tc_c: tc,
                comp_capacity_w: compCapW,
                comp_power_w: compPowW,
                evap_capacity_w: evapResult.capacity_w,
                cond_heat_rejection_w: condResult.heat_rejection_w,
                evap_meets: evapMeets,
                cond_meets: condMeets,
              });
            }

            compressorOperatingPoints = points;
            const total = points.length;
            if (total > 0) {
              evaporatorCoverageRatio = points.filter((p) => p.evap_meets).length / total;
              condenserCoverageRatio = points.filter((p) => p.cond_meets).length / total;
            }
          } catch {
            // Varredura falhou — não bloquear o restante do cálculo
          }
        }

        set({ compressorOperatingPoints, evaporatorCoverageRatio, condenserCoverageRatio });

        // 6. Selecionar ventiladores
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

        // 7. Validar sistema
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
