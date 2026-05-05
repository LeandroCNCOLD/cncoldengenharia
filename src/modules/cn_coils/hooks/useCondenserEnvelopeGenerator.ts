import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  type CondenserEnvelopePoint,
  useCoilEnvelopeStore,
} from "../store/useCoilEnvelopeStore";
import {
  type CondenserInputs,
  type CondenserResult,
} from "./useCondenserSimulation";

export interface UseCondenserEnvelopeGeneratorParams {
  inputs: CondenserInputs;
  calculate: (inputs: CondenserInputs) => CondenserResult | null;
}

export function useCondenserEnvelopeGenerator({
  inputs,
  calculate,
}: UseCondenserEnvelopeGeneratorParams) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [points, setPoints] = useState<CondenserEnvelopePoint[]>([]);
  const setCondenserEnvelope = useCoilEnvelopeStore((s) => s.setCondenserEnvelope);

  const generateEnvelope = useCallback(() => {
    setIsGenerating(true);
    try {
      const offsets = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
      const generated = offsets
        .map((offset) => {
          const Tc = inputs.Tc + offset;
          const result = calculate({ ...inputs, Tc });
          if (!result) return null;
          return {
            Tc,
            Q_cond_W: result.Q_cond_W,
            UA: result.UA,
            LMTD: result.LMTD,
            Tair_out: result.Tair_out,
          };
        })
        .filter((point): point is CondenserEnvelopePoint => point !== null);
      setPoints(generated);
      return generated;
    } finally {
      setIsGenerating(false);
    }
  }, [calculate, inputs]);

  const saveToStore = useCallback(() => {
    if (points.length === 0) {
      toast.error("Gere o envelope antes de salvar");
      return;
    }
    setCondenserEnvelope(points);
    void useCoilEnvelopeStore.getState().persistRemote();
    toast.success("✅ Envelope do condensador salvo — disponível na Bancada de Testes");
  }, [points, setCondenserEnvelope]);

  return { generateEnvelope, saveToStore, isGenerating, points };
}
