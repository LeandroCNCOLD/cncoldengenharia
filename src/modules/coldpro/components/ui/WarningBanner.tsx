import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface WarningBannerProps {
  warnings: string[];
  dismissible?: boolean;
}

export function WarningBanner({ warnings, dismissible = false }: WarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (warnings.length === 0 || dismissed) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {warnings.length === 1 ? "1 alerta técnico" : `${warnings.length} alertas técnicos`}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-0.5 hover:bg-amber-100"
            aria-label="Dispensar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
