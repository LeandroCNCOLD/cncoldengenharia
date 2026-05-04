import { describe, expect, it } from "vitest";
import { calculateEvaporativeCondenser } from "../useEvaporativeCondenserSimulation";
import { calculateWaterCondenser } from "../useWaterCondenserSimulation";
import { calculateHeatingCoil } from "../useHeatingCoilSimulation";

describe("useEvaporativeCondenserSimulation", () => {
  it("calcula Tc maior que Twb", () => {
    const result = calculateEvaporativeCondenser({
      Q_total_W: 50_000,
      Twb_C: 24,
      Tdb_C: 35,
      altitude_m: 0,
      tubeRows: 4,
      tubesPerRow: 20,
      tubeLength_m: 2.4,
      tubeDiameter_mm: 19.05,
      waterFlowRate_Lmin: 15,
      airVelocity_ms: 3,
    });

    expect(result.Tc_C).toBeGreaterThan(24);
  });

  it("consumo de água cresce com Q_total", () => {
    const base = {
      Twb_C: 24,
      Tdb_C: 35,
      altitude_m: 0,
      tubeRows: 4,
      tubesPerRow: 20,
      tubeLength_m: 2.4,
      tubeDiameter_mm: 19.05,
      waterFlowRate_Lmin: 15,
      airVelocity_ms: 3,
    };

    const low = calculateEvaporativeCondenser({ ...base, Q_total_W: 30_000 });
    const high = calculateEvaporativeCondenser({ ...base, Q_total_W: 60_000 });

    expect(high.waterEvaporation_Lh).toBeGreaterThan(low.waterEvaporation_Lh);
  });
});

describe("useWaterCondenserSimulation", () => {
  it("Tc aumenta com menor vazão de água", () => {
    const base = {
      Q_total_W: 50_000,
      Tw_in_C: 30,
      tubeCount: 20,
      tubeLength_m: 2,
      tubeDiameter_mm: 19.05,
      passes: 2,
      refrigerant: "R404A",
      superheat_K: 5,
      subcooling_K: 3,
    };

    const highFlow = calculateWaterCondenser({ ...base, waterFlowRate_m3h: 5 });
    const lowFlow = calculateWaterCondenser({ ...base, waterFlowRate_m3h: 1 });

    expect(lowFlow.Tc_C).toBeGreaterThan(highFlow.Tc_C);
  });

  it("margem de área negativa quando tubos insuficientes", () => {
    const result = calculateWaterCondenser({
      Q_total_W: 80_000,
      Tw_in_C: 30,
      waterFlowRate_m3h: 3,
      tubeCount: 2,
      tubeLength_m: 2,
      tubeDiameter_mm: 19.05,
      passes: 1,
      refrigerant: "R404A",
      superheat_K: 5,
      subcooling_K: 3,
    });

    expect(result.areaMargin).toBeLessThan(0);
  });
});

describe("useHeatingCoilSimulation", () => {
  it("Tair_out > Tair_in para fluido quente", () => {
    const result = calculateHeatingCoil({
      mode: "heating",
      Tair_in_C: 15,
      RH_in: 0.6,
      airFlowRate_m3h: 3000,
      altitude_m: 0,
      heatingFluid: "hot_water",
      Tf_in_C: 80,
      Tf_out_C: 60,
      fluidFlowRate_m3h: 1.5,
      tubeRows: 2,
      tubesPerRow: 16,
      tubeLength_m: 1.2,
      finPitch_mm: 3,
      tubeDiameter_mm: 15.88,
    });

    expect(result.Tair_out_C).toBeGreaterThan(15);
  });

  it("RH_out < RH_in para aquecimento sensível", () => {
    const result = calculateHeatingCoil({
      mode: "heating",
      Tair_in_C: 15,
      RH_in: 0.6,
      airFlowRate_m3h: 3000,
      altitude_m: 0,
      heatingFluid: "hot_water",
      Tf_in_C: 80,
      Tf_out_C: 60,
      fluidFlowRate_m3h: 1.5,
      tubeRows: 2,
      tubesPerRow: 16,
      tubeLength_m: 1.2,
      finPitch_mm: 3,
      tubeDiameter_mm: 15.88,
    });

    expect(result.RH_out).toBeLessThan(0.6);
  });
});
