import { describe, it, expect } from "vitest";

import { calculateLMTD } from "../engines/core/lmtd";
import { calculateEffectivenessCrossflowUnmixed } from "../engines/core/ntu";
import {
  calculateReynolds,
  calculateNusseltGnielinski,
  calculateConvectiveCoefficient,
} from "../engines/core/dimensionless";
import { calculateDarcyFrictionFactor } from "../engines/core/friction";
import { calculateAirGeometry } from "../engines/airSide/airGeometry";
import {
  saturationPressure,
  humidityRatio,
  enthalpyMoistAir,
  dewPoint,
} from "../engines/psychrometrics/psychrometricCore";
import { calculateWetCoil } from "../engines/psychrometrics/wetCoil";
import { calculateReheat } from "../engines/psychrometrics/reheatCoil";

describe("Caso 1: LMTD Contracorrente", () => {
  it("deve calcular LMTD = 34.76°C para o caso de referência", () => {
    const result = calculateLMTD({
      hotIn_c: 80.0,
      hotOut_c: 50.0,
      coldIn_c: 20.0,
      coldOut_c: 40.0,
    });

    expect(result.lmtd_k).not.toBeNull();
    expect(result.lmtd_k!).toBeCloseTo(34.76, 1);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("Caso 2: ε-NTU Crossflow Unmixed", () => {
  it("deve calcular ε = 0.7388 para NTU=2.0, Cr=0.5", () => {
    const epsilon = calculateEffectivenessCrossflowUnmixed(2.0, 0.5);

    expect(epsilon).toBeCloseTo(0.7388, 2);
    expect(epsilon).toBeGreaterThan(0);
    expect(epsilon).toBeLessThanOrEqual(1);
  });
});

describe("Caso 3: Gnielinski — água em tubo", () => {
  const rho = 998.2;
  const mu = 0.001002;
  const cp = 4182;
  const k = 0.598;
  const V = 1.5;
  const D = 0.015;

  it("deve calcular Re ≈ 22415", () => {
    const Re = calculateReynolds({
      density_kg_m3: rho,
      velocity_m_s: V,
      hydraulicDiameter_m: D,
      viscosity_pa_s: mu,
    });

    expect(Re).toBeCloseTo(22415, -1);
  });

  it("deve calcular Nu ≈ 164 e h ≈ 6540 W/m²K", () => {
    const Re = calculateReynolds({
      density_kg_m3: rho,
      velocity_m_s: V,
      hydraulicDiameter_m: D,
      viscosity_pa_s: mu,
    });

    const Pr = (cp * mu) / k;

    const f = calculateDarcyFrictionFactor({
      reynolds: Re,
      roughness_m: 0.0000015,
      hydraulicDiameter_m: D,
    });

    const nuResult = calculateNusseltGnielinski({
      reynolds: Re,
      prandtl: Pr,
      frictionFactor: f,
    });

    expect(nuResult.nusselt).toBeCloseTo(164.04, 0);

    const h = calculateConvectiveCoefficient({
      nusselt: nuResult.nusselt,
      conductivity_w_m_k: k,
      hydraulicDiameter_m: D,
    });

    expect(h).toBeCloseTo(6540, -1);
  });
});

describe("Caso 4: Geometria do Ar — CN Coils 173833_S_S", () => {
  it("deve calcular σ = 0.5360 e Dh = 0.004478 m", () => {
    const result = calculateAirGeometry({
      face_area_m2: 1.0,
      tube_outer_diameter_m: 0.01665,
      tube_pitch_transverse_m: 0.0381,
      tube_pitch_longitudinal_m: 0.033,
      fin_spacing_mm: 2.5,
      fin_thickness_mm: 0.12,
      rows: 4,
    });

    expect(result.free_flow_area_ratio).toBeCloseTo(0.536, 2);
    expect(result.hydraulic_diameter_m).toBeCloseTo(0.004478, 4);
  });
});

describe("Caso 5: Psicrometria Básica — T=25°C, RH=60%", () => {
  it("deve calcular P_ws = 3167.67 Pa", () => {
    const Pws = saturationPressure(25.0);
    expect(Pws).toBeCloseTo(3167.67, 0);
  });

  it("deve calcular W = 0.01189 kg/kg", () => {
    const { W } = humidityRatio(25.0, 0.6, 101325);
    expect(W).toBeCloseTo(0.01189, 4);
  });

  it("deve calcular h = 55.44 kJ/kg", () => {
    const { W } = humidityRatio(25.0, 0.6, 101325);
    const h = enthalpyMoistAir(25.0, W);
    expect(h).toBeCloseTo(55.44, 1);
  });

  it("deve calcular T_dp = 16.70°C", () => {
    const { T_dp } = dewPoint(25.0, 0.6);
    expect(T_dp).toBeCloseTo(16.7, 1);
  });
});

describe("Caso 6: Evaporador Úmido — T=25°C, RH=60%, T_surface=5°C", () => {
  it("deve retornar modo wet com carga total ≈ 32782 W", () => {
    const result = calculateWetCoil({
      T_air_in: 25.0,
      RH_in: 0.6,
      T_surface: 5.0,
      air_mass_flow_kg_s: 1.0,
    });

    expect(result.mode).toBe("wet");
    expect(result.T_air_out).toBeCloseTo(7.0, 1);
    expect(result.W_out).toBeCloseTo(0.00621, 4);
    expect(result.water_removed_kg_s).toBeCloseTo(0.00568, 4);
    expect(result.total_load_w).toBeCloseTo(32782, -2);
  });
});

describe("Caso 7: Reaquecimento — T=7°C, RH=100%, Q=500W", () => {
  it("deve retornar T_out ≈ 7.49°C e RH_out ≈ 0.967", () => {
    const result = calculateReheat({
      T_air_in: 7.0,
      RH_in: 1.0,
      air_mass_flow_kg_s: 1.0,
      Q_reheat_w: 500,
    });

    expect(result.T_air_out).toBeCloseTo(7.49, 1);
    expect(result.RH_out).toBeCloseTo(0.967, 2);
  });
});
