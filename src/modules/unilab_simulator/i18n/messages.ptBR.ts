// Mensagens de UI em pt-BR. Não traduzir engine, tipos, chaves de objetos.

export const ptBR = {
  module: {
    title: "UNILAB Simulator",
    subtitle:
      "Simulação termodinâmica de trocadores de calor com correções polinomiais UNILAB.",
    disclaimer:
      "Capacidade estimada por modelo termodinâmico com correções polinomiais. Os resultados não substituem a validação experimental ou o cálculo pelo software UNILAB original.",
  },
  dashboard: {
    intro: "Selecione um tipo de componente para iniciar a simulação.",
    cards: {
      evaporators: {
        title: "Evaporadores",
        description: "Expansão direta (DX) e bombeado.",
      },
      condensers: {
        title: "Condensadores",
        description: "A ar e casco-tubo.",
      },
      heating: {
        title: "Baterias de Aquecimento",
        description: "Aquecimento por água quente ou vapor.",
      },
      cooling: {
        title: "Baterias de Resfriamento",
        description: "Resfriamento por água gelada.",
      },
      defrost: {
        title: "Serpentinas de Degelo / Vapor",
        description: "Degelo ativo a vapor.",
      },
    },
  },
  workspace: {
    title: "Workspace UNILAB",
    columns: {
      geometry: "Geometria",
      thermo: "Termodinâmica",
      result: "Resultado",
    },
    actions: {
      simulate: "Simular Componente",
      sendToAssembly: "Enviar para Montagem",
      backToDashboard: "Voltar ao Dashboard",
    },
    fields: {
      componentType: "Tipo de componente",
      geometry: "Geometria base",
      finnedHeight: "Altura aletada",
      finnedLength: "Comprimento aletado",
      rows: "Número de fileiras",
      circuits: "Número de circuitos",
      tubeMaterial: "Material do tubo",
      finPitch: "Passo de aleta",
      finThickness: "Espessura da aleta",
      tubePitchTransverse: "Passo transversal",
      tubePitchLongitudinal: "Passo longitudinal",
      tubeOuterDiameter: "Diâmetro externo do tubo",
      tubeInnerDiameter: "Diâmetro interno do tubo",
      refrigerant: "Refrigerante / fluido",
      airFlow: "Vazão de ar",
      airInletTemp: "Temperatura de entrada do ar",
      airInletRh: "Umidade relativa de entrada",
      altitude: "Altitude do local",
      evaporatingTemp: "Temperatura de evaporação",
      condensingTemp: "Temperatura de condensação",
      superheat: "Superaquecimento",
      subcooling: "Sub-resfriamento",
    },
    result: {
      empty: "Preencha os campos e clique em Simular Componente para ver os resultados.",
      totalCapacity: "Capacidade total",
      sensibleCapacity: "Capacidade sensível",
      latentCapacity: "Capacidade latente",
      shf: "SHF",
      regime: "Regime",
      airPressureDrop: "Perda de carga (ar)",
      fluidPressureDrop: "Perda de carga (fluido)",
      airOutletTemp: "Temp. saída do ar",
      airOutletRh: "UR saída do ar",
      faceVelocity: "Velocidade de face",
      correctionFactor: "Fator UNILAB aplicado",
    },
  },
  datasets: {
    title: "Status dos catálogos UNILAB",
    loading: "Carregando catálogos…",
    ready: "Todos os catálogos carregados.",
    missingTitle: "Catálogos UNILAB ausentes",
    missingHint:
      "A simulação fica bloqueada até que todos os catálogos obrigatórios sejam disponibilizados em /data/catalogs/.",
    fileMissing: (file: string) => `Catálogo UNILAB não carregado: ${file}`,
    fileLoaded: (file: string) => `Catálogo carregado: ${file}`,
  },
  validation: {
    blockedNoDatasets: "Dados UNILAB não disponíveis para esta geometria.",
    geometryIncomplete: "Geometria incompleta para integração com ColdPro.",
    requiredField: (field: string) => `Campo obrigatório: ${field}`,
    invalidNumber: (field: string) => `Valor inválido em: ${field}`,
    needTempEvapOrCond:
      "Informe ao menos uma temperatura de evaporação ou de condensação.",
  },
} as const;
