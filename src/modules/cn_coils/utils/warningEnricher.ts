/**
 * warningEnricher.ts
 * Enriquece os warnings brutos do CycleEngine com:
 * - Severidade (error | warning | info)
 * - Explicação técnica do problema
 * - Sugestão de correção com valores recomendados
 */

export type WarningSeverity = "error" | "warning" | "info";

export interface EnrichedWarning {
  raw: string;
  severity: WarningSeverity;
  title: string;
  explanation: string;
  suggestion: string;
  parameter?: string; // campo do formulário relacionado
}

// ── Regras de enriquecimento ─────────────────────────────────────────────────
interface EnrichRule {
  match: RegExp | string | ((raw: string) => boolean);
  severity: WarningSeverity;
  title: string;
  explanation: string;
  suggestion: string;
  parameter?: string;
}

const ENRICH_RULES: EnrichRule[] = [
  // ── Convergência ──────────────────────────────────────────────────────────
  {
    match: /não convergiu/i,
    severity: "error",
    title: "Ciclo não convergiu",
    explanation:
      "O solver iterativo não encontrou equilíbrio entre compressor, evaporador e condensador dentro do número máximo de iterações. " +
      "Isso indica que as condições de projeto são fisicamente incompatíveis ou muito extremas para o modelo.",
    suggestion:
      "Verifique se Te está pelo menos 10°C abaixo de Tc. " +
      "Reduza o número de iterações iniciais aumentando a tolerância para 0,05. " +
      "Confirme que a vazão de ar e a geometria são compatíveis com a capacidade do compressor.",
    parameter: "solver",
  },
  // ── Superaquecimento baixo ─────────────────────────────────────────────────
  {
    match: (raw: string) => {
      const match = raw.match(/SH\s+real\s*\(\s*([\d.,]+)\s*K\)/i);
      if (match) {
        const value = Number.parseFloat(match[1].replace(",", "."));
        return Number.isFinite(value) && value < 3;
      }
      return /superaquecimento.*baixo/i.test(raw);
    },
    severity: "error",
    title: "Superaquecimento insuficiente",
    explanation:
      "Superaquecimento abaixo de 3K indica risco real de retorno de líquido ao compressor. " +
      "O refrigerante líquido no compressor causa golpe de líquido (liquid slugging), que pode destruir válvulas e pistões.",
    suggestion:
      "Ajuste o SH para no mínimo 5K (recomendado 5–8K para evaporadores DX). " +
      "Se usar VET, verifique a regulagem do bulbo sensor. " +
      "Reduza a carga de refrigerante ou aumente a temperatura de evaporação.",
    parameter: "superheat",
  },
  // ── Superaquecimento alto ──────────────────────────────────────────────────
  {
    match: /superheat.*[2-9]\d[,.]?\d*\s*K|SH.*[2-9]\d[,.]?\d*\s*K/i,
    severity: "warning",
    title: "Superaquecimento excessivo",
    explanation:
      "Superaquecimento acima de 15K reduz a capacidade do evaporador pois parte da área de troca é usada para superaquecer vapor, " +
      "não para evaporar refrigerante. Também aumenta a temperatura de descarga do compressor.",
    suggestion:
      "Reduza o SH para 5–10K ajustando a VET. " +
      "Verifique se a carga de refrigerante está correta (sistema com pouco refrigerante tende a SH alto).",
    parameter: "superheat",
  },
  // ── Te ajustado ───────────────────────────────────────────────────────────
  {
    match: /Te ajustado/i,
    severity: "warning",
    title: "Temperatura de evaporação ajustada automaticamente",
    explanation:
      "O solver detectou que Te estava muito próximo de Tc (diferença < 5°C), o que é fisicamente impossível " +
      "pois o ciclo de refrigeração requer Te < Tc. Te foi ajustado automaticamente.",
    suggestion:
      "Reduza Te ou aumente Tc nos parâmetros iniciais para garantir ΔT ≥ 10°C entre evaporação e condensação. " +
      "Verifique se o refrigerante e o compressor são adequados para as condições de projeto.",
    parameter: "te",
  },
  // ── Q_evap ≤ 0 ────────────────────────────────────────────────────────────
  {
    match: /Q_evap\s*[≤<=]\s*0|Q_evap.*zero/i,
    severity: "error",
    title: "Capacidade de evaporação nula ou negativa",
    explanation:
      "O compressor retornou capacidade de evaporação ≤ 0 para as condições especificadas. " +
      "Isso ocorre quando Te está muito alto (próximo de Tc) ou o compressor não é adequado para o refrigerante.",
    suggestion:
      "Reduza Te (temperatura de evaporação) em 5–10°C. " +
      "Verifique se o compressor selecionado é compatível com o refrigerante e as condições de operação. " +
      "Confirme que Te < Tc − 10°C.",
    parameter: "te",
  },
  // ── Velocidade frontal alta ────────────────────────────────────────────────
  {
    match: /velocidade frontal.*alta|frontal.*[3-9]\.\d+\s*m\/s/i,
    severity: "warning",
    title: "Velocidade frontal do ar elevada",
    explanation:
      "Velocidade frontal acima de 3,0 m/s causa arraste de gotículas de água condensada para o ambiente " +
      "(carry-over), aumenta a queda de pressão no ar e reduz a eficiência do ventilador.",
    suggestion:
      "Aumente a altura ou largura da serpentina para reduzir a velocidade frontal para 2,0–2,5 m/s. " +
      "Alternativamente, reduza a vazão de ar.",
    parameter: "airFlow",
  },
  // ── Velocidade frontal baixa ───────────────────────────────────────────────
  {
    match: /velocidade frontal.*baixa|frontal.*0\.[0-4]\d*\s*m\/s/i,
    severity: "info",
    title: "Velocidade frontal do ar baixa",
    explanation:
      "Velocidade frontal abaixo de 1,0 m/s indica subdimensionamento do ventilador ou superdimensionamento " +
      "da serpentina. A transferência de calor por convecção é reduzida.",
    suggestion:
      "Aumente a vazão de ar ou reduza as dimensões da serpentina para atingir 1,5–2,5 m/s.",
    parameter: "airFlow",
  },
  // ── Queda de pressão alta ─────────────────────────────────────────────────
  {
    match: /queda de pressão.*alta|pressure drop.*high|\bΔP\b.*[3-9]\d{2,}/i,
    severity: "warning",
    title: "Queda de pressão no ar elevada",
    explanation:
      "Queda de pressão acima de 200 Pa aumenta o consumo do ventilador e pode causar " +
      "recirculação de ar quente se a pressão estática disponível for insuficiente.",
    suggestion:
      "Reduza o número de filas de tubos ou aumente o passo de aleta (finPitch). " +
      "Verifique se o ventilador tem pressão estática disponível suficiente.",
    parameter: "rows",
  },
  // ── COP baixo ─────────────────────────────────────────────────────────────
  {
    match: /COP.*[0-1]\.\d+|coeficiente.*desempenho.*baixo/i,
    severity: "warning",
    title: "COP abaixo do esperado",
    explanation:
      "COP abaixo de 1,5 indica operação ineficiente. Pode ser causado por alta temperatura de condensação, " +
      "baixa temperatura de evaporação, superaquecimento excessivo ou compressor subdimensionado.",
    suggestion:
      "Reduza Tc melhorando a rejeição de calor (mais área de condensador, menor temperatura do ar). " +
      "Aumente Te se a aplicação permitir. " +
      "Verifique o subcooling (recomendado 5–8K para melhorar COP).",
    parameter: "tc",
  },
  // ── Geada ─────────────────────────────────────────────────────────────────
  {
    match: /geada|frost|formação de gelo/i,
    severity: "warning",
    title: "Risco de formação de geada",
    explanation:
      "Com temperatura de evaporação abaixo de 0°C e umidade relativa do ar acima de 60%, " +
      "há formação de geada nas aletas. A geada reduz progressivamente a capacidade e aumenta a queda de pressão.",
    suggestion:
      "Programe ciclos de degelo a cada 4–8 horas de operação. " +
      "Para câmaras frigoríficas, use degelo elétrico ou a gás quente. " +
      "Considere aumentar o passo de aleta (≥ 6mm) para aplicações com geada intensa.",
    parameter: "te",
  },
  // ── Resíduo alto ──────────────────────────────────────────────────────────
  {
    match: /resíduo.*[5-9]\d\.\d*%|resíduo.*1[0-9]\d\.\d*%/i,
    severity: "warning",
    title: "Resíduo de convergência alto",
    explanation:
      "O ciclo convergiu com resíduo acima de 5%, indicando que há desequilíbrio entre as capacidades " +
      "do compressor, evaporador e condensador. O resultado é uma estimativa.",
    suggestion:
      "Ajuste as dimensões do evaporador ou condensador para melhor compatibilidade com o compressor. " +
      "Verifique se as condições de Te e Tc são realistas para o compressor selecionado.",
    parameter: "solver",
  },
];

