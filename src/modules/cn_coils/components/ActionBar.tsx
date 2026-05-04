import { Download, FileSpreadsheet, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionBarProps {
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onShare?: () => void;
  hasResults?: boolean;
  isExportingPdf?: boolean;
}

export function ActionBar({
  onExportCsv,
  onExportExcel,
  onExportPdf,
  onShare,
  hasResults = true,
  isExportingPdf,
}: ActionBarProps) {
  const disabled = !hasResults;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card/50 px-4 py-3">
      {onExportCsv && (
        <Button variant="outline" size="sm" onClick={onExportCsv} disabled={disabled}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          CSV
        </Button>
      )}
      {onExportExcel && (
        <Button variant="outline" size="sm" onClick={onExportExcel} disabled={disabled}>
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
          Excel
        </Button>
      )}
      {onExportPdf && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExportPdf}
          disabled={disabled || isExportingPdf}
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          {isExportingPdf ? "Gerando…" : "PDF"}
        </Button>
      )}
      {onShare && (
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onShare} disabled={disabled}>
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Compartilhar
          </Button>
        </div>
      )}
    </div>
  );
}
