import { useCallback, useState } from "react";
import { toast } from "sonner";
import { evaluateCompressor } from "../engines/compressor/compressorModel";
import type { CompressorRecord } from "../engines/compressor/compressorModel";
import { useCoilEnvelopeStore } from "../store/useCoilEnvelopeStore";
import type { CycleResult, CycleSystemConfig } from "../engines/cycle/cycleTypes";

export interface CompressorWorkspaceInputs {
  compressorId: string;
  compressorModel: string;
  compressorBrand: string;
  Te_C: number;
  Tc_C: number;
  Tsuperheating_K: number;
  Tsubcooling_K: number;
  refrigerant: string;
  voltage_V: number;
  frequency_Hz: number;
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

interface UseCompressorEnvelopeGeneratorParams {
  inputs: CompressorWorkspaceInputs;
  compressor: CompressorRecord | null;
}

export interface UseCompressorEnvelopeGeneratorResult {
  points: CompressorEnvelopePoint[];
  isGenerating: boolean;
  generate: () => void;
  saveToTestBench: () => void;
}

const TE_POINTS = [-30, -25, -20, -15, -10, -5, 0, 5, 10];
const TC_POINTS = [35, 40, 45, 50, 55];

export function estimateDischargeTempC(
  Te_C: number,
  Tc_C: number,
  superheatK: number,
  compressionRatio = Math.max(1, (Tc_C + 273.15) / Math.max(Te_C + 273.15, 1)),
): number {
  const suctionK = Te_C + superheatK + 273.15;
  const gamma = 1.15;
  const etaIs = 0.7;
  const isentropicK = suctionK * Math.pow(Math.max(compressionRatio, 1), (gamma - 1) / gamma);
  return suctionK + (isentropicK - suctionK) / etaIs - 273.15;
}

export function estimateCompressorMetrics(
  result: CycleResult | null,
  inputs: CompressorWorkspaceInputs,
) {
  const compressionRatio = result?.compressorResult.compressionRatio ?? 1;
  return {
    dischargeTemp_C: estimateDischargeTempC(
      inputs.Te_C,
      inputs.Tc_C,
      inputs.Tsuperheating_K,
      compressionRatio,
    ),
    massFlow_kgh: (result?.m_dot_kgS ?? 0) * 3600,
    W_W: result?.W_comp_W ?? 0,
    current_A:
      inputs.voltage_V > 0
        ? (result?.W_comp_W ?? 0) / (inputs.voltage_V * Math.sqrt(3) * 0.85)
        : 0,
    powerFactor: 0.85,
    volumetricEfficiency: Math.max(0.35, Math.min(0.95, 0.82 - (compressionRatio - 3) * 0.035)),
  };
}

export function buildCompressorCycleConfig(
  inputs: CompressorWorkspaceInputs,
  compressor: CompressorRecord,
): CycleSystemConfig {
  return {
    id: `compressor-${inputs.compressorId || "manual"}`,
    name: "Workspace Compressor",
    refrigerantId: inputs.refrigerant,
    compressor,
    evaporator: {
      physical: {
        rows: 4,
        finnedLengthMm: 1250,
        finnedHeightMm: 400,
        finPitchMm: 6,
        tubePitchTransversalMm: 38.1,
        tubePitchLongitudinalMm: 33,
        tubeExternalDiameterMm: 12.7,
        tubeInternalDiameterMm: 11.5,
        tubesPerRow: 10,
        circuits: 5,
        finThicknessMm: 0.15,
        finType: "plain",
      },
      airInletTempC: 5,
      airRelativeHumidity: 0.85,
      airFlowM3H: 5000,
      superheatK: inputs.Tsuperheating_K,
      subcoolingK: inputs.Tsubcooling_K,
      htCatalog: {},
      tubeMaterialConductivity: 385,
    },
    condenser: {
      physical: {
        rows: 2,
        finnedLengthMm: 900,
        finnedHeightMm: 650,
        finPitchMm: 3,
        tubePitchTransversalMm: 25.4,
        tubePitchLongitudinalMm: 22,
        tubeExternalDiameterMm: 9.52,
        tubeInternalDiameterMm: 8.5,
        tubesPerRow: 24,
        circuits: 4,
        finThicknessMm: 0.1,
        finType: "plain",
      },
      airInletTempC: 35,
      airRelativeHumidity: 0.5,
      airFlowM3H: 8000,
      superheatK: 0,
      subcoolingK: inputs.Tsubcooling_K,
      htCatalog: {},
      tubeMaterialConductivity: 385,
    },
    expansionDevice: {
      type: "txv",
      superheatTarget_K: inputs.Tsuperheating_K,
      subcoolingK: inputs.Tsubcooling_K,
    },
    solver: {
      Te_initial_C: inputs.Te_C,
      Tc_initial_C: inputs.Tc_C,
      tolerance: 0.01,
      maxIterations: 12,
      relaxation: 0.25,
    },
  };
}

export function useCompressorEnvelopeGenerator({
  inputs,
  compressor,
}: UseCompressorEnvelopeGeneratorParams): UseCompressorEnvelopeGeneratorResult {
  const [points, setPoints] = useState<CompressorEnvelopePoint[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const setCompressorEnvelope = useCoilEnvelopeStore((s) => s.setCompressorEnvelope);

  const generate = useCallback(() => {
    if (!compressor) {
      toast.error("Selecione um compressor antes de gerar o envelope");
      return;
    }
    setIsGenerating(true);
    void (async () => {
      try {
        const generated: CompressorEnvelopePoint[] = [];
        for (const Tc_C of TC_POINTS) {
          for (const Te_C of TE_POINTS) {
            if (Te_C >= Tc_C - 5) continue;
            const result = await evaluateCompressor(
              {
                Te_C,
                Tc_C,
                superheat_K: inputs.Tsuperheating_K,
                subcooling_K: inputs.Tsubcooling_K,
                refrigerantId: inputs.refrigerant,
              },
              compressor,
            );
            if (result.Q_evap_W <= 0 || result.W_comp_W <= 0) continue;
            generated.push({
              Te_C,
              Tc_C,
              Q_W: result.Q_evap_W,
              W_W: result.W_comp_W,
              COP: result.COP,
              massFlow_kgh: result.m_dot_kgS * 3600,
              dischargeTemp_C: estimateDischargeTempC(
                Te_C,
                Tc_C,
                inputs.Tsuperheating_K,
                result.compressionRatio,
              ),
            });
          }
        }
        setPoints(generated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao gerar envelope do compressor");
      } finally {
        setIsGenerating(false);
      }
    })();
  }, [compressor, inputs.Tsubcooling_K, inputs.Tsuperheating_K, inputs.refrigerant]);

  const saveToTestBench = useCallback(() => {
    if (points.length === 0) {
      toast.error("Gere o envelope antes de salvar");
      return;
    }
    setCompressorEnvelope(points, inputs.compressorId, inputs.compressorModel);
    void useCoilEnvelopeStore.getState().persistRemote();
    toast.success("✅ Envelope do compressor salvo — disponível na Bancada de Testes");
  }, [inputs.compressorId, inputs.compressorModel, points, setCompressorEnvelope]);

  return { points, isGenerating, generate, saveToTestBench };
}