// ── Regra padrão ─────────────────────────────────────────────────────────────
function defaultEnrich(raw: string): EnrichedWarning {
  return {
    raw,
    severity: "info",
    title: "Aviso do sistema",
    explanation: raw,
    suggestion: "Verifique os parâmetros de entrada e consulte a documentação técnica do equipamento.",
  };
}

// ── Função principal ─────────────────────────────────────────────────────────
export function enrichWarnings(rawWarnings: string[]): EnrichedWarning[] {
  return rawWarnings.map((raw) => {
    for (const rule of ENRICH_RULES) {
      const matches =
        typeof rule.match === "string"
          ? raw.toLowerCase().includes(rule.match.toLowerCase())
          : typeof rule.match === "function"
            ? rule.match(raw)
            : rule.match.test(raw);
      if (matches) {
        return {
          raw,
          severity: rule.severity,
          title: rule.title,
          explanation: rule.explanation,
          suggestion: rule.suggestion,
          parameter: rule.parameter,
        };
      }
    }
    return defaultEnrich(raw);
  });
}

export function getWorstSeverity(warnings: EnrichedWarning[]): WarningSeverity | null {
  if (warnings.some((w) => w.severity === "error")) return "error";
  if (warnings.some((w) => w.severity === "warning")) return "warning";
  if (warnings.some((w) => w.severity === "info")) return "info";
  return null;
}
