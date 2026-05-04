/**
 * WorkspaceAIChat.tsx
 * Painel de chat com IA especialista em refrigeração industrial.
 * Recebe contexto do workspace (tipo de componente, parâmetros, resultados, avisos)
 * e permite conversa livre sobre problemas de campo, ajustes e interpretação de resultados.
 */
import { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EnrichedWarning } from "../utils/warningEnricher";

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

interface WorkspaceAIChatProps {
  context: AIContext;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  { icon: Thermometer, label: "Interpretar resultados", text: "Interprete os resultados atuais e diga se o equipamento está bem dimensionado." },
  { icon: AlertTriangle, label: "Analisar avisos", text: "Analise os avisos ativos e me dê um diagnóstico completo com prioridade de correção." },
  { icon: Wrench, label: "Problema de campo", text: "O equipamento está em campo com capacidade abaixo do projeto. Quais são as causas mais prováveis?" },
  { icon: BookOpen, label: "Boas práticas", text: "Quais são as boas práticas de instalação e manutenção para este tipo de equipamento?" },
];

function buildSystemPrompt(ctx: AIContext): string {
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

  return `Você é um engenheiro especialista sênior em refrigeração industrial e HVAC da CN Cold Engenharia, com mais de 20 anos de experiência em projeto, instalação e manutenção de trocadores de calor, sistemas de expansão direta (DX), câmaras frigoríficas e sistemas de climatização industrial.

Você está auxiliando o engenheiro no workspace de ${ctx.componentType}, especificamente na aba "${ctx.tabName}".

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
        .slice(-10) // últimas 10 mensagens para contexto
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

export function WorkspaceAIChat({ context, isOpen, onClose }: WorkspaceAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const systemPrompt = buildSystemPrompt(context);

  // Mensagem de boas-vindas ao abrir
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcome: Message = {
        id: "welcome",
        role: "assistant",
        content: `Olá! Sou o assistente especialista da CN Cold para **${context.componentType}**.\n\nEstou analisando os parâmetros da aba **${context.tabName}**${context.warnings?.length ? ` e identifiquei **${context.warnings.length} aviso(s)** ativo(s)` : ""}.\n\nComo posso ajudar? Você pode me perguntar sobre interpretação de resultados, problemas de campo, ajustes de parâmetros ou boas práticas de instalação.`,
        timestamp: new Date(),
      };
      setMessages([welcome]);
    }
  }, [isOpen, context.componentType, context.tabName, context.warnings?.length, messages.length]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus no input ao abrir
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
    setMessages([]);
    setInput("");
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

      {/* Contexto colapsável */}
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
            {QUICK_PROMPTS.map((qp) => {
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
            placeholder="Pergunte sobre o equipamento…"
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
          IA com acesso ao contexto do equipamento · Enter para enviar
        </p>
      </div>
    </div>
  );
}
