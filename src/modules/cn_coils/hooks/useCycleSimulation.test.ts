// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCycleSimulation } from "./useCycleSimulation";

vi.mock("../engines/cycle/cycleEngine", () => ({
  runCycleSimulation: vi.fn().mockResolvedValue({
    converged: true,
    iterations: 5,
    residual: 0.003,
    Te_C: -10,
    Tc_C: 40,
    m_dot_kgS: 0.055,
    Q_evap_W: 10000,
    Q_cond_W: 13500,
    W_comp_W: 3500,
    COP: 2.86,
    EER: 9.76,
    statePoints: {
      point1_evapOut: { T_C: -5, P_kPa: 361, h_kJkg: 374, s_kJkgK: 1.72, quality: 1.05, phase: "superheated" },
      point2_compOut: { T_C: 75, P_kPa: 1533, h_kJkg: 438, s_kJkgK: 1.74, quality: 1.35, phase: "superheated" },
      point3_condOut: { T_C: 35, P_kPa: 1533, h_kJkg: 200, s_kJkgK: 0.98, quality: -0.05, phase: "subcooled" },
      point4_valveOut: { T_C: -10, P_kPa: 361, h_kJkg: 200, s_kJkgK: 0.99, quality: 0.15, phase: "two_phase" },
    },
    evaporatorResult: {
      totalCapacityW: 10000,
      sensibleCapacityW: 7500,
      latentCapacityW: 2500,
      airOutletTempC: 2,
      airOutletRH: 0.95,
      airPressureDropPa: 45,
      fluidPressureDropKPa: 12,
      overallU_WM2K: 28.5,
      safetyFactor: 1.12,
    },
    condenserResult: {
      totalCapacityW: 13500,
      airOutletTempC: 42,
      airPressureDropPa: 30,
      fluidPressureDropKPa: 8,
      overallU_WM2K: 35,
    },
    compressorResult: {
      Q_evap_W: 10000,
      W_comp_W: 3500,
      COP: 2.86,
      compressionRatio: 4.24,
      mode: "bitzer_native",
    },
    warnings: [],
  }),
}));

describe("useCycleSimulation", () => {
  it("deve iniciar em idle", () => {
    const { result } = renderHook(() => useCycleSimulation(null));
    expect(result.current.status).toBe("idle");
  });

  it("deve passar para success após simular", async () => {
    const mockConfig = { id: "test" } as any;
    const { result } = renderHook(() => useCycleSimulation(mockConfig));
    await waitFor(() => expect(result.current.status).toBe("success"), {
      timeout: 2000,
    });
    if (result.current.status === "success") {
      expect(result.current.result.COP).toBeGreaterThan(0);
    }
  });
});
