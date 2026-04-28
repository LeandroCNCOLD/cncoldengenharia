// CN Cold Engineering — Editor inline de campo único.
import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FieldDef } from "@/lib/component-schema";

interface Props {
  def: FieldDef;
  value: unknown;
  source?: string;
  onSave: (value: unknown) => Promise<void>;
}

export function FieldEditor({ def, value, source, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(stringify(value));
  const [busy, setBusy] = useState(false);

  const filled = value !== undefined && value !== null && value !== "";

  async function save() {
    setBusy(true);
    try {
      let parsed: unknown = draft;
      if (def.type === "number") {
        const n = Number(draft.replace(",", "."));
        parsed = Number.isNaN(n) ? null : n;
      } else if (def.type === "json") {
        try {
          parsed = draft ? JSON.parse(draft) : null;
        } catch {
          parsed = draft;
        }
      } else if (draft === "") {
        parsed = null;
      }
      await onSave(parsed);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium">
          {def.label}{" "}
          {def.required && <span className="text-destructive">*</span>}
          {def.unit && <span className="ml-1 text-xs text-muted-foreground">({def.unit})</span>}
        </span>
        <div className="flex items-center gap-1">
          {filled && source && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] uppercase",
                source === "manual"
                  ? "bg-info/10 text-info"
                  : "bg-success/10 text-success",
              )}
            >
              {source === "manual" ? "manual" : "arquivo"}
            </span>
          )}
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => { setDraft(stringify(value)); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          {def.type === "textarea" || def.type === "json" ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={def.type === "json" ? 4 : 3}
              placeholder={def.type === "json" ? '{"chave": "valor"}' : ""}
            />
          ) : (
            <Input
              type={def.type === "number" ? "text" : "text"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              <Check className="mr-1 h-3.5 w-3.5" /> Salvar
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn("text-sm", filled ? "text-foreground" : "italic text-muted-foreground")}>
          {filled ? stringify(value) : "Ausente"}
        </p>
      )}
    </div>
  );
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
