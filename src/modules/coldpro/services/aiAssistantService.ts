import type { AIAssistantMessage } from "../types/frontend.types";

const SYSTEM_PROMPT = `
Você é o Engenheiro Assistente ColdPro, especialista em sistemas de refrigeração industrial.
Você auxilia engenheiros e técnicos a configurar, calcular e interpretar sistemas usando o motor ColdPro V2 da CN COLD / ColdAxis.

Responsabilidades:
- Sugerir preenchimento de campos técnicos com justificativa
- Explicar parâmetros em linguagem clara e precisa
- Indicar unidades e faixas típicas de valores
- Detectar valores fora do padrão e alertar
- Apontar inconsistências entre parâmetros
- Analisar gargalos (compressor, evaporador, condensador)
- Interpretar resultados do motor
- Sugerir melhorias de produto com base técnica
- Gerar observações técnicas e resumos executivos de validação

Regras invioláveis:
1. Você NUNCA substitui o motor físico. O motor calcula; você interpreta e recomenda.
2. Toda sugestão deve ter justificativa técnica explícita.
3. Nenhuma recomendação sua altera dados calculados sem aprovação do usuário.
4. Quando não souber, diga claramente e indique como verificar.
5. Use terminologia técnica de refrigeração (ASHRAE, EN 12900, AHRI 540).
`;

export async function askAssistant(
  messages: AIAssistantMessage[],
  context?: string,
): Promise<string> {
  const apiUrl = import.meta.env.VITE_FRONTEND_FORGE_API_URL;
  const apiKey = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
  if (!apiUrl || !apiKey) {
    return "IA Assistente não disponível neste ambiente.";
  }

  const chatMessages = [
    {
      role: "system" as const,
      content: SYSTEM_PROMPT + (context ? `\n\nContexto atual da sessão:\n${context}` : ""),
    },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: chatMessages,
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    return `Erro na IA: ${response.status} ${response.statusText}`;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "Erro ao obter resposta da IA.";
}

export function buildFieldHelpPrompt(
  fieldName: string,
  value: unknown,
  context: string,
): string {
  return `Campo: "${fieldName}" | Valor atual: "${value}" | Contexto: ${context}
Avalie se o valor é adequado e forneça orientação técnica em 2-3 frases objetivas.`;
}

export function buildResultInterpretationPrompt(resultType: string, result: unknown): string {
  return `Interprete o resultado de ${resultType} do motor ColdPro V2:
1. Avaliação geral (aprovado / atenção / crítico)
2. Principais observações técnicas (máximo 3)
3. Sugestões de melhoria, se houver

Resultado: ${JSON.stringify(result, null, 2)}`;
}
