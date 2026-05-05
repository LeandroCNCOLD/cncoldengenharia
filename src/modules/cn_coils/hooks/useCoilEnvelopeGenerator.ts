import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  type CoilEnvelope,
  type EnvelopePoint,
  type FrostCurvePoint,
  useCoilEnvelopeStore,
} from "../store/useCoilEnvelopeStore";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";

function capacityKwToKcalH(kw: number): number {
  return kw * 1000 * 0.86;
}

function inferRegime(Te: number, airTempC: number, rhPct: number): EnvelopePoint["regime"] {
  const surfaceTempC = Te + 3;
  const dewPointApproxC = airTempC - (100 - rhPct) / 5;
  const frostPointC = dewPointApproxC - 2;
  if (surfaceTempC < frostPointC) return "frost";
  if (surfaceTempC < dewPointApproxC) return "wet";
  return "dry";
}

function buildFrostCurve(
  baseCapacityKcalH: number,
  Te: number,
  airTempC: number,
  rhPct: number,
): FrostCurvePoint[] {
  const dewPointApproxC = airTempC - (100 - rhPct) / 5;
  const frostPointC = dewPointApproxC - 2;
  const surfaceTempC = Te + 3;
  const frostSeverity = Math.max(0, frostPointC - surfaceTempC);

  return Array.from({ length: 13 }, (_, index) => {
    const t_h = index * 0.5;
    const thickness_mm = frostSeverity * t_h * 0.08;
    const Q_kcalh = baseCapacityKcalH * Math.exp(-0.15 * thickness_mm);
    return { t_h, Q_kcalh, thickness_mm };
  });
}

export function useCoilEnvelopeGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [envelopePoints, setEnvelopePoints] = useState<EnvelopePoint[]>([]);
  const { saveEnvelope } = useCoilEnvelopeStore();
  const result = useCnCoilsSimulationStore((s) => s.result);
  const physicalInputs = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const thermoInputs = useCnCoilsSimulationStore((s) => s.thermoInputs);
  const fluid = useCnCoilsSimulationStore((s) => s.fluid);
  const airTempC = useCnCoilsSimulationStore((s) => s.tempInDB_C);
  const rhPct = useCnCoilsSimulationStore((s) => s.rhIn_pct);
  const pairedTempC = useCnCoilsSimulationStore((s) => s.pairedTempC);
  const recalculateWithTe = useCnCoilsSimulationStore((s) => s.recalculateWithTe);

  const nominalTe =
    thermoInputs.evaporatingTempC ??
    (Number.isFinite(useCnCoilsSimulationStore.getState().fluidOperatingTemp_C)
      ? useCnCoilsSimulationStore.getState().fluidOperatingTemp_C
      : -10);

  const generateEnvelope = useCallback(async () => {
    if (!result) {
      toast.error("Execute o cálculo principal antes de gerar o envelope");
      return [];
    }

    setIsGenerating(true);
    const offsets = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
    const points: EnvelopePoint[] = [];

    try {
      for (const offset of offsets) {
        const Te = nominalTe + offset;
        const pointResult = await recalculateWithTe(Te);
        if (!pointResult) continue;
        const qKcalh = capacityKwToKcalH(pointResult.totalCapacityKw);
        const massFlowKgS = pointResult.fluidMassFlowKgS ?? 0;
        const hfgKJkg = massFlowKgS > 0
          ? (pointResult.totalCapacityKw / massFlowKgS)
          : 200;
        const W_kW = Math.max(0, pointResult.totalCapacityKw / 3);

        points.push({
          Te,
          Q_kcalh: qKcalh,
          W_kW,
          COP: W_kW > 0 ? pointResult.totalCapacityKw / W_kW : 0,
          deltaP_Pa: pointResult.airPressureDropPa,
          regime: inferRegime(Te, airTempC, rhPct),
        });

        void hfgKJkg;
      }
      setEnvelopePoints(points);
      return points;
    } finally {
      setIsGenerating(false);
    }
  }, [airTempC, nominalTe, recalculateWithTe, result, rhPct]);

  const saveToStore = useCallback(
    (equipmentId: string) => {
      if (envelopePoints.length === 0) {
        toast.error("Gere o envelope antes de salvar");
        return;
      }

      const nominalCapacity = envelopePoints[Math.floor(envelopePoints.length / 2)]?.Q_kcalh ?? 0;
      const frostCurve = buildFrostCurve(nominalCapacity, nominalTe, airTempC, rhPct);
      const last = frostCurve[frostCurve.length - 1];
      const residualCapacityPct = nominalCapacity > 0 ? (last.Q_kcalh / nominalCapacity) * 100 : 100;

      const envelope: CoilEnvelope = {
        equipmentId,
        componentType: "evaporator_dx",
        geometryId: physicalInputs.geometryId,
        refrigerant: fluid || thermoInputs.refrigerantId || "R404A",
        nominalConditions: {
          Te: nominalTe,
          Tc: pairedTempC ?? thermoInputs.condensingTempC ?? 40,
          T_ar: airTempC,
          UR: rhPct,
        },
        envelope: envelopePoints,
        frostAnalysis: {
          frostPoint_C: airTempC - (100 - rhPct) / 5 - 2,
          massRate_kgh: Math.max(0, frostCurve[1]?.thickness_mm ?? 0) * 0.25,
          degradationCurve: frostCurve,
          recommendedDefrostInterval_h:
            frostCurve.find((p) => p.Q_kcalh <= nominalCapacity * 0.7)?.t_h ?? frostCurve.at(-1)?.t_h ?? 6,
          residualCapacityPct,
        },
        savedAt: new Date().toISOString(),
        version: 2,
      };

      saveEnvelope(envelope);
      void useCoilEnvelopeStore.getState().persistRemote(equipmentId);
      toast.success("✅ Envelope do evaporador salvo — disponível na Bancada de Testes");
    },
    [
      airTempC,
      envelopePoints,
      fluid,
      nominalTe,
      pairedTempC,
      physicalInputs.geometryId,
      rhPct,
      saveEnvelope,
      thermoInputs.condensingTempC,
      thermoInputs.refrigerantId,
    ],
  );

  return { generateEnvelope, saveToStore, isGenerating, envelopePoints };
}
