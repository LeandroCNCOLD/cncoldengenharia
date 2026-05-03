import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface CnCoilsDashboardCardProps {
  title: string;
  description: string;
  href: string;
  searchParams?: Record<string, string>;
  Icon: LucideIcon;
  disabled?: boolean;
  disabledHint?: string;
}

export function CnCoilsDashboardCard({
  title,
  description,
  href,
  searchParams,
  Icon,
  disabled,
  disabledHint,
}: CnCoilsDashboardCardProps) {
  const content = (
    <div
      className={`group flex h-full flex-col justify-between rounded-xl border p-5 shadow-sm transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#1E6FD9] hover:shadow-md"
      }`}
    >
      <div>
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E6FD9]/10 text-[#1E6FD9]">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        {disabled && disabledHint && (
          <p className="mt-2 text-xs text-amber-700">{disabledHint}</p>
        )}
      </div>
      <div
        className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${
          disabled ? "text-slate-400" : "text-[#1E6FD9]"
        }`}
      >
        Abrir workspace
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </div>
  );

  if (disabled) return content;

  return (
    <Link to={href} search={searchParams as never} className="block h-full">
      {content}
    </Link>
  );
}
