/**
 * WorkspaceAIChat.tsx
 * Painel de chat com IA especialista em refrigeração industrial.
 * Recebe contexto do workspace (tipo de componente, parâmetros, resultados, avisos)
 * e permite conversa livre sobre problemas de campo, ajustes e interpretação de resultados.
 *
 * Recursos:
 * - System prompt especializado por componente (Evaporador, Condensador, Compressor, etc.)
 * - Quick prompts dinâmicos baseados na aba ativa
 * - Modo Chat (com contexto) / Pesquisar (consulta normativa)
 * - Histórico persistente por componente+aba (useAIChatStore)
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Bot,
  Send,
  X,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Thermometer,
  Wrench,
  BookOpen,
  RefreshCw,
  MessageSquare,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EnrichedWarning } from "../utils/warningEnricher";
import {
  useAIChatStore,
  buildSessionKey,
  type PersistedMessage,
} from "../store/useAIChatStore";

export interface AIContext {
  componentType: string; // "Evaporador DX" | "Condensador a Ar" | etc.
  tabName: string;       // nome da aba atual
  parameters?: Record<string, string | number>;
  results?: Record<string, string | number>;
  warnings?: EnrichedWarning[];
  refrigerant?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

type ChatMode = "chat" | "search";

interface WorkspaceAIChatProps {
  context: AIContext;
  isOpen: boolean;
  onClose: () => void;
}

const COMPONENT_SPECIALTY: Record<string, string> = {
  "Evaporador DX": `
ESPECIALIDADE — EVAPORADORES DX:
- Dimensionamento NTU-ε e ASHRAE
- Controle de superaquecimento (SH recomendado: 5-8K)
- Risco de retorno de líquido (liquid slugging) quando SH < 3K
- Formação de geada: ocorre quando Ts_aleta < 0°C com UR > 70%
- Circuitagem: máx. 3-4 tubos/circuito para R404A
- Velocidade frontal ideal: 2,0-3,5 m/s (câmara fria), 1,5-2,5 m/s (climatização)
- Queda de pressão no lado do ar: máx. 80 Pa para baixa velocidade
`,
  "Condensador a Ar": `
ESPECIALIDADE — CONDENSADORES A AR:
- Temperatura de condensação típica: Tamb + 10-15K (mínimo)
- Velocidade frontal ideal: 2,5-4,0 m/s
- Sub-resfriamento (SC) recomendado: 3-5K
- Alta Tc (>55°C) indica condensador subdimensionado ou ventilação insuficiente
- Passo de aleta típico: 2,0-3,0 mm (ar limpo), 3,0-4,0 mm (ar sujo)
- Cuidado com recirculação de ar quente em instalações fechadas
`,
  "Compressor": `
ESPECIALIDADE — COMPRESSORES:
- COP típico R404A: 1,5-2,5 (câmara fria), 2,5-4,0 (climatização)
- Temperatura de descarga: máx. 120°C (R404A), 130°C (R134a)
- Razão de compressão ideal: 3:1 a 6:1
- Eficiência volumétrica cai com alta razão de compressão
- Proteção: pressostato alta/baixa, termostato de descarga, protetor de motor
- Superaquecimento de sucção (SH total): mín. 10K para proteção do compressor
`,
  "Cond. Evaporativo": `
ESPECIALIDADE — CONDENSADORES EVAPORATIVOS:
- Temperatura de bulbo úmido do ar é o parâmetro crítico (não bulbo seco)
- Tc típica: Tbu + 6-10K
- Consumo de água: 1,5-3,0 L/kW·h
- Tratamento de água obrigatório (incrustações reduzem eficiência em 20-40%)
- Velocidade do ar na saída: 3,5-5,0 m/s
`,
  "Cond. a Água": `
ESPECIALIDADE — CONDENSADORES A ÁGUA:
- ΔT água típico: 5-8K (entrada/saída)
- Tc típica: Tágua_saída + 3-5K
- Fouling factor: 0,0001 m²K/W (água tratada), 0,0002 (água de rio)
- Velocidade da água nos tubos: 1,5-3,0 m/s (anti-incrustação)
- Pressão máxima: verificar rating do casco
`,
  "Bat. Aquecimento": `
ESPECIALIDADE — BATERIAS DE AQUECIMENTO:
- ΔT log médio: calcular com temperaturas de entrada/saída do fluido e do ar
- Velocidade frontal: 2,0-4,0 m/s
- Fluido: água quente (60-90°C), vapor (110-150°C), glicol
- Cuidado com congelamento em climas frios (mín. 30% glicol)
- Eficiência de transferência: verificar sujeira nas aletas (limpeza semestral)
`,
};

const QUICK_PROMPTS_BASE = [
  { icon: Thermometer, label: "Interpretar resultados", text: "Interprete os resultados atuais e diga se o equipamento está bem dimensionado." },
  { icon: AlertTriangle, label: "Analisar avisos", text: "Analise os avisos ativos e me dê um diagnóstico completo com prioridade de correção." },
];

const QUICK_PROMPTS_BY_TAB: Record<string, Array<{ icon: LucideIcon; label: string; text: string }>> = {
  "Detalhado": [
    { icon: Wrench, label: "Verificar geometria", text: "A geometria do aletado está adequada para a aplicação? Sugira ajustes se necessário." },
    { icon: BookOpen, label: "Normas aplicáveis", text: "Quais normas técnicas (ASHRAE, ABNT, EN) se aplicam a este equipamento?" },
  ],
  "Ciclo P-H": [
    { icon: Wrench, label: "Analisar ciclo", text: "Analise o diagrama P-H e identifique ineficiências no ciclo termodinâmico." },
    { icon: RefreshCw, label: "Otimizar ciclo", text: "Como posso melhorar o COP deste ciclo? Quais parâmetros ajustar?" },
  ],
  "Geada": [
    { icon: Wrench, label: "Risco de geada", text: "Qual é o risco de formação de geada nesta condição? Quando devo programar o degelo?" },
    { icon: BookOpen, label: "Tipo de degelo", text: "Qual tipo de degelo (elétrico, gás quente, ar quente) é mais adequado para esta aplicação?" },
  ],
  "Mapa Operacional": [
    { icon: Thermometer, label: "Ponto ótimo", text: "Analisando o mapa operacional, qual é o ponto de operação mais eficiente?" },
    { icon: Wrench, label: "Limites operacionais", text: "Quais são os limites operacionais críticos que não devo ultrapassar?" },
  ],
  "Envelope Q×Te": [
    { icon: Wrench, label: "Interpretar envelope", text: "Interprete a curva de envelope e diga se a capacidade está adequada para a aplicação." },
    { icon: BookOpen, label: "Usar equação", text: "Como usar a equação polinomial gerada para seleção de equipamentos em planilhas?" },
  ],
  "Desenho": [
    { icon: Wrench, label: "Verificar dimensões", text: "As dimensões do equipamento são adequadas para a instalação? Há restrições de espaço a considerar?" },
    { icon: BookOpen, label: "Exportar para CAD", text: "Como importar o DXF gerado no AutoCAD/SolidWorks e quais layers estão disponíveis?" },
  ],
};

const QUICK_PROMPTS_DEFAULT = [
  { icon: Wrench, label: "Problema de campo", text: "O equipamento está em campo com capacidade abaixo do projeto. Quais são as causas mais prováveis?" },
  { icon: BookOpen, label: "Boas práticas", text: "Quais são as boas práticas de instalação e manutenção para este tipo de equipamento?" },
];

const SEARCH_PROMPTS = [
  { icon: BookOpen, label: "Norma ASHRAE", text: "Quais seções do ASHRAE Handbook tratam de evaporadores DX?" },
  { icon: BookOpen, label: "Limites EN 12900", text: "Quais são os limites de operação definidos pela EN 12900 para compressores?" },
  { icon: BookOpen, label: "Fórmula NTU-ε", text: "Mostre a fórmula NTU-ε para trocadores de calor de fluxo cruzado." },
  { icon: BookOpen, label: "Fabricantes", text: "Quais fabricantes (Bitzer, Copeland, Danfoss) publicam dados de seleção compatíveis com EN 12900?" },
];

function getQuickPrompts(mode: ChatMode, tabName: string) {
  if (mode === "search") return SEARCH_PROMPTS;
  return [...QUICK_PROMPTS_BASE, ...(QUICK_PROMPTS_BY_TAB[tabName] ?? QUICK_PROMPTS_DEFAULT)];
}

function buildSystemPrompt(ctx: AIContext, mode: ChatMode): string {
  if (mode === "search") {
    return `Você é um engenheiro consultor sênior em refrigeração industrial e HVAC da CN Cold Engenharia.
Modo: PESQUISA TÉCNICA.

Quando o usuário fizer uma pergunta técnica, responda com:
1. Resposta direta e objetiva
2. Referência normativa (ASHRAE Handbook, EN 12900, ABNT NBR, AHRI 540, etc.)
3. Fonte do fabricante quando aplicável (Copeland, Bitzer, Danfoss, Emerson)
4. Fórmula ou equação relevante, se houver

Formato: use markdown com headers e listas para organizar a resposta.
Responda sempre em português brasileiro. Máximo 400 palavras.`;
  }

  const paramStr = ctx.parameters
    ? Object.entries(ctx.parameters)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join("\n")
    : "  (não disponível)";

  const resultStr = ctx.results
    ? Object.entries(ctx.results)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join("\n")
    : "  (cálculo não executado)";

  const warnStr = ctx.warnings?.length
    ? ctx.warnings
        .map((w) => `  [${w.severity.toUpperCase()}] ${w.title}: ${w.explanation}`)
        .join("\n")
    : "  Nenhum aviso ativo.";

  const specialty = COMPONENT_SPECIALTY[ctx.componentType] ?? "";

  return `Você é um engenheiro especialista sênior em refrigeração industrial e HVAC da CN Cold Engenharia, com mais de 20 anos de experiência em projeto, instalação e manutenção de trocadores de calor, sistemas de expansão direta (DX), câmaras frigoríficas e sistemas de climatização industrial.

Você está auxiliando o engenheiro no workspace de ${ctx.componentType}, especificamente na aba "${ctx.tabName}".
${specialty}
CONTEXTO ATUAL DO EQUIPAMENTO:
Refrigerante: ${ctx.refrigerant ?? "não especificado"}

Parâmetros de entrada:
${paramStr}

Resultados do cálculo:
${resultStr}

Avisos ativos:
${warnStr}

INSTRUÇÕES:
1. Responda sempre em português brasileiro, de forma técnica mas acessível.
2. Quando relevante, cite valores numéricos recomendados (ex: SH recomendado: 5–8K).
3. Para problemas de campo, liste as causas mais prováveis em ordem de probabilidade.
4. Se precisar de mais informações, pergunte de forma objetiva.
5. Mantenha respostas concisas (máximo 300 palavras) a menos que o usuário peça detalhes.
6. Quando citar normas ou referências técnicas, indique a fonte (ASHRAE, ABNT, fabricante).
7. Se o usuário descrever um problema de campo, sempre pergunte sobre: temperatura ambiente, carga térmica real, estado do refrigerante e histórico de manutenção.`;
}

async function callAI(messages: Message[], systemPrompt: string): Promise<string> {
  const apiUrl = import.meta.env.VITE_FRONTEND_FORGE_API_URL;
  const apiKey = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("API de IA não configurada. Verifique as variáveis de ambiente.");
  }

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m) => m.role !== "system")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: 600,
    temperature: 0.4,
  };

  const res = await fetch(`${apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro na API: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "Sem resposta da IA.";
}

const toPersisted = (m: Message): PersistedMessage => ({
  id: m.id,
  role: m.role,
  content: m.content,
  timestamp: m.timestamp.toISOString(),
});

const fromPersisted = (m: PersistedMessage): Message => ({
  id: m.id,
  role: m.role,
  content: m.content,
  timestamp: new Date(m.timestamp),
});

export function WorkspaceAIChat({ context, isOpen, onClose }: WorkspaceAIChatProps) {
  const [mode, setMode] = useState<ChatMode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionKey = useMemo(
    () => buildSessionKey(`${mode}:${context.componentType}`, context.tabName),
    [mode, context.componentType, context.tabName],
  );
  const getSession = useAIChatStore((s) => s.getSession);
  const saveSession = useAIChatStore((s) => s.saveSession);
  const clearSession = useAIChatStore((s) => s.clearSession);

  const systemPrompt = useMemo(() => buildSystemPrompt(context, mode), [context, mode]);
  const quickPrompts = useMemo(
    () => getQuickPrompts(mode, context.tabName),
    [mode, context.tabName],
  );

  // Load history when panel opens or context/mode changes
  useEffect(() => {
    if (!isOpen) return;
    const stored = getSession(sessionKey);
    if (stored && stored.messages.length > 0) {
      setMessages(stored.messages.map(fromPersisted));
    } else {
      const welcome: Message = {
        id: "welcome",
        role: "assistant",
        content:
          mode === "search"
            ? `Modo **Pesquisar** ativo. Pergunte sobre normas técnicas (ASHRAE, EN 12900, ABNT), fórmulas, fabricantes ou faixas típicas. Ex: "Qual a velocidade frontal recomendada para evaporadores DX?"`
            : `Olá! Sou o assistente especialista da CN Cold para **${context.componentType}**.\n\nEstou analisando os parâmetros da aba **${context.tabName}**${context.warnings?.length ? ` e identifiquei **${context.warnings.length} aviso(s)** ativo(s)` : ""}.\n\nComo posso ajudar?`,
        timestamp: new Date(),
      };
      setMessages([welcome]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionKey, mode]);

  // Persist on every message change (skip welcome-only)
  useEffect(() => {
    if (!isOpen) return;
    if (messages.length <= 1 && messages[0]?.id === "welcome") return;
    saveSession(sessionKey, {
      id: sessionKey,
      componentType: context.componentType,
      tabName: context.tabName,
      messages: messages.map(toPersisted),
      lastUpdated: new Date().toISOString(),
    });
  }, [messages, sessionKey, isOpen, context.componentType, context.tabName, saveSession]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const allMessages = [...messages, userMsg];
        const response = await callAI(allMessages, systemPrompt);
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Erro ao conectar com a IA: ${err instanceof Error ? err.message : "Erro desconhecido"}. Tente novamente.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, systemPrompt],
  );

  const handleReset = () => {
    clearSession(sessionKey);
    setMessages([]);
    setInput("");
    // Trigger welcome reload
    setTimeout(() => {
      const welcome: Message = {
        id: "welcome",
        role: "assistant",
        content:
          mode === "search"
            ? `Modo **Pesquisar** ativo. Pergunte sobre normas, fórmulas ou faixas típicas.`
            : `Olá! Nova conversa sobre **${context.componentType}** — aba **${context.tabName}**.`,
        timestamp: new Date(),
      };
      setMessages([welcome]);
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-3 py-2 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">IA Especialista CN Cold</p>
          <p className="text-[10px] text-muted-foreground truncate">{context.componentType} · {context.tabName}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset} title="Nova conversa">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Mode toggle: Chat | Pesquisar */}
      <div className="flex border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => setMode("chat")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
            mode === "chat"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
            mode === "search"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
        >
          <Search className="h-3 w-3" />
          Pesquisar
        </button>
      </div>

      {/* Contexto colapsável (só no modo Chat) */}
      {mode === "chat" && (
        <div className="border-b border-border shrink-0">
          <button
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground hover:bg-muted/40 transition-colors"
            onClick={() => setContextExpanded((v) => !v)}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${contextExpanded ? "rotate-180" : ""}`} />
            Contexto carregado
            {context.warnings?.length ? (
              <Badge variant="destructive" className="ml-auto text-[9px] px-1 py-0">
                {context.warnings.length} aviso{context.warnings.length > 1 ? "s" : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 text-green-600 border-green-500">
                OK
              </Badge>
            )}
          </button>
          {contextExpanded && (
            <div className="px-3 pb-2 space-y-1">
              {context.parameters &&
                Object.entries(context.parameters)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono text-foreground">{v}</span>
                    </div>
                  ))}
            </div>
          )}
        </div>
      )}

      {/* Mensagens */}
      <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef as React.RefObject<HTMLDivElement>}>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <p className={`mt-1 text-[9px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Analisando…</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="border-t border-border px-3 py-2 shrink-0">
          <p className="mb-1.5 text-[10px] text-muted-foreground">Sugestões rápidas:</p>
          <div className="grid grid-cols-2 gap-1">
            {quickPrompts.map((qp) => {
              const Icon = qp.icon;
              return (
                <button
                  key={qp.label}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[10px] text-foreground hover:bg-muted/60 transition-colors text-left"
                  onClick={() => sendMessage(qp.text)}
                >
                  <Icon className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate">{qp.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border px-3 py-2 shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={mode === "search" ? "Pesquisar normas, fórmulas…" : "Pergunte sobre o equipamento…"}
            className="h-8 text-xs"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-1 text-[9px] text-muted-foreground text-center">
          {mode === "search" ? "Pesquisa técnica · referências normativas" : "IA com acesso ao contexto do equipamento"} · Enter para enviar
        </p>
      </div>
    </div>
  );
}
