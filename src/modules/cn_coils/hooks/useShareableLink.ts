/**
 * Feature G — useShareableLink
 * Gera, copia e decodifica links compartilháveis de projetos via URL hash (base64).
 */

import { useState } from "react";
import { toast } from "sonner";
import type { SavedProject } from "../store/useProjectStore";

// ── Codec ─────────────────────────────────────────────────────────────────────

/** Serializa um projeto para base64url (sem padding) */
export function encodeProject(project: SavedProject): string {
  const json = JSON.stringify(project);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  // base64url: substitui + por - e / por _
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Desserializa um token base64url de volta para SavedProject */
export function decodeProject(token: string): SavedProject {
  // Restaura padding e caracteres base64 padrão
  const padded = token.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(pad);
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json) as SavedProject;
}

/** Constrói a URL completa de compartilhamento */
export function buildShareUrl(project: SavedProject, baseUrl?: string): string {
  const base = baseUrl ?? window.location.origin;
  const token = encodeProject(project);
  return `${base}/shared?p=${token}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseShareableLinkReturn {
  shareUrl: string | null;
  generate: (project: SavedProject) => string;
  copyToClipboard: (project: SavedProject) => Promise<void>;
  isCopying: boolean;
}

export function useShareableLink(): UseShareableLinkReturn {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const generate = (project: SavedProject): string => {
    const url = buildShareUrl(project);
    setShareUrl(url);
    return url;
  };

  const copyToClipboard = async (project: SavedProject): Promise<void> => {
    setIsCopying(true);
    try {
      const url = buildShareUrl(project);
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar o link. Tente manualmente.");
    } finally {
      setIsCopying(false);
    }
  };

  return { shareUrl, generate, copyToClipboard, isCopying };
}
