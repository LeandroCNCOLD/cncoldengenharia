import { describe, expect, it } from "vitest";
import { calculateSystemEquilibrium } from "../useSystemEquilibrium";
import type {
  NormalizedCondenserEnvelopePoint,
  NormalizedEvaporatorEnvelopePoint,
} from "../useSystemEquilibrium";
import type { CompressorEnvelopePoint } from "../../store/useCoilEnvelopeStore";

const tePoints = [-30, -25, -20, -15, -10, -5, 0, 5, 10];
const tcPoints = [35, 40, 45, 50, 55];

function evaporator(
  fn: (te: number) => number,
): NormalizedEvaporatorEnvelopePoint[] {
  return tePoints.map((Te_C) => ({ Te_C, Q_W: fn(Te_C) }));
}

function condenser(
  fn: (tc: number) => number,
): NormalizedCondenserEnvelopePoint[] {
  return tcPoints.map((Tc_C) => ({ Tc_C, Q_W: fn(Tc_C) }));
}

function compressor(
  q: (te: number, tc: number) => number,
  w: (te: number, tc: number) => number = () => 1000,
): CompressorEnvelopePoint[] {
  return tcPoints.flatMap((Tc_C) =>
    tePoints.map((Te_C) => ({
      Te_C,
      Tc_C,
      Q_W: q(Te_C, Tc_C),
      W_W: w(Te_C, Tc_C),
      COP: q(Te_C, Tc_C) / w(Te_C, Tc_C),
      massFlow_kgh: 100,
      dischargeTemp_C: 90,
    })),
  );
}

describe("useSystemEquilibrium", () => {
  it("converge para sistema balanceado com envelopes sintéticos", () => {
    const result = calculateSystemEquilibrium({
      Tamb_C: 35,
      Tsuperheating_K: 7,
      Tsubcooling_K: 5,
      evaporatorEnvelope: evaporator((te) => 5000 + 200 * (te + 10)),
      condenserEnvelope: condenser((tc) => 6000 + 200 * (tc - 45)),
      compressorEnvelope: compressor((te) => 5000 + 200 * (te + 10)),
    });

    expect(result.converged).toBe(true);
    expect(result.Te_eq_C).toBeCloseTo(-10, 1);
    expect(result.Q_evap_W).toBeCloseTo(5000, -1);
    expect(result.bottleneck).toBe("balanced");
  });

  it("identifica gargalo no evaporador quando Q_evap < Q_comp", () => {
    const result = calculateSystemEquilibrium({
      Tamb_C: 35,
      Tsuperheating_K: 7,
      Tsubcooling_K: 5,
      evaporatorEnvelope: evaporator(() => 3000),
      condenserEnvelope: condenser(() => 7000),
      compressorEnvelope: compressor(() => 5000),
    });

    expect(result.bottleneck).toBe("evaporator");
  });

  it("identifica gargalo no condensador quando Q_cond < Q_comp + W_comp", () => {
    const result = calculateSystemEquilibrium({
      Tamb_C: 35,
      Tsuperheating_K: 7,
      Tsubcooling_K: 5,
      evaporatorEnvelope: evaporator(() => 5000),
      condenserEnvelope: condenser(() => 4000),
      compressorEnvelope: compressor(() => 5000, () => 1000),
    });

    expect(result.bottleneck).toBe("condenser");
  });

  it("retorna converged=false quando envelopes não se intersectam", () => {
    const result = calculateSystemEquilibrium({
      Tamb_C: 35,
      Tsuperheating_K: 7,
      Tsubcooling_K: 5,
      evaporatorEnvelope: evaporator(() => 9000),
      condenserEnvelope: condenser(() => 12000),
      compressorEnvelope: compressor(() => 4000),
    });

    expect(result.converged).toBe(false);
  });
});
