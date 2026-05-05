import { create } from "zustand";
import { persist } from "zustand/middleware";
import { testBenchConfigService } from "@/modules/coldpro_catalog/services/testBenchConfigService";

export interface EnvelopePoint {
  Te: number;
  Q_kcalh: number;
  W_kW: number;
  COP: number;
  deltaP_Pa: number;
  regime: "dry" | "wet" | "frost";
}

export interface FrostCurvePoint {
  t_h: number;
  Q_kcalh: number;
  thickness_mm: number;
}

export interface CoilEnvelope {
  equipmentId: string;
  componentType: "evaporator_dx" | "condenser_air" | "compressor";
  geometryId?: string;
  refrigerant: string;
  nominalConditions: {
    Te: number;
    Tc: number;
    T_ar: number;
    UR: number;
  };
  envelope: EnvelopePoint[];
  frostAnalysis?: {
    frostPoint_C: number;
    massRate_kgh: number;
    degradationCurve: FrostCurvePoint[];
    recommendedDefrostInterval_h: number;
    residualCapacityPct: number;
  };
  savedAt: string;
  version: 2;
}

export interface CondenserEnvelopePoint {
  Tc: number;
  Q_cond_W: number;
  UA: number;
  LMTD: number;
  Tair_out: number;
}

export interface CompressorEnvelopePoint {
  Te_C: number;
  Tc_C: number;
  Q_W: number;
  W_W: number;
  COP: number;
  massFlow_kgh: number;
  dischargeTemp_C: number;
}

interface CoilEnvelopeState {
  /** Equipamento atualmente em foco no fluxo bancada/workspace */
  currentEquipmentId: string | null;
  envelopes: Record<string, CoilEnvelope>;
  condenserEnvelope: CondenserEnvelopePoint[] | null;
  compressorEnvelope: CompressorEnvelopePoint[] | null;
  compressorId: string | null;
  compressorModel: string | null;
  setCurrentEquipmentId: (id: string | null) => void;
  saveEnvelope: (envelope: CoilEnvelope) => void;
  setEvaporatorEnvelope: (points: EnvelopePoint[]) => void;
  getEnvelope: (componentType: string) => CoilEnvelope | undefined;
  clearEnvelope: (componentType: string) => void;
  setCondenserEnvelope: (points: CondenserEnvelopePoint[]) => void;
  clearCondenserEnvelope: () => void;
  setCompressorEnvelope: (
    points: CompressorEnvelopePoint[],
    id: string,
    model: string,
  ) => void;
  clearCompressorEnvelope: () => void;
  clearAll: () => void;
  hasAllEnvelopes: () => boolean;
  /** Carrega configuração persistida no Supabase para o equipmentId */
  hydrateFromRemote: (equipmentId: string) => Promise<void>;
  /** Persiste estado atual no Supabase para o equipmentId atual */
  persistRemote: (equipmentIdOverride?: string) => Promise<void>;
}

export const useCoilEnvelopeStore = create<CoilEnvelopeState>()(
  persist(
    (set, get) => ({
      currentEquipmentId: null,
      envelopes: {},
      condenserEnvelope: null,
      compressorEnvelope: null,
      compressorId: null,
      compressorModel: null,
      setCurrentEquipmentId: (id) => set({ currentEquipmentId: id }),
      saveEnvelope: (envelope) =>
        set((state) => ({
          envelopes: { ...state.envelopes, [envelope.componentType]: envelope },
        })),
      setEvaporatorEnvelope: (points) =>
        set((state) => ({
          envelopes: {
            ...state.envelopes,
            evaporator_dx: {
              equipmentId: "restored-project",
              componentType: "evaporator_dx",
              refrigerant: "R404A",
              nominalConditions: { Te: -10, Tc: 40, T_ar: 5, UR: 0.85 },
              envelope: points,
              savedAt: new Date().toISOString(),
              version: 2,
            },
          },
        })),
      getEnvelope: (componentType) => get().envelopes[componentType],
      clearEnvelope: (componentType) =>
        set((state) => {
          const { [componentType]: _, ...rest } = state.envelopes;
          return { envelopes: rest };
        }),
      setCondenserEnvelope: (points) => set({ condenserEnvelope: points }),
      clearCondenserEnvelope: () => set({ condenserEnvelope: null }),
      setCompressorEnvelope: (points, id, model) =>
        set({
          compressorEnvelope: points,
          compressorId: id,
          compressorModel: model,
        }),
      clearCompressorEnvelope: () =>
        set({
          compressorEnvelope: null,
          compressorId: null,
          compressorModel: null,
        }),
      clearAll: () =>
        set({
          envelopes: {},
          condenserEnvelope: null,
          compressorEnvelope: null,
          compressorId: null,
          compressorModel: null,
        }),
      hasAllEnvelopes: () => {
        const envelopes = get().envelopes;
        return Boolean(
          envelopes.evaporator_dx &&
            (envelopes.condenser_air || get().condenserEnvelope) &&
            (envelopes.compressor || get().compressorEnvelope),
        );
      },
      hydrateFromRemote: async (equipmentId) => {
        if (!equipmentId) return;
        const row = await testBenchConfigService.load(equipmentId);
        set({ currentEquipmentId: equipmentId });
        if (!row) return;
        set((state) => ({
          envelopes: row.evaporator_envelope
            ? { ...state.envelopes, evaporator_dx: row.evaporator_envelope as CoilEnvelope }
            : state.envelopes,
          condenserEnvelope: (row.condenser_envelope as CondenserEnvelopePoint[] | null) ?? state.condenserEnvelope,
          compressorEnvelope: (row.compressor_envelope as CompressorEnvelopePoint[] | null) ?? state.compressorEnvelope,
          compressorId: row.compressor_id ?? state.compressorId,
          compressorModel: row.compressor_model ?? state.compressorModel,
        }));
      },
      persistRemote: async (equipmentIdOverride) => {
        const state = get();
        const equipmentId = equipmentIdOverride ?? state.currentEquipmentId;
        if (!equipmentId) return;
        await testBenchConfigService.save(equipmentId, {
          evaporator_envelope: state.envelopes.evaporator_dx ?? null,
          condenser_envelope: state.condenserEnvelope,
          compressor_envelope: state.compressorEnvelope,
          compressor_id: state.compressorId,
          compressor_model: state.compressorModel,
        });
      },
    }),
    { name: "coil-envelope-store" },
  ),
);
