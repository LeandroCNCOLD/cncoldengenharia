import type { ReactNode } from "react";

interface PageContainerProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageContainer({ title, subtitle, actions, children }: PageContainerProps) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-3 p-3 sm:p-4 lg:p-5">
      <header className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg lg:text-xl">{title}</h1>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 sm:text-xs">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
      <div>{children}</div>
    </div>
  );
}
