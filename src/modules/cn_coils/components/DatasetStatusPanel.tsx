import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { ptBR } from "../i18n/messages.ptBR";
import { REQUIRED_CATALOG_FILES } from "../hooks/useUnilabCatalogs";
import type { CatalogLoadState } from "../types/unilab.types";

interface DatasetStatusPanelProps extends CatalogLoadState {
  compact?: boolean;
}

export function DatasetStatusPanel({
  loading,
  ready,
  errors,
  missing,
  compact,
}: DatasetStatusPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-[#1E6FD9]" />
        {ptBR.datasets.loading}
      </div>
    );
  }

  if (ready) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        {ptBR.datasets.ready}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        {ptBR.datasets.missingTitle}
      </div>
      {!compact && (
        <p className="mb-2 text-xs text-amber-800">{ptBR.datasets.missingHint}</p>
      )}
      <ul className="space-y-1 text-xs">
        {REQUIRED_CATALOG_FILES.map((file) => {
          const isMissing = missing.includes(file);
          return (
            <li key={file} className="flex items-start gap-2">
              {isMissing ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              )}
              <span className={isMissing ? "text-amber-900" : "text-emerald-800"}>
                {isMissing
                  ? ptBR.datasets.fileMissing(file)
                  : ptBR.datasets.fileLoaded(file)}
                {isMissing && errors[file] && (
                  <span className="ml-1 text-[11px] text-amber-700">
                    ({errors[file]})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
