import { describe, expect, it } from "vitest";
import { calculateColdRoomLoad, DEFAULT_COLD_ROOM_INPUTS } from "../useColdRoomLoad";
import { calculateDXSystemLoad, DEFAULT_DX_SYSTEM_INPUTS } from "../useDXSystemLoad";
import { calculateHeatPumpLoad, DEFAULT_HEAT_PUMP_INPUTS } from "../useHeatPumpLoad";

describe("useColdRoomLoad", () => {
  it("Q_total aumenta com maior DT", () => {
    const low = calculateColdRoomLoad({ ...DEFAULT_COLD_ROOM_INPUTS, Tamb_C: 30 });
    const high = calculateColdRoomLoad({ ...DEFAULT_COLD_ROOM_INPUTS, Tamb_C: 40 });
    expect(high.Q_total_W).toBeGreaterThan(low.Q_total_W);
  });

  it("fator de segurança 1.15 aumenta Q_total em 15%", () => {
    const base = calculateColdRoomLoad({ ...DEFAULT_COLD_ROOM_INPUTS, safetyFactor: 1 });
    const safe = calculateColdRoomLoad({ ...DEFAULT_COLD_ROOM_INPUTS, safetyFactor: 1.15 });
    expect(safe.Q_total_W).toBeCloseTo(base.Q_total_W * 1.15, 6);
  });
});

describe("useDXSystemLoad", () => {
  it("SHR entre 0 e 1", () => {
    const result = calculateDXSystemLoad(DEFAULT_DX_SYSTEM_INPUTS);
    expect(result.SHR).toBeGreaterThan(0);
    expect(result.SHR).toBeLessThan(1);
  });

  it("Q_total aumenta com maior ocupação", () => {
    const low = calculateDXSystemLoad({ ...DEFAULT_DX_SYSTEM_INPUTS, occupancy: 5 });
    const high = calculateDXSystemLoad({ ...DEFAULT_DX_SYSTEM_INPUTS, occupancy: 20 });
    expect(high.Q_total_W).toBeGreaterThan(low.Q_total_W);
  });
});

describe("useHeatPumpLoad", () => {
  it("COP_heating > COP_cooling", () => {
    const result = calculateHeatPumpLoad(DEFAULT_HEAT_PUMP_INPUTS);
    expect(result.COP_heating).toBeGreaterThan(result.COP_cooling);
    expect(result.COP_heating).toBeCloseTo(result.COP_cooling + 1, 6);
  });

  it("COP_heating diminui com menor Tsource", () => {
    const cold = calculateHeatPumpLoad({ ...DEFAULT_HEAT_PUMP_INPUTS, Tsource_C: 0 });
    const mild = calculateHeatPumpLoad({ ...DEFAULT_HEAT_PUMP_INPUTS, Tsource_C: 15 });
    expect(cold.COP_heating).toBeLessThan(mild.COP_heating);
  });
});
