import { useState, useCallback } from "react";
import { askAssistant } from "../services/aiAssistantService";
import type { AIAssistantMessage } from "../types/frontend.types";

export function useAIAssistant() {
  const [messages, setMessages] = useState<AIAssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<string>("");

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: AIAssistantMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        const response = await askAssistant(updatedMessages, context);
        const assistantMessage: AIAssistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          context,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, context],
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearMessages, setContext };
}
