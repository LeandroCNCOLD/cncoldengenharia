import { create } from "zustand";
import { persist } from "zustand/middleware";

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

interface CoilEnvelopeState {
  envelopes: Record<string, CoilEnvelope>;
  saveEnvelope: (envelope: CoilEnvelope) => void;
  getEnvelope: (componentType: string) => CoilEnvelope | undefined;
  clearEnvelope: (componentType: string) => void;
  clearAll: () => void;
  hasAllEnvelopes: () => boolean;
}

export const useCoilEnvelopeStore = create<CoilEnvelopeState>()(
  persist(
    (set, get) => ({
      envelopes: {},
      saveEnvelope: (envelope) =>
        set((state) => ({
          envelopes: { ...state.envelopes, [envelope.componentType]: envelope },
        })),
      getEnvelope: (componentType) => get().envelopes[componentType],
      clearEnvelope: (componentType) =>
        set((state) => {
          const { [componentType]: _, ...rest } = state.envelopes;
          return { envelopes: rest };
        }),
      clearAll: () => set({ envelopes: {} }),
      hasAllEnvelopes: () => {
        const envelopes = get().envelopes;
        return Boolean(
          envelopes.evaporator_dx &&
            envelopes.condenser_air &&
            envelopes.compressor,
        );
      },
    }),
    { name: "coil-envelope-store" },
  ),
);
