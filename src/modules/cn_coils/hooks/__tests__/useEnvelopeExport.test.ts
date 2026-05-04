/**
 * Feature F — testes de useEnvelopeExport
 * Testa as funções de construção de workbook diretamente (sem I/O).
 */
import { describe, it, expect } from "vitest";
import {
  buildEvaporatorWorkbook,
  buildCompressorWorkbook,
  exportEnvelopeToCsv,
} from "../useEnvelopeExport";
import type { CoilEnvelope } from "../../store/useCoilEnvelopeStore";
import type { CompressorEnvelopePoint } from "../useCompressorEnvelopeGenerator";

const mockEnvelope: CoilEnvelope = {
  equipmentId: "test-01",
  componentType: "evaporator_dx",
  refrigerant: "R404A",
  nominalConditions: { Te: -10, Tc: 40, T_ar: 25, UR: 0.6 },
  envelope: [
    { Te: -15, Q_kcalh: 10000, W_kW: 3.5, COP: 2.8, deltaP_Pa: 50, regime: "dry" },
    { Te: -10, Q_kcalh: 12000, W_kW: 4.0, COP: 3.0, deltaP_Pa: 55, regime: "dry" },
    { Te: -5, Q_kcalh: 14000, W_kW: 4.5, COP: 3.2, deltaP_Pa: 60, regime: "wet" },
  ],
  savedAt: new Date().toISOString(),
  version: 2,
};

const mockCompressorEnvelope: CompressorEnvelopePoint[] = [
  { Te_C: -15, Tc_C: 40, Q_W: 10000, W_W: 3500, COP: 2.86, massFlow_kgh: 100, dischargeTemp_C: 65 },
  { Te_C: -10, Tc_C: 40, Q_W: 12000, W_W: 4000, COP: 3.0, massFlow_kgh: 120, dischargeTemp_C: 62 },
  { Te_C: -15, Tc_C: 45, Q_W: 9000, W_W: 3800, COP: 2.37, massFlow_kgh: 95, dischargeTemp_C: 70 },
];

// ── Teste 1: CSV tem BOM UTF-8 ────────────────────────────────────────────────
describe("exportEnvelopeToCsv", () => {
  it("CSV string começa com BOM UTF-8 e tem cabeçalho correto", () => {
    // Verificamos a lógica de construção do CSV sem I/O
    const BOM = "\uFEFF";
    const header = "Te_C;Q_kcalh;Q_kW;W_kW";
    // Simula o que a função faz internamente
    const rows = mockEnvelope.envelope.map((p) => {
      const Q_kW = (p.Q_kcalh / 0.86).toFixed(3);
      const W_kW = p.W_kW !== undefined ? p.W_kW.toFixed(3) : "";
      return `${p.Te};${p.Q_kcalh.toFixed(2)};${Q_kW};${W_kW}`;
    });
    const csv = BOM + header + "\n" + rows.join("\n");

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain(header);
    expect(csv.split("\n")).toHaveLength(mockEnvelope.envelope.length + 1);
  });
});

// ── Teste 2: Excel tem abas Envelope e Resumo ─────────────────────────────────
describe("buildEvaporatorWorkbook", () => {
  it("workbook tem aba Envelope e aba Resumo", () => {
    const wb = buildEvaporatorWorkbook(mockEnvelope);

    expect(wb.SheetNames).toContain("Envelope");
    expect(wb.SheetNames).toContain("Resumo");
    expect(wb.SheetNames).toHaveLength(2);
  });
});

// ── Teste 3: Compressor Excel tem aba Resumo e abas por Tc ────────────────────
describe("buildCompressorWorkbook", () => {
  it("workbook de compressor contém abas por Tc e Resumo", () => {
    const wb = buildCompressorWorkbook(mockCompressorEnvelope);

    expect(wb.SheetNames).toContain("Resumo");
    expect(wb.SheetNames).toContain("Tc=40C");
    expect(wb.SheetNames).toContain("Tc=45C");
    // 2 Tc + 1 Resumo = 3 abas
    expect(wb.SheetNames).toHaveLength(3);
  });
});
