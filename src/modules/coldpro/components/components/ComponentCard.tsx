import { Trash2, Edit2, Clock } from "lucide-react";

interface ComponentCardProps {
  name: string;
  type: string;
  spec: object;
  createdAt: string;
  onDelete: () => void;
  onEdit?: () => void;
}

export function ComponentCard({
  name,
  type,
  spec,
  createdAt,
  onDelete,
  onEdit,
}: ComponentCardProps) {
  const previewFields = Object.entries(spec as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .slice(0, 4);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{name}</h3>
          <p className="text-[11px] uppercase tracking-wider text-slate-400">
            {type.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#1E6FD9]"
              aria-label="Editar"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        {previewFields.map(([key, value]) => (
          <div key={key} className="min-w-0">
            <p className="truncate text-[10px] uppercase text-slate-400">
              {key.replace(/_/g, " ")}
            </p>
            <p className="truncate font-mono text-slate-700">{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <Clock className="h-3 w-3" />
        {new Date(createdAt).toLocaleDateString("pt-BR")}
      </div>
    </div>
  );
}
