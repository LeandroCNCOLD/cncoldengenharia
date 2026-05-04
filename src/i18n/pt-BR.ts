export const ptBR = {
  common: {
    calculate: "Calcular",
    clear: "Limpar",
    cancel: "Cancelar",
    loading: "Carregando...",
    error: "Erro",
    success: "Sucesso",
    dashboard: "Painel",
    close: "Fechar",
    save: "Salvar",
    search: "Buscar",
    import: "Importar",
    select: "Selecionar",
    previous: "Anterior",
    next: "Próxima",
    active: "Ativa",
    administrator: "Administrador",
    engineer: "Engenheiro",
    signOut: "Sair",
    email: "E-mail",
    password: "Senha",
    signIn: "Entrar",
    signUp: "Criar conta",
  },

  simulation: {
    title: "Simulação",
    run: "Simular",
    results: "Resultados",
    noData: "Nenhum dado disponível",
  },

  geometry: {
    title: "Geometria",
    select: "Selecionar geometria",
    airflow: "Vazão de ar",
    airTemperature: "Temperatura do ar",
    humidity: "Umidade relativa",
  },

  alerts: {
    missingData: "Dados obrigatórios não informados",
    invalidInput: "Entrada inválida",
    incompleteGeometry: "Geometria incompleta",
    simulationBlocked: "Simulação bloqueada por falta de dados",
  },

  auth: {
    platformTitle: "Acessar plataforma",
    platformSubtitle: "Use seu e-mail corporativo para entrar.",
    signInFailure: "Falha ao entrar",
    signUpFailure: "Falha ao criar conta",
    welcome: "Bem-vindo!",
    accountCreated: "Conta criada",
    accountReady: "Você já pode entrar.",
    fullName: "Nome completo",
    or: "ou",
    continueWithGoogle: "Continuar com Google",
    googleFailure: "Falha ao entrar com Google",
    brandTitle: "Engenharia CN Cold",
    brandDescription:
      "Plataforma técnica interna para gestão de componentes frigoríficos, ingestão de arquivos e catálogo técnico — preparada para evoluir com simulação, comparação e relatórios.",
    footer: "nossa especialidade é o frio",
  },

  navigation: {
    coldProV2: "ColdPro V2",
    cnCold: "CN COLD",
    catalog: "Catálogo CN COLD",
    components: "Componentes",
    assembly: "Montagem",
    systemEquilibrium: "Equilíbrio do Sistema",
    performanceCurve: "Curva de Desempenho",
    unilabSimulator: "CN COILS",
    operatingMap: "Mapa Operacional",
    productRecord: "Ficha Técnica",
    productRegistry: "Registro de Produtos",
    export: "Exportação",
    audit: "Auditoria CN COLD",
    settings: "Configurações",
    library: "Biblioteca",
    engineV2: "Motor V2 — CN COLD",
  },

  dashboard: {
    title: "Painel ColdPro V2",
    subtitle: "Centro de operações técnicas — motor de cálculo CN COLD.",
    newSession: "Nova sessão",
    recentSessions: "Sessões recentes",
    total: "no total",
    emptySessions: "Nenhuma sessão ainda. Crie uma nova sessão para começar.",
    mode: "modo",
    engineStatus: "Status do motor",
    version: "Versão",
    currentMode: "Modo atual",
    memorySessions: "Sessões em memória",
    availableModules: "Módulos disponíveis",
  },

  components: {
    tabs: {
      compressor: {
        label: "Compressor",
        description: "Compressor frigorífico",
      },
      coil: {
        label: "Serpentina",
        description: "Aletado progressivo (evaporador/condensador/reaquecimento)",
      },
      condenser: {
        label: "Condensador",
        description: "Condensador a ar ou a água",
      },
      fan: {
        label: "Ventilador",
        description: "Ventilador de evaporador ou condensador",
      },
      expansionValve: {
        label: "Válvula Exp.",
        description: "Válvula de expansão",
      },
      fourWayValve: {
        label: "Válvula 4 Vias",
        description: "Válvula 4 vias (reversão de ciclo)",
      },
      dripTray: {
        label: "Serpentina Bandeja",
        description: "Subresfriamento e degelo da bandeja",
      },
      defrost: {
        label: "Degelo",
        description: "Configuração do ciclo de degelo",
      },
      agro: {
        label: "AGRO / Desum.",
        description: "Ciclo AGRO com controle de umidade",
      },
      reheat: {
        label: "Reaquecimento",
        description: "Bateria de reaquecimento",
      },
      frost: {
        label: "Formação de Gelo",
        description: "Modelo de formação de gelo",
      },
    },
    title: "Componentes",
    subtitle: "Cadastre e dimensione componentes individuais antes de montar o equipamento.",
    new: "Novo",
    registered: "cadastrado",
    noneRegistered: "Nenhum componente cadastrado ainda.",
    first: "Cadastrar o primeiro",
    bitzerCatalog: "Catálogo Bitzer (oficial)",
    generalCatalog: "Catálogo geral (Copeland · Bristol · outros)",
    placeholders: {
      compressor: "Ex.: Bitzer 4FES-3Y",
      coil: "Ex.: Evaporador 600×800 2R",
      condenser: "Ex.: Condensador 7500 W",
      fan: "Ex.: Ventilador 4000 m³/h",
      expansionValve: "Ex.: Válvula de expansão 5 kW",
      reheat: "Ex.: Reaquecimento 2 kW",
    },
    materials: {
      copper: "Cobre",
      aluminum: "Alumínio",
      steel: "Aço",
      stainless_steel: "Aço inoxidável",
    },
    rollsConfig: "Configuração de fileiras",
  },

  catalog: {
    rows: "Fileiras",
    tubesPerRow: "Tubos/fileira",
    transversePitch: "Passo transversal",
    longitudinalPitch: "Passo longitudinal",
    legacyLength: "Comprimento (legado)",
    legacySurfaceArea: "Área de superfície (legado)",
    rawData: "Dados brutos",
  },

  charts: {
    compressor: "Compressor",
    evaporator: "Evaporador",
    condenser: "Condensador",
    evaporatorFan: "Vent. evaporador",
    condenserFan: "Vent. condensador",
    valve: "Válvula",
    utilization: "Utilização",
  },

  meta: {
    title: "Engenharia CN Cold",
    description:
      "Plataforma técnica interna da CN Cold para gestão de componentes frigoríficos, ingestão de arquivos e catálogo técnico.",
    shortDescription: "Plataforma técnica interna da CN Cold.",
  },
};
