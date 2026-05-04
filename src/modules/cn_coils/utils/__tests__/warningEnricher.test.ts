import { describe, expect, it } from "vitest";

import { enrichWarnings } from "../warningEnricher";

describe("warningEnricher", () => {
  it("não classifica SH real de 5K como superaquecimento insuficiente", () => {
    const [warning] = enrichWarnings([
      "SH real (5.0 K) abaixo do mínimo (5 K). Risco de retorno de líquido.",
    ]);

    expect(warning.title).not.toBe("Superaquecimento insuficiente");
    expect(warning.severity).not.toBe("error");
  });

  it("classifica SH real abaixo de 3K como superaquecimento insuficiente", () => {
    const [warning] = enrichWarnings([
      "SH real (2.3 K) abaixo do mínimo (5 K). Risco de retorno de líquido.",
    ]);

    expect(warning.title).toBe("Superaquecimento insuficiente");
    expect(warning.severity).toBe("error");
  });
});
