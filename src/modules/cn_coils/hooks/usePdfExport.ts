import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { renderPdfBlob } from "../components/pdf/renderPdf";

interface UsePdfExportResult {
  isGenerating: boolean;
  exportPdf: (document: ReactElement, filename: string) => Promise<void>;
}

export function usePdfExport(): UsePdfExportResult {
  const [isGenerating, setIsGenerating] = useState(false);

  const exportPdf = useCallback(async (document: ReactElement, filename: string) => {
    setIsGenerating(true);
    try {
      const blob = await renderPdfBlob(document);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { isGenerating, exportPdf };
}
