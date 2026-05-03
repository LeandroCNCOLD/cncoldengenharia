import { describe, it, expect } from "vitest";
import { getRefrigerantSatProps, listAvailableRefrigerants } from "./refrigerantProperties";

describe("Refrigerantes naturais", () => {
  it("R717 (NH3) a 0°C: P_sat ~429 kPa", async () => {
    const p = await getRefrigerantSatProps("R717", 0);
    expect(p.P_kPa).toBeGreaterThan(380);
    expect(p.P_kPa).toBeLessThan(480);
    expect(p.warnings).toHaveLength(0);
  });
  it("R744 (CO2) a -20°C: P_sat ~1969 kPa", async () => {
    const p = await getRefrigerantSatProps("R744", -20);
    expect(p.P_kPa).toBeGreaterThan(1800);
    expect(p.P_kPa).toBeLessThan(2200);
  });
  it("R290 (Propano) a -10°C: P_sat ~354 kPa", async () => {
    const p = await getRefrigerantSatProps("R290", -10);
    expect(p.P_kPa).toBeGreaterThan(300);
    expect(p.P_kPa).toBeLessThan(420);
  });
  it("Alias 'NH3' deve funcionar igual a 'R717'", async () => {
    const p1 = await getRefrigerantSatProps("R717", 0);
    const p2 = await getRefrigerantSatProps("NH3", 0);
    expect(p1.P_kPa).toBeCloseTo(p2.P_kPa, 1);
  });
  it("Alias 'CO2' deve funcionar igual a 'R744'", async () => {
    const p1 = await getRefrigerantSatProps("R744", -20);
    const p2 = await getRefrigerantSatProps("CO2", -20);
    expect(p1.P_kPa).toBeCloseTo(p2.P_kPa, 1);
  });
});

describe("HFCs prioritários", () => {
  it("R404A a -10°C: P_sat ~361 kPa", async () => {
    const p = await getRefrigerantSatProps("R404A", -10);
    expect(p.P_kPa).toBeGreaterThan(300);
    expect(p.P_kPa).toBeLessThan(420);
  });
  it("R410A a 0°C: P_sat ~798 kPa", async () => {
    const p = await getRefrigerantSatProps("R410A", 0);
    expect(p.P_kPa).toBeGreaterThan(700);
    expect(p.P_kPa).toBeLessThan(900);
  });
  it("R32 a 0°C: P_sat ~717 kPa", async () => {
    const p = await getRefrigerantSatProps("R32", 0);
    expect(p.P_kPa).toBeGreaterThan(650);
    expect(p.P_kPa).toBeLessThan(800);
  });
  it("R134a a 0°C: P_sat ~292 kPa", async () => {
    const p = await getRefrigerantSatProps("R134a", 0);
    expect(p.P_kPa).toBeGreaterThan(270);
    expect(p.P_kPa).toBeLessThan(320);
  });
  it("R22 a -10°C: P_sat ~354 kPa", async () => {
    const p = await getRefrigerantSatProps("R22", -10);
    expect(p.P_kPa).toBeGreaterThan(300);
    expect(p.P_kPa).toBeLessThan(420);
  });
});

describe("HFOs e substitutos baixo GWP", () => {
  it("R1234yf a 0°C: P_sat ~293 kPa", async () => {
    const p = await getRefrigerantSatProps("R1234yf", 0);
    expect(p.P_kPa).toBeGreaterThan(260);
    expect(p.P_kPa).toBeLessThan(330);
  });
  it("R448A deve retornar aviso de proxy", async () => {
    const p = await getRefrigerantSatProps("R448A", -10);
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.P_kPa).toBeGreaterThan(0);
  });
  it("R449A a -10°C: P_sat similar ao R404A (±15%)", async () => {
    const p404 = await getRefrigerantSatProps("R404A", -10);
    const p449 = await getRefrigerantSatProps("R449A", -10);
    expect(p449.P_kPa).toBeGreaterThan(p404.P_kPa * 0.85);
    expect(p449.P_kPa).toBeLessThan(p404.P_kPa * 1.15);
  });
  it("R454B a 0°C: P_sat similar ao R410A (±15%)", async () => {
    const p410 = await getRefrigerantSatProps("R410A", 0);
    const p454b = await getRefrigerantSatProps("R454B", 0);
    expect(p454b.P_kPa).toBeGreaterThan(p410.P_kPa * 0.85);
    expect(p454b.P_kPa).toBeLessThan(p410.P_kPa * 1.15);
  });
});

describe("Propriedades físicas", () => {
  it("densidade do líquido > densidade do vapor (todos os refrigerantes)", async () => {
    const refs = ["R404A", "R410A", "R32", "R134a", "R717", "R744", "R290"];
    for (const ref of refs) {
      const p = await getRefrigerantSatProps(ref, -10);
      expect(p.liquid.rho_kgm3).toBeGreaterThan(p.vapor.rho_kgm3);
    }
  });
  it("h_fg > 0 para todos os refrigerantes", async () => {
    const refs = ["R404A", "R410A", "R32", "R134a", "R717", "R744", "R290", "R1234yf"];
    for (const ref of refs) {
      const p = await getRefrigerantSatProps(ref, -10);
      expect(p.h_fg_kJkg).toBeGreaterThan(0);
    }
  });
  it("h_fg = h_g - h_f", async () => {
    const p = await getRefrigerantSatProps("R404A", -10);
    expect(Math.abs(p.h_fg_kJkg - (p.h_g_kJkg - p.h_f_kJkg))).toBeLessThan(0.1);
  });
});

describe("Interpolação e limites", () => {
  it("P_sat deve ser monotonicamente crescente com T", async () => {
    const temps = [-20, -10, 0, 10, 20];
    const pressures = await Promise.all(
      temps.map((T) => getRefrigerantSatProps("R404A", T).then((p) => p.P_kPa)),
    );
    for (let i = 1; i < pressures.length; i++) {
      expect(pressures[i]).toBeGreaterThan(pressures[i - 1]);
    }
  });
  it("deve retornar aviso para refrigerante desconhecido", async () => {
    const p = await getRefrigerantSatProps("R999X", -10);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
  it("deve retornar aviso quando T abaixo do mínimo", async () => {
    const p = await getRefrigerantSatProps("R404A", -100);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
  it("listAvailableRefrigerants deve retornar >= 37 entradas", async () => {
    const list = await listAvailableRefrigerants();
    expect(list.length).toBeGreaterThanOrEqual(37);
  });
});
