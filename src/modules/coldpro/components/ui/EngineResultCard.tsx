import type { ReactNode } from "react";
import { StatusBadge, type Status } from "./StatusBadge";
import { WarningBanner } from "./WarningBanner";

interface EngineResultCardProps {
  title: string;
  status?: Status;
  warnings?: string[];
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function EngineResultCard({
  title,
  status,
  warnings = [],
  subtitle,
  actions,
  children,
}: EngineResultCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {status && <StatusBadge status={status} />}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>

      <div className="space-y-3 p-4">
        {warnings.length > 0 && <WarningBanner warnings={warnings} />}
        {children}
      </div>
    </section>
  );
}
