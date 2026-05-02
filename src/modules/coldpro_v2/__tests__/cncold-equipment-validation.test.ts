import { describe, it, expect } from "vitest";

import {
  dewPoint,
  humidityRatio,
  saturationPressure,
  cpMoistAir,
} from "../engines/psychrometrics/psychrometricCore";
import { calculateWetCoil } from "../engines/psychrometrics/wetCoil";
import { calculateReheat } from "../engines/psychrometrics/reheatCoil";

function calculateEnergyBalanceAirOut(
  T_in: number,
  Q_w: number,
  m_air: number,
  W_in: number,
): number {
  const cp_moist = cpMoistAir(W_in) * 1000;
  return T_in - Q_w / (m_air * cp_moist);
}

function calculateRHOut(W_in: number, T_out: number, P_atm = 101325): number {
  const P_vapor = (W_in * P_atm) / (0.62198 + W_in);
  const P_ws_out = saturationPressure(T_out);
  return Math.min(1.0, P_vapor / P_ws_out);
}

describe("Caso A: CN_100_HT — Climatizado / Plug-in", () => {
  const T_camera = 20.0;
  const UR = 0.85;
  const T_evap = 10.8;
  const Q_catalogo = 4553;
  const m_air = 1.0002;

  it("deve detectar modo wet (T_evap < T_dp)", () => {
    const { T_dp } = dewPoint(T_camera, UR);
    expect(T_dp).toBeCloseTo(17.4, 1);
    expect(T_evap).toBeLessThan(T_dp);

    const result = calculateWetCoil({
      T_air_in: T_camera,
      RH_in: UR,
      T_surface: T_evap,
      air_mass_flow_kg_s: m_air,
    });
    expect(result.mode).toBe("wet");
  });

  it("deve calcular T_ar_out ≈ 15.58°C via balanço de energia", () => {
    const { W } = humidityRatio(T_camera, UR);
    expect(W).toBeCloseTo(0.01244, 4);

    const T_out = calculateEnergyBalanceAirOut(T_camera, Q_catalogo, m_air, W);
    expect(T_out).toBeCloseTo(15.58, 0);
  });

  it("deve ter remoção de água > 0", () => {
    const result = calculateWetCoil({
      T_air_in: T_camera,
      RH_in: UR,
      T_surface: T_evap,
      air_mass_flow_kg_s: m_air,
    });
    expect(result.water_removed_kg_s).toBeGreaterThan(0);
  });
});

describe("Caso B: CN_100_MT — Resfriado / Sem Reaquecimento", () => {
  const T_camera = 8.0;
  const UR = 0.85;
  const T_evap = -0.6;
  const Q_catalogo = 3716;
  const m_air = 1.0607;

  it("deve detectar modo wet (T_evap < T_dp)", () => {
    const { T_dp } = dewPoint(T_camera, UR);
    expect(T_dp).toBeCloseTo(5.64, 1);
    expect(T_evap).toBeLessThan(T_dp);

    const result = calculateWetCoil({
      T_air_in: T_camera,
      RH_in: UR,
      T_surface: T_evap,
      air_mass_flow_kg_s: m_air,
    });
    expect(result.mode).toBe("wet");
  });

  it("deve calcular T_ar_out ≈ 4.55°C via balanço de energia", () => {
    const { W } = humidityRatio(T_camera, UR);
    expect(W).toBeCloseTo(0.00565, 4);

    const T_out = calculateEnergyBalanceAirOut(T_camera, Q_catalogo, m_air, W);
    expect(T_out).toBeCloseTo(4.55, 0);
  });

  it("deve ter remoção de água > 0", () => {
    const result = calculateWetCoil({
      T_air_in: T_camera,
      RH_in: UR,
      T_surface: T_evap,
      air_mass_flow_kg_s: m_air,
    });
    expect(result.water_removed_kg_s).toBeGreaterThan(0);
  });
});

describe("Caso C: CN_150_LT — Congelado / Sem Reaquecimento", () => {
  const T_camera = -12.0;
  const UR = 0.85;
  const T_evap = -19.5;
  const Q_catalogo = 1832;
  const m_air = 1.1851;

  it("deve detectar modo wet (T_evap < T_dp)", () => {
    const { T_dp } = dewPoint(T_camera, UR);
    expect(T_dp).toBeCloseTo(-14.0, 0);
    expect(T_evap).toBeLessThan(T_dp);

    const result = calculateWetCoil({
      T_air_in: T_camera,
      RH_in: UR,
      T_surface: T_evap,
      air_mass_flow_kg_s: m_air,
    });
    expect(result.mode).toBe("wet");
  });

  it("deve calcular T_ar_out ≈ -13.53°C via balanço de energia", () => {
    const { W } = humidityRatio(T_camera, UR);
    expect(W).toBeCloseTo(0.00127, 4);

    const T_out = calculateEnergyBalanceAirOut(T_camera, Q_catalogo, m_air, W);
    expect(T_out).toBeCloseTo(-13.53, 0);
  });

  it("deve ter remoção de água > 0", () => {
    const result = calculateWetCoil({
      T_air_in: T_camera,
      RH_in: UR,
      T_surface: T_evap,
      air_mass_flow_kg_s: m_air,
    });
    expect(result.water_removed_kg_s).toBeGreaterThan(0);
  });
});

describe("Caso D: CN_750_AGRO — Armazenamento Agrícola / Com Reaquecimento", () => {
  const T_camera = 16.0;
  const UR = 0.5;
  const T_evap = -1.0;
  const Q_catalogo = 24638;
  const m_air = 5.6132;

  it("deve detectar modo wet (T_evap < T_dp)", () => {
    const { T_dp } = dewPoint(T_camera, UR);
    expect(T_dp).toBeCloseTo(5.59, 1);
    expect(T_evap).toBeLessThan(T_dp);

    const result = calculateWetCoil({
      T_air_in: T_camera,
      RH_in: UR,
      T_surface: T_evap,
      air_mass_flow_kg_s: m_air,
    });
    expect(result.mode).toBe("wet");
  });

  it("deve calcular T_ar_out_evap ≈ 11.68°C e RH_out ≈ 0.662", () => {
    const { W } = humidityRatio(T_camera, UR);
    expect(W).toBeCloseTo(0.00563, 4);

    const T_out = calculateEnergyBalanceAirOut(T_camera, Q_catalogo, m_air, W);
    expect(T_out).toBeCloseTo(11.68, 0);

    const RH_out = calculateRHOut(W, T_out);
    expect(RH_out).toBeCloseTo(0.662, 2);
  });

  it("deve retornar à condição da câmara após reaquecimento", () => {
    const { W } = humidityRatio(T_camera, UR);
    const T_out_evap = calculateEnergyBalanceAirOut(T_camera, Q_catalogo, m_air, W);
    const RH_out_evap = calculateRHOut(W, T_out_evap);

    const reheatResult = calculateReheat({
      T_air_in: T_out_evap,
      RH_in: RH_out_evap,
      air_mass_flow_kg_s: m_air,
      Q_reheat_w: Q_catalogo,
    });

    expect(reheatResult.T_air_out).toBeCloseTo(16.0, 0);
    expect(reheatResult.W_out).toBeCloseTo(W, 4);
    expect(reheatResult.RH_out).toBeCloseTo(0.5, 1);
  });
});
