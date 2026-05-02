import { ptBR } from "./pt-BR";

export function useTranslation() {
  return {
    t: (path: string): string => {
      const keys = path.split(".");
      let value: unknown = ptBR;

      for (const key of keys) {
        value =
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[key]
            : undefined;
      }

      return typeof value === "string" ? value : path;
    },
  };
}
