export interface WarningSuggestion {
  /** Campos da UI que o usuário deve revisar. */
  fields: string[];
  /** Ações corretivas sugeridas. */
  actions: string[];
  /** Nível de severidade sugerido. */
  level?: "1" | "2" | "3";
}

/**
 * Mapa de padrões de texto -> sugestão contextual.
 * A primeira correspondência encontrada é usada.
 */
export const WARN_SUGGESTIONS: Array<{
  pattern: RegExp;
  suggestion: WarningSuggestion;
}> = [
  {
    pattern: /Re=\d+.*acima de 10[.,]?000|Re.*extrapolação|extrapolação moderada/i,
    suggestion: {
      fields: ["Vazão de ar (m³/h)", "Número de circuitos", "Altura aletada (mm)"],
      actions: [
        "Reduza a vazão de ar — o Re ideal para correlações Wang-Chi-Chang é entre 1.000 e 10.000.",
        "Aumente a altura aletada ou o comprimento aletado para aumentar a área de face e reduzir a velocidade.",
        "Adicione mais circuitos para distribuir melhor o fluido e reduzir Re interno.",
        "Considere usar uma geometria com maior passo de aleta (fp maior) para a mesma vazão.",
      ],
      level: "2",
    },
  },
  {
    pattern: /velocidade.*acima da faixa válida|acima da faixa de perda de carga|usando vMax/i,
    suggestion: {
      fields: ["Vazão de ar (m³/h)", "Altura aletada (mm)", "Comprimento aletado (mm)"],
      actions: [
        "Reduza a vazão de ar total para manter a velocidade de face dentro da faixa calibrada (tipicamente 1,5–4,5 m/s).",
        "Aumente a área de face: aumente a altura aletada ou o comprimento aletado.",
        "Verifique se o número de ventiladores está correto — mais ventiladores em paralelo reduzem a velocidade por unidade.",
        "O resultado de ΔP ar pode estar subestimado — use com cautela para seleção de ventilador.",
      ],
      level: "2",
    },
  },
  {
    pattern: /velocidade.*abaixo da faixa válida|abaixo da faixa de perda de carga|usando vMin/i,
    suggestion: {
      fields: ["Vazão de ar (m³/h)", "Número de ventiladores"],
      actions: [
        "Aumente a vazão de ar — velocidades muito baixas indicam subdimensionamento do ventilador.",
        "Reduza a área de face (altura ou comprimento aletado) se a vazão for fixa.",
        "Verifique se o número de ventiladores está correto — menos ventiladores em paralelo aumentam a velocidade por unidade.",
      ],
      level: "1",
    },
  },
  {
    pattern: /Re=\d+.*laminar|regime laminar.*Re|laminar.*Re=\d+|Reynolds.*laminar/i,
    suggestion: {
      fields: ["Número de circuitos", "Vazão de fluido (kg/h)", "Diâmetro interno do tubo (mm)"],
      actions: [
        "Reduza o número de circuitos — menos circuitos aumentam a velocidade de massa por tubo e elevam o Re.",
        "Aumente a vazão de fluido (kg/h) se o processo permitir.",
        "Reduza o diâmetro interno do tubo para aumentar a velocidade de escoamento.",
        "Re < 2.300 indica regime laminar: o coeficiente h_fluido calculado por Dittus-Boelter é inválido nesta faixa. O resultado de capacidade pode estar superestimado.",
        "Faixa recomendada: Re > 4.000 para escoamento turbulento pleno.",
      ],
      level: "3",
    },
  },
  {
    pattern: /velocidade do fluido.*fora da faixa|velocidade muito baixa.*m\/s|velocidade.*0[,.]\d+ m\/s.*fora/i,
    suggestion: {
      fields: ["Número de circuitos", "Vazão de fluido (kg/h)", "Diâmetro interno do tubo (mm)"],
      actions: [
        "Velocidade < 0,1 m/s: reduza o número de circuitos ou aumente a vazão de fluido.",
        "Velocidade > 5 m/s: aumente o número de circuitos ou reduza a vazão de fluido.",
        "Faixa típica recomendada: 0,3–2,0 m/s para refrigerante líquido; 0,1–1,0 m/s para água gelada.",
        "Velocidades muito baixas causam estratificação e redução do coeficiente de transferência de calor.",
      ],
      level: "2",
    },
  },
  {
    pattern: /ΔP ar estimado por correlação Chang.*Wang|Chang.*Wang.*1997|Wang.*Chang.*ΔP/i,
    suggestion: {
      fields: ["Geometria base", "Passo de aleta (mm)", "Número de fileiras"],
      actions: [
        "Este é um aviso informativo — a correlação Chang & Wang (1997) é o método padrão para aletas planas.",
        "Para maior precisão, certifique-se de que a geometria selecionada possui dados de ΔP ar no catálogo CN Coils.",
        "Verifique se o passo de aleta (fp) está dentro da faixa da correlação: 1,0–3,0 mm.",
        "Geometrias com mais de 4 fileiras podem apresentar desvio maior — valide com dados experimentais.",
      ],
      level: "1",
    },
  },
  {
    pattern: /coeficientes de correção.*ausentes|coeficientes de correção não encontrados|fator.*1[,.]0.*estimativa/i,
    suggestion: {
      fields: ["Geometria base"],
      actions: [
        "A geometria selecionada não possui coeficientes polinomiais CN Coils — o resultado é uma estimativa sem correção.",
        "Preencha o arquivo public/data/catalogs/cncoilsCoefficients.json com os coeficientes para esta geometria.",
        "Enquanto os coeficientes não estiverem disponíveis, o fator de correção é 1,0 (sem ajuste).",
        "Selecione uma geometria alternativa que já possua coeficientes calibrados para maior confiabilidade.",
      ],
      level: "2",
    },
  },
  {
    pattern: /coeficientes CN Coils ausentes|h_air_polynomial/i,
    suggestion: {
      fields: ["Geometria base"],
      actions: [
        "O motor V2 requer coeficientes h_ar(v) para esta geometria em cncoilsHeatTransferCoefficients.json.",
        "Preencha o campo h_air_polynomial com os coeficientes do polinômio h_ar em função da velocidade frontal [m/s].",
        "Enquanto não preenchido, o motor V2 não pode calcular — use o motor V1 como alternativa.",
      ],
      level: "3",
    },
  },
  {
    pattern: /ΔP do fluido estimado com densidade.*atrito típicos|refine com propriedades reais/i,
    suggestion: {
      fields: ["Refrigerante / fluido", "Número de circuitos", "Número de fileiras"],
      actions: [
        "O ΔP de fluido foi calculado com valores típicos de refrigerante líquido.",
        "Para maior precisão, forneça propriedades reais do fluido nas configurações avançadas.",
        "Para fluidos bifásicos, o ΔP real pode ser 2–5x maior — use com cautela para seleção de bomba.",
        "Aumente o número de circuitos para reduzir o ΔP de fluido se o valor calculado for excessivo.",
      ],
      level: "1",
    },
  },
  {
    pattern: /geometria sem uBaseWm2K|uBaseWm2K.*catálogo|coeficiente U não pode ser estimado/i,
    suggestion: {
      fields: ["Geometria base"],
      actions: [
        "A geometria selecionada não possui coeficiente U base no catálogo.",
        "Selecione uma geometria diferente que possua uBaseWm2K definido no catálogo CN Coils.",
        "Ou preencha o campo uBaseWm2K no catálogo para esta geometria antes de simular.",
      ],
      level: "3",
    },
  },
  {
    pattern: /velocidade de face nula|face.*nula|nula.*face/i,
    suggestion: {
      fields: ["Vazão de ar (m³/h)", "Altura aletada (mm)", "Comprimento aletado (mm)"],
      actions: [
        "A vazão de ar está zerada ou a área de face é inválida.",
        "Verifique se a vazão de ar (m³/h) foi informada corretamente.",
        "Verifique se a altura aletada e o comprimento aletado são maiores que zero.",
      ],
      level: "3",
    },
  },
  {
    pattern: /Wang-Chi-Chang.*σ fora de faixa|sigma.*fora de faixa/i,
    suggestion: {
      fields: ["Passo transversal (mm)", "Passo longitudinal (mm)", "Diâmetro externo do tubo (mm)"],
      actions: [
        "O parâmetro sigma está fora da faixa da correlação Wang-Chi-Chang (0,3–0,8).",
        "Verifique os passos transversal e longitudinal em relação ao diâmetro externo do tubo.",
        "Selecione uma geometria com proporções mais típicas de trocadores aletados industriais.",
      ],
      level: "2",
    },
  },
  {
    pattern: /Wang-Chi-Chang.*geometria.*velocidade inválida|Wang-Chi-Chang.*inválida/i,
    suggestion: {
      fields: ["Geometria base", "Vazão de ar (m³/h)", "Passo de aleta (mm)"],
      actions: [
        "A correlação Wang-Chi-Chang não pôde ser aplicada — verifique se todos os parâmetros geométricos estão preenchidos.",
        "Certifique-se de que o passo de aleta (fp), passo transversal (Pt) e passo longitudinal (Pl) são maiores que zero.",
        "Verifique se a velocidade de face é maior que zero.",
      ],
      level: "3",
    },
  },
  {
    pattern: /h_ar inválido|h_air.*inválido|Wang-Chi-Chang.*h_ar/i,
    suggestion: {
      fields: ["Geometria base", "Vazão de ar (m³/h)", "Passo de aleta (mm)"],
      actions: [
        "O coeficiente de transferência de calor do ar resultou em valor inválido.",
        "Verifique se a geometria selecionada é compatível com a correlação Wang-Chi-Chang (aletas planas).",
        "Tente reduzir ou aumentar a velocidade de face para dentro da faixa 1,5–4,5 m/s.",
      ],
      level: "3",
    },
  },
  {
    pattern: /h_ar acima de 200 W\/m²K|h_ar.*200.*incomum/i,
    suggestion: {
      fields: ["Vazão de ar (m³/h)", "Geometria base"],
      actions: [
        "Valor de h_ar muito alto para ar seco — verifique se a velocidade de face não está superestimada.",
        "Confirme se a área de face (altura x comprimento aletado) está correta.",
        "Valores acima de 200 W/m²K são incomuns para ar seco — podem indicar erro de entrada.",
      ],
      level: "2",
    },
  },
  {
    pattern: /sem dados de perda de carga|coeficientes de perda de carga ausentes/i,
    suggestion: {
      fields: ["Geometria base"],
      actions: [
        "A geometria selecionada não possui dados de ΔP ar no catálogo.",
        "Preencha os coeficientes de perda de carga para esta geometria no catálogo CN Coils.",
        "O ΔP ar não será calculado — selecione uma geometria com dados de catálogo para obter este resultado.",
      ],
      level: "2",
    },
  },
  {
    pattern: /circuito \d+.*regime laminar|regime laminar.*circuito \d+/i,
    suggestion: {
      fields: ["Número de circuitos", "Vazão de fluido (kg/h)"],
      actions: [
        "Reduza o número de circuitos para aumentar a velocidade de massa por tubo.",
        "Aumente a vazão de fluido se o processo permitir.",
        "Re < 2.300 em qualquer circuito compromete a precisão do h_fluido calculado.",
      ],
      level: "3",
    },
  },
  {
    pattern: /circuito \d+.*velocidade muito baixa/i,
    suggestion: {
      fields: ["Número de circuitos", "Vazão de fluido (kg/h)"],
      actions: [
        "Reduza o número de circuitos para concentrar o fluxo e aumentar a velocidade.",
        "Velocidade < 0,1 m/s indica risco de estratificação e redução severa do h_fluido.",
      ],
      level: "2",
    },
  },
  {
    pattern: /circuito \d+.*velocidade muito alta/i,
    suggestion: {
      fields: ["Número de circuitos", "Vazão de fluido (kg/h)"],
      actions: [
        "Aumente o número de circuitos para distribuir o fluxo e reduzir a velocidade.",
        "Velocidade > 5 m/s causa ΔP fluido excessivo e risco de erosão nos tubos.",
      ],
      level: "2",
    },
  },
];

export function getSuggestionForWarning(warningText: string): WarningSuggestion | null {
  for (const entry of WARN_SUGGESTIONS) {
    if (entry.pattern.test(warningText)) return entry.suggestion;
  }
  return null;
}
