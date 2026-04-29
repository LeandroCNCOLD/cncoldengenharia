import type {
  MapperInput,
  MapperResult,
  TechnicalEntityType,
  TechnicalMapper,
} from "../types";
import { MAPPER_REGISTRY } from "./registry";

/**
 * universalMapper — detecta fabricante, tipo de componente e seleciona o mapper
 * apropriado. Se nenhum mapper especializado reconhecer o input, retorna um
 * resultado `unknown` com confidence 0 e status sugerido `unmapped`.
 */
export const universalMapper = {
  name: "universal",

  /**
   * Detecta heuristicamente o fabricante a partir do raw / nome de arquivo.
   * Não falha — retorna null se incerto.
   */
  detectManufacturer(input: MapperInput): string | null {
    if (input.hintManufacturer) return input.hintManufacturer;

    const haystack = [
      input.sourceFile ?? "",
      input.sourceTable ?? "",
      JSON.stringify(input.raw ?? {}),
    ]
      .join(" ")
      .toLowerCase();

    if (haystack.includes("bitzer") || haystack.includes("/sw")) return "BITZER";
    if (haystack.includes("danfoss")) return "Danfoss";
    if (haystack.includes("copeland")) return "Copeland";
    if (haystack.includes("tecumseh")) return "Tecumseh";
    if (haystack.includes("torin") || haystack.includes("torin-sifan")) return "Torin";
    if (haystack.includes("ebmpapst") || haystack.includes("ebm-papst")) return "ebm-papst";
    if (haystack.includes("unilab")) return "Unilab";
    if (haystack.includes("vapcyc")) return "VAPCYC";
    return null;
  },

  /** Heurística leve para tipo de entidade quando o mapper específico falha. */
  detectEntityType(input: MapperInput): TechnicalEntityType {
    if (input.hintEntityType) return input.hintEntityType;
    const text = (input.sourceFile ?? "") + " " + (input.sourceTable ?? "");
    const t = text.toLowerCase();
    if (t.includes("compressor")) return "compressor";
    if (t.includes("fan") || t.includes("vent")) return "fan";
    if (t.includes("valve") || t.includes("valv")) return "expansion_valve";
    if (t.includes("evap")) return "evaporator_coil";
    if (t.includes("cond")) return "condenser_coil";
    if (t.includes("refrig")) return "refrigerant";
    return "unknown";
  },

  /**
   * Roda o pipeline de detecção. Sempre retorna um resultado — nunca lança.
   */
  map(input: MapperInput): MapperResult {
    const candidate: TechnicalMapper | undefined = MAPPER_REGISTRY.find((m) =>
      m.canHandle(input),
    );

    if (candidate) {
      try {
        return candidate.map(input);
      } catch (err) {
        return {
          entityType: this.detectEntityType(input),
          manufacturer: this.detectManufacturer(input),
          model: null,
          code: null,
          normalized: {},
          confidence: 0,
          errors: [
            `Mapper "${candidate.name}" lançou exceção: ${err instanceof Error ? err.message : String(err)}`,
          ],
          warnings: [],
          mapperName: candidate.name,
        };
      }
    }

    return {
      entityType: this.detectEntityType(input),
      manufacturer: this.detectManufacturer(input),
      model: null,
      code: null,
      normalized: {},
      confidence: 0,
      errors: ["Nenhum mapper especializado reconheceu este registro."],
      warnings: ["unmapped — registro permanecerá na camada raw até que um mapper seja adicionado."],
      mapperName: "universal",
    };
  },
};
