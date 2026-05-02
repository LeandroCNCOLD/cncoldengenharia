import { CheckCircle2, AlertTriangle, XCircle, Info, AlertOctagon } from "lucide-react";

export type Status =
  | "approved"
  | "warning"
  | "rejected"
  | "ok"
  | "error"
  | "needs_review"
  | "critical";

interface StatusBadgeProps {
  status: Status;
  label?: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  Status,
  { label: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  approved: { label: "Aprovado", bg: "bg-emerald-100", text: "text-emerald-700", Icon: CheckCircle2 },
  ok: { label: "OK", bg: "bg-emerald-100", text: "text-emerald-700", Icon: CheckCircle2 },
  warning: { label: "Atenção", bg: "bg-amber-100", text: "text-amber-700", Icon: AlertTriangle },
  needs_review: { label: "Revisar", bg: "bg-amber-100", text: "text-amber-700", Icon: AlertTriangle },
  rejected: { label: "Rejeitado", bg: "bg-red-100", text: "text-red-700", Icon: XCircle },
  error: { label: "Erro", bg: "bg-red-100", text: "text-red-700", Icon: XCircle },
  critical: { label: "Crítico", bg: "bg-red-100", text: "text-red-700", Icon: AlertOctagon },
};

export function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: "Indef.",
    bg: "bg-slate-100",
    text: "text-slate-600",
    Icon: Info,
  };
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label ?? cfg.label}
    </span>
  );
}
